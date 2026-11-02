const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {StudentsService}=require('../dist/src/students/students.service');
(async()=>{
 const u=new URL(process.env.DATABASE_URL);
 assert.ok(['localhost','127.0.0.1'].includes(u.hostname)&&['/ci_test','/as_sakina_test2'].includes(u.pathname),'Dedicated test database required');
 const db=new PrismaClient(),tag='delete-test-'+randomUUID(),actor={userId:tag,username:'QA suppression',roles:['ADMIN']};
 const removedFiles=[];const service=new StudentsService(db,{removeStoredFiles:async keys=>removedFiles.push(...keys)});
 let year,parent,child,sibling,invoice,payment;
 try{
  year=await db.academicYear.create({data:{name:tag,startDate:new Date('2026-09-01'),endDate:new Date('2027-07-31')}});
  const classroom=await db.classroom.create({data:{name:tag,level:'PS',program:'PRESCHOOL',registrationFee:50000,monthlyTuition:15000,academicYearId:year.id}});
  parent=await db.parent.create({data:{firstName:'Parent',lastName:tag,phone:'770000000'}});
  const data={firstName:'QA',lastName:tag,dateOfBirth:new Date('2023-01-01'),gender:'MALE',parentId:parent.id};
  child=await db.student.create({data:{...data,matricule:tag+'-one'}});
  sibling=await db.student.create({data:{...data,matricule:tag+'-two'}});
  await db.enrollment.create({data:{studentId:child.id,classroomId:classroom.id,academicYearId:year.id}});
  await db.attendance.create({data:{studentId:child.id,classroomId:classroom.id,date:new Date('2026-11-01'),status:'PRESENT'}});
  await db.studentDocument.create({data:{studentId:child.id,category:'STUDENT_PHOTO',originalName:'test.png',mimeType:'image/png',size:1,storageKey:tag+'.png'}});
  invoice=await db.invoice.create({data:{studentId:child.id,academicYearId:year.id,invoiceNumber:tag,amount:50000,paidAmount:40000,balance:10000,title:'Test',dueDate:new Date(),status:'PARTIAL'}});
  payment=await db.payment.create({data:{invoiceId:invoice.id,paymentNumber:tag,amount:40000}});
  await db.refund.create({data:{paymentId:payment.id,refundNumber:tag,amount:10000,refundedOn:new Date(),paymentMethod:'CASH',reason:'Fixture',recipient:'Parent',mode:'ALREADY_PAID_REGULARIZATION',requestKey:randomUUID(),actorId:tag,actorName:'QA',actorRole:'ADMIN'}});
  await db.studentDeparture.create({data:{studentId:child.id,departedOn:new Date(),reason:'Fixture',requestKey:randomUUID(),actorId:tag,actorName:'QA',actorRole:'ADMIN'}});
  await db.paymentReminder.create({data:{invoiceId:invoice.id,billingKey:tag,actorId:tag,actorName:'QA',actorRole:'ADMIN'}});
  await db.paymentInstallment.create({data:{invoiceId:invoice.id,dueDate:new Date(),amount:10000,basePaidAmount:40000}});
  const siblingBefore=await db.student.findUnique({where:{id:sibling.id}}),parentBefore=await db.parent.findUnique({where:{id:parent.id}});
  for(const role of ['DIRECTEUR','COMPTABLE'])await assert.rejects(service.remove(child.id,{}, {...actor,roles:[role]}),e=>e.status===403);
  let preview=await service.deletionPreview(child.id,actor);
  assert.equal(preview.counts.refunds,1);assert.equal(preview.counts.departures,1);
  await db.payment.update({where:{id:payment.id},data:{reference:'Changed since preview'}});
  await assert.rejects(service.remove(child.id,{matricule:child.matricule,reason:'Doublon de test confirmé',confirmationToken:preview.confirmationToken},actor),e=>e.status===409);
  assert.ok(await db.student.findUnique({where:{id:child.id}}));assert.equal(removedFiles.length,0);
  preview=await service.deletionPreview(child.id,actor);
  const originalDelete=db.$transaction.bind(db);
  // Simulate failure after the audit and deletions; PostgreSQL must roll back everything.
  db.$transaction=(fn,opts)=>originalDelete(async tx=>fn(new Proxy(tx,{get(target,key){if(key==='student')return new Proxy(target.student,{get(model,k){if(k==='delete')return async()=>{throw new Error('Simulated failure')};return model[k]}});return target[key]}})),opts);
  await assert.rejects(service.remove(child.id,{matricule:child.matricule,reason:'Doublon de test confirmé',confirmationToken:preview.confirmationToken},actor),/Simulated failure/);
  db.$transaction=originalDelete;
  assert.equal(await db.refund.count({where:{paymentId:payment.id}}),1);
  assert.equal(await db.businessAudit.count({where:{entityId:child.id,action:'STUDENT_DELETED'}}),0);assert.equal(removedFiles.length,0);
  await service.remove(child.id,{matricule:child.matricule,reason:'Doublon de test confirmé',confirmationToken:preview.confirmationToken},actor);
  assert.equal(await db.student.findUnique({where:{id:child.id}}),null);
  for(const model of ['enrollment','attendance','studentDocument','studentDeparture'])assert.equal(await db[model].count({where:{studentId:child.id}}),0);
  for(const model of ['payment','paymentReminder','paymentInstallment'])assert.equal(await db[model].count({where:{invoiceId:invoice.id}}),0);
  assert.equal(await db.refund.count({where:{paymentId:payment.id}}),0);
  assert.equal(await db.invoice.findUnique({where:{id:invoice.id}}),null);
  assert.deepEqual(await db.student.findUnique({where:{id:sibling.id}}),siblingBefore);
  assert.deepEqual(await db.parent.findUnique({where:{id:parent.id}}),parentBefore);
  const audit=await db.businessAudit.findFirstOrThrow({where:{entityId:child.id,action:'STUDENT_DELETED'}});
  assert.equal(JSON.parse(audit.details).student.invoices[0].payments[0].refunds[0].amount,10000);
  assert.deepEqual(removedFiles,[tag+'.png']);
  await assert.rejects(service.deletionPreview(child.id,actor),e=>e.status===404);
  console.log('PASS: admin only, stale-preview conflict, complete transaction rollback, cascades incl refunds/departure, audit snapshot, documents cleanup, parent/sibling unchanged');
 }finally{
  await db.refund.deleteMany({where:{actorId:tag}});await db.studentDeparture.deleteMany({where:{actorId:tag}});
  if(invoice){await db.paymentReminder.deleteMany({where:{invoiceId:invoice.id}});await db.paymentInstallment.deleteMany({where:{invoiceId:invoice.id}})}
  await db.student.deleteMany({where:{lastName:tag}});await db.businessAudit.deleteMany({where:{actorId:tag}});
  if(parent)await db.parent.delete({where:{id:parent.id}});
  if(year){await db.classroom.deleteMany({where:{academicYearId:year.id}});await db.academicYear.delete({where:{id:year.id}})}
  await db.$disconnect();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
