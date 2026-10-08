const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');const {PrismaClient}=require('@prisma/client');const {AcademicTransitionService}=require('../dist/src/classes/academic-transition.service');
(async()=>{
 if(!process.env.DATABASE_URL?.includes('_test'))throw Error('Isolated test DB required');
 const db=new PrismaClient(),service=new AcademicTransitionService(db),actor={userId:'qa',username:'QA',roles:['DIRECTEUR']},tag=randomUUID();let source,target,student;
 const active=await db.academicYear.findMany({where:{isCurrent:true}});
 try{
  await db.academicYear.updateMany({where:{isCurrent:true},data:{isCurrent:false}});
  source=await db.academicYear.create({data:{name:'QA-'+tag,startDate:new Date('2030-01-01'),endDate:new Date('2030-12-31'),isCurrent:true}});
  const room=await db.classroom.create({data:{name:'QA '+tag,level:'PS',program:'PRESCHOOL',academicYearId:source.id,registrationFee:50000,monthlyTuition:15000}});
  student=await db.student.create({data:{matricule:'QA-'+tag,firstName:'QA',lastName:tag,gender:'MALE',dateOfBirth:new Date('2025-01-01')}});
  const old=await db.enrollment.create({data:{studentId:student.id,classroomId:room.id,academicYearId:source.id}});
  target=await service.prepare({name:'2031-2032',startDate:'2031-01-01',endDate:'2031-12-31'},actor);
  assert.equal((await db.academicYear.findUnique({where:{id:source.id}})).isCurrent,true);
  const preview=await service.preview(target.id);assert.equal(preview.year.classrooms.length,1);assert.equal(preview.year.classrooms[0].monthlyTuition,15000);
  await assert.rejects(service.activate(target.id,actor));
  await assert.rejects(service.enroll(target.id,[{studentId:student.id,classroomId:room.id}],actor));
  const rows=[{studentId:student.id,classroomId:preview.year.classrooms[0].id}];
  await service.enroll(target.id,rows,actor);await service.enroll(target.id,rows,actor);
  assert.equal(await db.enrollment.count({where:{studentId:student.id}}),2);
  await service.activate(target.id,actor);
  assert.equal(await db.academicYear.count({where:{isCurrent:true}}),1);
  assert.equal((await db.enrollment.findUnique({where:{id:old.id}})).classroomId,room.id);
  assert.equal(await db.invoice.count({where:{studentId:student.id}}),0,'No invoices generated implicitly');
  console.log('PASS: isolated year preparation, valid target classes, idempotent reenrollment, history preservation, explicit activation');
 }finally{
  await db.businessAudit.deleteMany({where:{entityId:{in:[source?.id,target?.id].filter(Boolean)}}});
  if(student)await db.student.delete({where:{id:student.id}});
  await db.academicYear.deleteMany({where:{id:{in:[source?.id,target?.id].filter(Boolean)}}});
  await db.academicYear.updateMany({where:{id:{in:active.map(x=>x.id)}},data:{isCurrent:true}});
  await db.$disconnect();
 }
})().catch(e=>{console.error(e);process.exit(1)});
