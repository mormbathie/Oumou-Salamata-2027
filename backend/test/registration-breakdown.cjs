const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),fs=require('fs');
const {PrismaClient,Prisma}=require('@prisma/client');
const {RegistrationReportService}=require('../dist/src/finances/registration-report.service');
const {RefundsService}=require('../dist/src/finances/refunds.service');
(async()=>{
 const u=new URL(process.env.DATABASE_URL);assert.ok(['localhost','127.0.0.1'].includes(u.hostname)&&['/ci_test','/as_sakina_test2'].includes(u.pathname),'Dedicated test DB required');
 const db=new PrismaClient(),tag='allocation-'+randomUUID(),ids=[],actor={userId:tag,username:'QA rubriques',roles:['ADMIN']};let year;
 const report=new RegistrationReportService(db);
 async function snapshot(){const out={};for(const m of Prisma.dmmf.datamodel.models){const key=m.fields.find(f=>f.isId).name;out[m.name]=await db.$queryRawUnsafe(`SELECT "${key}"::text AS id,md5(to_jsonb(t)::text) AS hash FROM "${m.name}" t ORDER BY "${key}"`);}return out;}
 try{
  year=await db.academicYear.create({data:{name:tag,startDate:new Date('2026-09-01'),endDate:new Date('2027-07-31'),isCurrent:false}});
  async function room(level,program,fee){return db.classroom.create({data:{name:tag+' '+level,level,program,registrationFee:fee,monthlyTuition:15000,academicYearId:year.id}});}
  const ps=await room('PS','PRESCHOOL',50000),ci=await room('CI','ELEMENTARY',40000),ce2=await room('CE2','ELEMENTARY',40000);
  async function pupil(c,amount,paid,options={},extras={}){
   const s=await db.student.create({data:{firstName:'QA',lastName:tag+' '+ids.length,matricule:tag+'-'+ids.length,dateOfBirth:new Date('2020-01-01'),gender:'FEMALE',fullDay:!!options.fullDay,karate:!!options.karate,supplies:!!options.supplies}});ids.push(s.id);
   await db.enrollment.create({data:{studentId:s.id,classroomId:c.id,academicYearId:year.id}});
   const i=await db.invoice.create({data:{studentId:s.id,academicYearId:year.id,invoiceNumber:randomUUID(),title:'Forfait de test',type:'REGISTRATION',amount,paidAmount:paid,balance:Math.max(amount-paid,0),dueDate:new Date(),status:paid>=amount?'PAID':paid?'PARTIAL':'UNPAID',registrationOptions:JSON.stringify({fullDay:false,karate:false,supplies:false,transportZone:null,...options}),...extras}});
   let p;if(paid)p=await db.payment.create({data:{invoiceId:i.id,paymentNumber:randomUUID(),amount:paid,paymentMethod:'CASH'}});
   return {s,i,p};
  }
  for(let n=0;n<10;n++){await pupil(ci,40000,40000);await pupil(ps,50000,50000);}
  let r=await report.report({academicYearId:year.id,cycle:'ELEMENTARY'});const bucket=(r,code)=>r.allocation.rubrics.find(b=>b.code===code);
  assert.equal(bucket(r,'BADGE').paid,10000);assert.equal(bucket(r,'REGISTRATION').paid,70000);assert.equal(bucket(r,'PAPER').paid,20000);assert.equal(r.allocation.estimatedNet,400000);
  r=await report.report({academicYearId:year.id,cycle:'PRESCHOOL'});assert.equal(bucket(r,'BADGE').paid,5000);assert.equal(bucket(r,'REGISTRATION').paid,70000);
  const partial=await pupil(ci,40000,20000);r=await report.report({academicYearId:year.id,status:'PARTIAL'});assert.equal(bucket(r,'BADGE').paid,500);assert.equal(bucket(r,'BADGE').balance,500);assert.equal(r.rows.length,1);
  const discounted=await pupil(ci,35000,17500),exempt=await pupil(ci,0,0);
  const separate=await pupil(ci,40000,40000,{supplies:true,suppliesSeparate:true});
  for(const [category,type,amount] of [['SUPPLIES','OTHER',7500],[null,'TUITION',15000],['KIMONO','OTHER',6000]]){const invoice=await db.invoice.create({data:{studentId:separate.s.id,academicYearId:year.id,invoiceNumber:randomUUID(),title:'Paiement séparé',type,category,amount,paidAmount:amount,balance:0,status:'PAID',dueDate:new Date()}});await db.payment.create({data:{invoiceId:invoice.id,paymentNumber:randomUUID(),amount,paymentMethod:'CASH'}});}
  const refunded=await pupil(ps,50000,50000);await new RefundsService(db).create({paymentId:refunded.p.id,amount:10000,expectedRefundedAmount:0,refundedOn:new Date().toISOString().slice(0,10),paymentMethod:'CASH',recipient:'Parent test',reason:'Remboursement de test ventilation',mode:'ALREADY_PAID_REGULARIZATION',requestKey:randomUUID()},actor);
  const cancelled=await pupil(ci,40000,20000);await db.payment.create({data:{invoiceId:cancelled.i.id,paymentNumber:randomUUID(),amount:10000,paymentMethod:'CASH',cancelledAt:new Date()}});
  const fullDay=await pupil(ps,65000,65000,{fullDay:true}),unsupported=await pupil(ce2,40000,45000),overpaid=await pupil(ps,50000,51000),legacy=await pupil(ci,77500,77500,{supplies:true});
  const noInvoice=await pupil(ps,50000,0,{}, {cancelledAt:new Date(),balance:0});
  const mismatch=await pupil(ps,50000,0);await db.invoice.update({where:{id:mismatch.i.id},data:{paidAmount:50000,balance:0,status:'PAID'}});
  const before=await snapshot();
  r=await report.report({academicYearId:year.id});assert.equal(r.totals.students,ids.length);assert.equal(r.allocation.reconciledNet,true);assert.equal(r.allocation.overpayment,6000);assert.equal(r.allocation.excludedParallelNet,28500);assert.ok(!r.rows.find(x=>x.id===separate.s.id).allocationNotes.length);
  for(const id of [discounted.s.id,exempt.s.id,fullDay.s.id,unsupported.s.id,mismatch.s.id])assert.equal(r.rows.find(x=>x.id===id).allocationState,'UNAVAILABLE');
  assert.equal(r.rows.find(x=>x.id===refunded.s.id).balance,0);assert.equal(r.rows.find(x=>x.id===refunded.s.id).paid,40000);assert.equal(r.rows.find(x=>x.id===noInvoice.s.id).status,'NOT_INVOICED');
  assert.equal(bucket(r,'LEGACY_SUPPLIES').paid,37500);assert.ok(r.allocation.issues.some(i=>i.reason==='PAYMENTS_MISMATCH'));
  assert.equal(r.allocation.totals.paid+r.allocation.overpayment,r.totals.paid);assert.equal(r.allocation.totals.expected,r.totals.invoiced);assert.equal(r.allocation.totals.balance,r.totals.balance);
  const badge=r.allocation.rubrics.find(b=>b.code==='BADGE');let only=await report.report({academicYearId:year.id,rubric:'BADGE'});assert.equal(only.allocation.rubrics.length,1);assert.deepEqual(only.allocation.rubrics[0],badge);assert.deepEqual(only.totals,r.totals);assert.equal(only.rows.length,r.rows.length);
  const none=await report.report({academicYearId:year.id,cycle:'ELEMENTARY',classroomId:ps.id});assert.equal(none.rows.length,0);assert.equal(none.allocation.totals.paid,0);
  const combined=await report.report({academicYearId:year.id,cycle:'ELEMENTARY',classroomId:ci.id,karate:'false',fullDay:'false',status:'PARTIAL',rubric:'BADGE'});assert.equal(combined.rows.length,3);assert.equal(combined.allocation.rubrics[0].paid,1000);assert.equal(combined.allocation.unallocatedNet,17500);
  await assert.rejects(report.report({academicYearId:year.id,cycle:'bad'}));await assert.rejects(report.report({academicYearId:year.id,rubric:'bad'}));await assert.rejects(report.report({academicYearId:year.id,classroomId:'foreign'}));
  assert.deepEqual(await snapshot(),before);
  if(process.env.ALLOCATION_FIXTURE_FILE)fs.writeFileSync(process.env.ALLOCATION_FIXTURE_FILE,JSON.stringify({report:r,badge:only,combined,year}),{mode:0o600});
  console.log('PASS allocation: both complete packages, partial payments, discounts/exemptions flagged, separate supplies/kimono/monthly fees excluded, cancellations/refunds, overpayments, filters, exact reconciliation and all source rows unchanged');
 }finally{await db.refund.deleteMany({where:{payment:{invoice:{studentId:{in:ids}}}}});await db.businessAudit.deleteMany({where:{actorId:tag}});await db.student.deleteMany({where:{id:{in:ids}}});if(year){await db.classroom.deleteMany({where:{academicYearId:year.id}});await db.academicYear.delete({where:{id:year.id}});}await db.$disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1});
