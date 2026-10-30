const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {SuppliesService}=require('../dist/src/finances/supplies.service');
const {FinancesService}=require('../dist/src/finances/finances.service');
const {StudentsService}=require('../dist/src/students/students.service');
const {RefundsService}=require('../dist/src/finances/refunds.service');
(async()=>{
 const url=new URL(process.env.DATABASE_URL);assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&['/ci_test','/as_sakina_test2'].includes(url.pathname));
 const db=new PrismaClient(),actor={userId:'qa-supplies-'+randomUUID(),username:'QA fournitures',roles:['ADMIN']},service=new SuppliesService(db),finances=new FinancesService(db),students=new StudentsService(db,{});
 const tag=actor.userId;let year,room,parent,child,article,legacy;const studentIds=[];
 try{
  year=await db.academicYear.findFirst({where:{isCurrent:true}});assert.ok(year,'Current test year required');
  room=await db.classroom.create({data:{name:tag,level:'CI',program:'ELEMENTARY',registrationFee:40000,monthlyTuition:15000,academicYearId:year.id}});
  parent=await db.parent.create({data:{firstName:'Parent',lastName:tag,phone:'700000000'}});
  child=await students.create({firstName:'Test fournitures',lastName:tag,gender:'MALE',dateOfBirth:'2020-01-01',classroomId:room.id,parentId:parent.id,supplies:true},actor);studentIds.push(child.id);
  const registration=await db.invoice.findFirst({where:{studentId:child.id,type:'REGISTRATION'}});assert.equal(registration.amount,40000);assert.equal(JSON.parse(registration.registrationOptions).suppliesSeparate,true);
  await finances.recordPayment({invoiceId:registration.id,amount:40000,paymentMethod:'CASH'},actor);
  article=await service.saveArticle({name:'Livre '+tag,price:3000},actor);
  const payload={studentId:child.id,requestKey:randomUUID(),lines:[{articleId:article.id,unitPrice:3000,quantity:2}]};
  const [one,two]=await Promise.all([service.sell(payload,actor),service.sell(payload,actor)]);assert.equal(one.id,two.id);assert.equal(one.amount,6000);assert.equal(one.category,'SUPPLIES');assert.equal(await db.invoice.count({where:{billingKey:'SUPPLIES:'+payload.requestKey}}),1);
  await finances.recordPayment({invoiceId:one.id,amount:2000,paymentMethod:'CASH'},actor);
  let updated=await db.invoice.findUnique({where:{id:one.id}});assert.equal(updated.balance,4000);assert.equal(updated.status,'PARTIAL');assert.equal((await db.invoice.findUnique({where:{id:registration.id}})).status,'PAID');
  await assert.rejects(finances.recordPayment({invoiceId:one.id,amount:4001,paymentMethod:'CASH'},actor));
  await service.saveArticle({name:'Nouveau titre '+tag,price:4000},actor,article.id);assert.equal(JSON.parse(updated.supplyLines)[0].unitPrice,3000);assert.equal(JSON.parse(updated.supplyLines)[0].name,'Livre '+tag);
  assert.equal((await service.sell(payload,actor)).id,one.id);await assert.rejects(service.sell({...payload,requestKey:randomUUID()},actor),/prix/);await assert.rejects(service.sell({...payload,lines:[{...payload.lines[0],quantity:3}]},actor),/référence/);
  await finances.recordPayment({invoiceId:one.id,amount:4000,paymentMethod:'CASH'},actor);assert.equal((await db.invoice.findUnique({where:{id:one.id}})).status,'PAID');
  const old=await db.student.create({data:{firstName:'Ancien',lastName:tag,matricule:tag,gender:'MALE',dateOfBirth:new Date('2020-01-01'),parentId:parent.id,supplies:true}});studentIds.push(old.id);await db.enrollment.create({data:{studentId:old.id,classroomId:room.id,academicYearId:year.id}});
  legacy=await db.invoice.create({data:{invoiceNumber:tag,studentId:old.id,academicYearId:year.id,title:'Ancien forfait',type:'REGISTRATION',amount:77500,paidAmount:40000,balance:37500,status:'PARTIAL',registrationOptions:'{"supplies":true}',dueDate:new Date()}});
  const oldPayment=await db.payment.create({data:{paymentNumber:tag,invoiceId:legacy.id,amount:40000,paymentMethod:'CASH'}});
  const before=await db.invoice.findUnique({where:{id:legacy.id}}),beforePayment=await db.payment.findUnique({where:{id:oldPayment.id}});
  await students.update(old.id,{supplies:false},actor);assert.deepEqual(await db.invoice.findUnique({where:{id:legacy.id}}),before);assert.deepEqual(await db.payment.findUnique({where:{id:oldPayment.id}}),beforePayment);
  const next={studentId:old.id,requestKey:randomUUID(),lines:[{articleId:article.id,unitPrice:4000,quantity:1}]};await assert.rejects(service.sell(next,actor),/vérifier/);const acknowledged=await service.sell({...next,legacyAcknowledged:true},actor);assert.equal(acknowledged.amount,4000);assert.deepEqual(await db.invoice.findUnique({where:{id:legacy.id}}),before);
  const overview=await service.overview();assert.ok(overview.legacy.some(i=>i.id===legacy.id));assert.equal(overview.groups.find(g=>g.key==='SUPPLIES').gross,6000);assert.equal(overview.groups.find(g=>g.key==='SUPPLIES').balance,4000);
  const audit=await db.businessAudit.findFirst({where:{entityId:acknowledged.id,action:'SUPPLIES_SALE'}});assert.equal(JSON.parse(audit.details).legacyAcknowledged,true);
  await service.saveArticle({name:'Livre '+tag,price:4000,active:false},actor,article.id);await assert.rejects(service.sell({...next,requestKey:randomUUID(),legacyAcknowledged:true},actor),/désactivé/);
  const payment=await db.payment.findFirst({where:{invoiceId:one.id,amount:2000}});await new RefundsService(db).create({paymentId:payment.id,amount:1000,expectedRefundedAmount:0,refundedOn:new Date().toISOString().slice(0,10),paymentMethod:'CASH',recipient:'Parent test',reason:'Test remboursement fournitures',mode:'ALREADY_PAID_REGULARIZATION',requestKey:randomUUID()},actor);
  const afterRefund=await service.overview();assert.equal(afterRefund.groups.find(g=>g.key==='SUPPLIES').net,5000);assert.equal((await db.invoice.findUnique({where:{id:registration.id}})).status,'PAID');
  if(process.env.SUPPLIES_FIXTURE_FILE){const fs=require('fs');const invoice=await finances.getInvoice(one.id);fs.writeFileSync(process.env.SUPPLIES_FIXTURE_FILE,JSON.stringify({invoice,overview:afterRefund,articles:[{id:article.id,name:'Livre test',price:4000,active:true}],students:[await students.findOne(child.id,actor)]}),{mode:0o600});}
  console.log('PASS supplies: independent registration, immutable prices, partial/full payments, refunds, concurrent replay, legacy invoices/receipts unchanged, review acknowledgement and revenue categories');
 }finally{
  const invoices=await db.invoice.findMany({where:{studentId:{in:studentIds}},select:{id:true}});await db.refund.deleteMany({where:{payment:{invoiceId:{in:invoices.map(i=>i.id)}}}});await db.businessAudit.deleteMany({where:{actorId:actor.userId}});await db.student.deleteMany({where:{id:{in:studentIds}}});if(parent)await db.parent.delete({where:{id:parent.id}});if(room)await db.classroom.delete({where:{id:room.id}});if(article)await db.supplyArticle.delete({where:{id:article.id}});await db.$disconnect();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
