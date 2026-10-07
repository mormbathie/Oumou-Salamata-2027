const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { StudentsService } = require('../dist/src/students/students.service');
(async () => {
 if (!process.env.DATABASE_URL?.includes('_test')) throw new Error('An isolated test database is required');
 const db = new PrismaClient(); const service = new StudentsService(db, {});
 const ids = []; const parents = [];
 try {
  const classroom = await db.classroom.findFirst(); const year = await db.academicYear.findFirst({where:{isCurrent:true}}); assert.ok(classroom && year);
  const actor = {userId:'qa-atomicity', username:'QA'};
  const input = {firstName:'QA atomic '+randomUUID(),lastName:'Test',gender:'MALE',dateOfBirth:'2018-01-01',classroomId:classroom.id,parentData:{firstName:'QA parent',lastName:'Test',phone:'000000000'}};
  const counts = await Promise.all([db.student.count(),db.parent.count(),db.enrollment.count(),db.invoice.count()]);
  await assert.rejects(service.create({...input,academicYearId:randomUUID()},actor));
  assert.deepEqual(await Promise.all([db.student.count(),db.parent.count(),db.enrollment.count(),db.invoice.count()]),counts);
  const students = await Promise.all([service.create(input,actor),service.create({...input,firstName:input.firstName+' 2'},actor)]);
  for (const s of students) {ids.push(s.id);parents.push(s.parentId)}
  assert.notEqual(students[0].matricule,students[1].matricule);
  const invoices = await db.invoice.findMany({where:{studentId:{in:ids}}});assert.equal(invoices.length,2);assert.notEqual(invoices[0].invoiceNumber,invoices[1].invoiceNumber);
  await db.student.delete({where:{id:ids[0]}});
  const third = await service.create({...input,firstName:input.firstName+' 3'},actor);ids.push(third.id);parents.push(third.parentId);
  assert.ok(!students.some(s=>s.matricule===third.matricule));
  console.log('PASS: failed registration rolls back parent/student/enrollment; parallel registrations and deletion preserve unique numbering');
 } finally {await db.student.deleteMany({where:{id:{in:ids}}});await db.parent.deleteMany({where:{id:{in:parents}}});await db.$disconnect()}
})().catch(e=>{console.error(e);process.exit(1)});
