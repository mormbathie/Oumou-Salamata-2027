import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { schoolFees } from '../school/school-options';
import { allocatePackage, allocationReasons, packageFor, registrationCycle, registrationPackages, rubricLabels } from '../school/registration-allocation';

export const registrationStates = ['ALL', 'PAID', 'PARTIAL', 'UNPAID', 'OUTSTANDING', 'NOT_INVOICED'];
export type RegistrationReportQuery = {academicYearId?:string;classroomId?:string;karate?:string;fullDay?:string;status?:string;cycle?:string;rubric?:string};
@Injectable()
export class RegistrationReportService {
 constructor(private readonly prisma:PrismaService) {}
 async report(query:RegistrationReportQuery) {
  for(const value of [query.academicYearId,query.classroomId,query.status,query.cycle,query.rubric])if(value!==undefined&&(typeof value!=='string'||value.length>100))throw new BadRequestException('Filtre invalide.');
  for(const option of [query.karate,query.fullDay])if(option!==undefined&&!['true','false',''].includes(option))throw new BadRequestException('Filtre d’option invalide.');
  const status=query.status||'ALL',cycle=query.cycle||'',rubric=query.rubric||'';
  if(!registrationStates.includes(status)||!['','PRESCHOOL','ELEMENTARY','OTHER'].includes(cycle)||rubric&&!Object.hasOwn(rubricLabels,rubric))throw new BadRequestException('Filtre de synthèse invalide.');
  return this.prisma.$transaction(async tx=>{
   await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
   const year=query.academicYearId?await tx.academicYear.findUnique({where:{id:query.academicYearId}}):await tx.academicYear.findFirst({where:{isCurrent:true}});
   if(!year)throw new NotFoundException('Année scolaire introuvable.');
   const rawClasses=await tx.classroom.findMany({where:{academicYearId:year.id},select:{id:true,name:true,level:true,program:true,registrationFee:true,monthlyTuition:true},orderBy:{name:'asc'}});
   if(query.classroomId&&!rawClasses.some(c=>c.id===query.classroomId))throw new BadRequestException('Classe étrangère à l’année sélectionnée.');
   const classes=rawClasses.map(c=>({...c,cycle:registrationCycle(c)}));
   const students=await tx.student.findMany({
    where:{...(query.classroomId?{enrollments:{some:{academicYearId:year.id,classroomId:query.classroomId}}}:{OR:[{enrollments:{some:{academicYearId:year.id}}},{invoices:{some:{academicYearId:year.id,type:'REGISTRATION',cancelledAt:null}}}]}),...(query.karate?{karate:query.karate==='true'}:{}),...(query.fullDay?{fullDay:query.fullDay==='true'}:{})},
    select:{id:true,firstName:true,lastName:true,matricule:true,karate:true,fullDay:true,supplies:true,transportZone:true,
     enrollments:{where:{academicYearId:year.id},take:1,orderBy:[{enrollmentDate:'desc'},{id:'asc'}],select:{classroom:{select:{id:true,name:true,level:true,program:true,registrationFee:true,monthlyTuition:true}}}},
     invoices:{where:{academicYearId:year.id,cancelledAt:null},select:{id:true,invoiceNumber:true,type:true,category:true,amount:true,paidAmount:true,balance:true,registrationOptions:true,payments:{select:{amount:true,cancelledAt:true,refunds:{select:{amount:true}}}}}},
    },orderBy:[{lastName:'asc'},{firstName:'asc'},{id:'asc'}],
   });
   const enriched=students.map(s=>{
    const classroom=s.enrollments[0]?.classroom;
    const invoices=s.invoices.filter(i=>i.type==='REGISTRATION');
    const values=invoices.map(i=>{
     const active=i.payments.filter(p=>!p.cancelledAt),gross=active.reduce((a,p)=>a+p.amount,0),refunded=i.payments.reduce((a,p)=>a+p.refunds.reduce((b,r)=>b+r.amount,0),0);
     return {...i,gross,refunded};
    });
    const invoiced=invoices.reduce((a,i)=>a+i.amount,0),grossPaid=values.reduce((a,i)=>a+i.gross,0),refunded=values.reduce((a,i)=>a+i.refunded,0),balance=invoices.reduce((a,i)=>a+i.balance,0);
    const state=!invoices.length?'NOT_INVOICED':balance<=0?'PAID':invoices.some(i=>i.paidAmount>0)?'PARTIAL':'UNPAID';
    return {student:s,values,classroom,row:{id:s.id,name:`${s.firstName} ${s.lastName}`,matricule:s.matricule,classroom:classroom?.name||'—',cycle:registrationCycle(classroom),karate:s.karate,fullDay:s.fullDay,invoiced,grossPaid,refunded,paid:grossPaid-refunded,balance,status:state,invoiceCount:invoices.length,unbilledEstimate:!invoices.length&&classroom?schoolFees(s,classroom).registrationFee:0,invoices:invoices.map(i=>({id:i.id,invoiceNumber:i.invoiceNumber,amount:i.amount,paidAmount:i.paidAmount,balance:i.balance})),allocationState:'ESTIMATED',allocationNotes:[] as string[]}};
   }).filter(x=>(!cycle||x.row.cycle===cycle)&&(status==='ALL'||(status==='OUTSTANDING'?['PARTIAL','UNPAID'].includes(x.row.status):x.row.status===status)));
   const totals={students:enriched.length,invoiced:0,paid:0,refunded:0,grossPaid:0,balance:0,unbilledEstimate:0,counts:{PAID:0,PARTIAL:0,UNPAID:0,NOT_INVOICED:0}};
   const buckets=new Map(Object.entries(rubricLabels).map(([code,label])=>[code,{code,label,students:new Set<string>(),expected:0,paid:0,refunded:0,balance:0}]));
   const issues:{studentId:string;name:string;matricule:string;invoiceNumber:string;reason:string;message:string}[]=[];
   let overpayment=0,refundOutsidePackage=0,excludedParallelNet=0;
   for(const entry of enriched){
    const {student,values,classroom,row}=entry;
    for(const key of ['invoiced','paid','refunded','grossPaid','balance','unbilledEstimate'] as const)totals[key]+=row[key];
    totals.counts[row.status]++;
    for(const i of student.invoices.filter(i=>i.type!=='REGISTRATION'))for(const p of i.payments.filter(p=>!p.cancelledAt))excludedParallelNet+=p.amount-p.refunds.reduce((s,r)=>s+r.amount,0);
    if(!values.length){row.allocationState='NOT_INVOICED';row.allocationNotes.push(allocationReasons.NO_INVOICE);}
    for(const invoice of values){
     let reason:string|undefined;
     const net=invoice.gross-invoice.refunded;
     const moneyValid=[invoice.amount,invoice.gross,invoice.refunded].every(n=>Number.isSafeInteger(n)&&n>=0)&&net>=0;
     const extra=moneyValid?Math.max(net-invoice.amount,0):0;
     const outsideRefund=moneyValid?invoice.refunded-(Math.min(invoice.gross,invoice.amount)-Math.min(net,invoice.amount)):0;
     overpayment+=extra;refundOutsidePackage+=outsideRefund;
     if(![invoice.amount,invoice.gross,invoice.refunded,invoice.balance,invoice.paidAmount].every(n=>Number.isSafeInteger(n)&&n>=0)||invoice.refunded>invoice.gross||invoice.payments.some(p=>p.cancelledAt&&p.refunds.length))reason='INVALID_MONEY';
     else if(invoice.gross!==invoice.paidAmount)reason='PAYMENTS_MISMATCH';
     else if(invoice.balance!==Math.max(invoice.amount-invoice.gross,0))reason='BALANCE_MISMATCH';
     else if(values.length>1)reason='MULTIPLE_INVOICES';
     const plan=packageFor(invoice,classroom,student);
     reason=reason||plan.reason;
     if(reason){
      row.allocationState='UNAVAILABLE';row.allocationNotes.push(allocationReasons[reason]);
      issues.push({studentId:student.id,name:row.name,matricule:student.matricule,invoiceNumber:invoice.invoiceNumber,reason,message:allocationReasons[reason]});
      const bucket=buckets.get('UNALLOCATED')!;bucket.students.add(student.id);bucket.expected+=invoice.amount;bucket.paid+=net-extra;bucket.refunded+=invoice.refunded-outsideRefund;bucket.balance+=invoice.balance;
     }else{
      const result=allocatePackage(plan.lines,invoice.gross,invoice.refunded);
      for(const line of result.lines){const b=buckets.get(line.code)!;b.students.add(student.id);b.expected+=line.amount;b.paid+=line.paid;b.refunded+=line.refunded;b.balance+=line.balance;}
     }
    }
   }
   const allRubrics=[...buckets.values()].map(b=>({...b,students:b.students.size}));
   const shown=allRubrics.filter(b=>(!rubric||b.code===rubric)&&b.students>0);
   const sum=(items:typeof allRubrics)=>items.reduce((s,b)=>({expected:s.expected+b.expected,paid:s.paid+b.paid,refunded:s.refunded+b.refunded,balance:s.balance+b.balance}),{expected:0,paid:0,refunded:0,balance:0});
   const grand=sum(allRubrics),unallocated=allRubrics.find(b=>b.code==='UNALLOCATED')!;
   return {academicYear:{id:year.id,name:year.name},classes:classes.filter(c=>!cycle||c.cycle===cycle),totals,rows:enriched.map(x=>x.row),allocation:{method:'Ventilation estimée au prorata',rubrics:shown,availableRubrics:Object.entries(rubricLabels).map(([code,label])=>({code,label})),displayedTotals:sum(shown),totals:grand,estimatedNet:grand.paid-unallocated.paid,unallocatedNet:unallocated.paid,overpayment,refundOutsidePackage,excludedParallelNet,issues,tariffs:Object.entries(registrationPackages).map(([cycle,lines])=>({cycle,total:lines.reduce((s,l)=>s+l.amount,0),lines:lines.map(l=>({...l,label:rubricLabels[l.code]}))})),reconciledNet:grand.paid+overpayment===totals.paid}};
  },{isolationLevel:'RepeatableRead'});
 }
}
