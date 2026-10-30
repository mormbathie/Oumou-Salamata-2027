import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActingUser, actorStamp } from '../audit/actor';
import { randomUUID } from 'node:crypto';

@Injectable()
export class SuppliesService {
  constructor(private readonly db: PrismaService) {}
  articles() { return this.db.supplyArticle.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] }); }
  async saveArticle(data: any, actor: ActingUser, id?: string) {
    const author = actorStamp(actor);
    if (!data || typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 100 || !Number.isSafeInteger(data.price) || data.price <= 0 || data.price > 1000000 || (data.active !== undefined && typeof data.active !== 'boolean')) throw new BadRequestException('Nom et prix entier positif (maximum 1 000 000 F) requis.');
    return this.db.$transaction(async tx => {
      if (id && !await tx.supplyArticle.findUnique({ where: { id } })) throw new NotFoundException('Article introuvable.');
      const values = { name: data.name.trim(), price: data.price, active: data.active ?? true };
      const item = id ? await tx.supplyArticle.update({where:{id},data:values}) : await tx.supplyArticle.create({data:values});
      await tx.businessAudit.create({data:{entityId:item.id,action:id?'SUPPLY_ARTICLE_UPDATE':'SUPPLY_ARTICLE_CREATE',actorId:author.id,actorName:author.name,actorRole:author.role,details:JSON.stringify(values)}});
      return item;
    });
  }
  async sell(data: any, actor: ActingUser) {
    const author = actorStamp(actor);
    if (!data || typeof data.studentId !== 'string' || typeof data.requestKey !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(data.requestKey) || !Array.isArray(data.lines) || !data.lines.length || data.lines.length > 10) throw new BadRequestException('Élève, articles et référence de demande requis (10 articles maximum).');
    const ids = new Set<string>();
    for (const l of data.lines) {
      if (!l || !Number.isSafeInteger(l.unitPrice) || l.unitPrice < 1 || typeof l.articleId !== 'string' || ids.has(l.articleId) || !Number.isSafeInteger(l.quantity) || l.quantity < 1 || l.quantity > 100) throw new BadRequestException('Articles distincts et quantités de 1 à 100 requis.');
      ids.add(l.articleId);
    }
    return this.db.$transaction(async tx => {
      // Serialize submissions for this pupil, including retries of the same request.
      await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${data.studentId} FOR UPDATE`;
      const key = 'SUPPLIES:' + data.requestKey;
      const existing = await tx.invoice.findUnique({where:{billingKey:key}});
      if (existing) {
        const old = JSON.parse(existing.supplyLines || '[]');
        if (existing.studentId !== data.studentId || old.length !== data.lines.length || !old.every((l:any)=>data.lines.some((n:any)=>n.articleId===l.articleId && n.quantity===l.quantity && n.unitPrice===l.unitPrice))) throw new BadRequestException('Cette référence est déjà utilisée pour une autre vente.');
        return existing;
      }
      const student = await tx.student.findUnique({where:{id:data.studentId},include:{enrollments:{where:{status:'REGISTERED',academicYear:{isCurrent:true}},take:1}}});
      if (!student || student.status !== 'ACTIVE' || !student.enrollments[0]) throw new BadRequestException('Élève actif inscrit requis.');
      const previous = await tx.invoice.findMany({where:{studentId:student.id,type:'REGISTRATION',cancelledAt:null},select:{id:true,registrationOptions:true}});
      const legacy = previous.filter(i=>legacySupplies(i,student.supplies));
      if (legacy.length && data.legacyAcknowledged !== true) throw new BadRequestException('Ancienne inscription à vérifier : confirmez que les articles ne sont pas déjà facturés ou payés.');
      const articles = await tx.supplyArticle.findMany({where:{id:{in:[...ids]},active:true}});
      if (articles.length !== ids.size) throw new BadRequestException('Un article est introuvable ou désactivé.');
      const lines = data.lines.map((l:any)=>{const a=articles.find(a=>a.id===l.articleId)!;if (a.price!==l.unitPrice) throw new BadRequestException('Le prix du catalogue a changé. Actualisez la page avant de confirmer.');return {articleId:a.id,name:a.name,quantity:l.quantity,unitPrice:a.price,total:a.price*l.quantity};});
      const amount = lines.reduce((s:number,l:any)=>s+l.total,0);
      const invoice = await tx.invoice.create({data:{studentId:student.id,academicYearId:student.enrollments[0].academicYearId,invoiceNumber:'FOU-'+new Date().getFullYear()+'-'+randomUUID().toUpperCase(),title:'Fournitures scolaires',category:'SUPPLIES',type:'OTHER',amount,paidAmount:0,balance:amount,status:'UNPAID',dueDate:new Date(),billingKey:key,supplyLines:JSON.stringify(lines),createdById:author.id,createdByName:author.name,createdByRole:author.role}});
      await tx.businessAudit.create({data:{entityId:invoice.id,action:'SUPPLIES_SALE',actorId:author.id,actorName:author.name,actorRole:author.role,details:JSON.stringify({amount,lines,legacyAcknowledged:legacy.length>0,legacyInvoiceIds:legacy.map(i=>i.id)})}});
      return invoice;
    });
  }
  async overview() {
    return this.db.$transaction(async tx => {
      const invoices = await tx.invoice.findMany({where:{cancelledAt:null},select:{id:true,studentId:true,academicYearId:true,invoiceNumber:true,type:true,category:true,amount:true,paidAmount:true,balance:true,registrationOptions:true,student:{select:{firstName:true,lastName:true,matricule:true,supplies:true}},payments:{select:{refunds:{select:{amount:true}}}}}});
      const legacy = invoices.filter(i=>i.type==='REGISTRATION' && legacySupplies(i,i.student.supplies));
      const groups = ['REGISTRATION','SUPPLIES','OTHER'].map(key=>{
        const rows=invoices.filter(i=>(i.category==='SUPPLIES'?'SUPPLIES':i.type==='REGISTRATION'?'REGISTRATION':'OTHER')===key);
        const gross=rows.reduce((s,i)=>s+i.paidAmount,0),refunded=rows.reduce((s,i)=>s+i.payments.reduce((a,p)=>a+p.refunds.reduce((b,r)=>b+r.amount,0),0),0);
        return {key,invoiced:rows.reduce((s,i)=>s+i.amount,0),gross,refunded,net:gross-refunded,balance:rows.reduce((s,i)=>s+i.balance,0)};
      });
      return {groups,total:groups.reduce((s,g)=>s+g.net,0),legacy:legacy.map(i=>({id:i.id,studentId:i.studentId,invoiceNumber:i.invoiceNumber,student:i.student,amount:i.amount,paidAmount:i.paidAmount,balance:i.balance,reason:'Ancienne inscription : vérifier si des fournitures sont incluses. Aucune répartition automatique.'}))};
    },{isolationLevel:'RepeatableRead'});
  }
}

// No inferred allocation: null/unreadable snapshots and any recorded supply flag require review.
export function legacySupplies(invoice: {registrationOptions:string|null}, supplies:boolean) {
  try {const o=JSON.parse(invoice.registrationOptions || '{}');if(!o || typeof o!=='object' || Array.isArray(o))return true;return o.suppliesSeparate!==true && (!!o.suppliesLegacyReview || !!o.supplies || supplies || !invoice.registrationOptions);}catch{return true;}
}
