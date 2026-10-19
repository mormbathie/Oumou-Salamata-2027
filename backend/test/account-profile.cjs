const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { AccountProfileService } = require('../dist/src/users/account-profile.service');
(async () => {
 const url = new URL(process.env.DATABASE_URL);
 assert.ok(['localhost','127.0.0.1'].includes(url.hostname) && url.pathname === '/as_sakina_test2', 'Dedicated local test database required');
 const db = new PrismaClient(); const id = 'profile-test-'+Date.now();
 try {
  await db.user.create({data:{keycloakId:id,email:id+'@example.test',firstName:'Profile',lastName:'Test'}});
  const service = new AccountProfileService(db);
  await service.update(id,{address:'Dakar',teachingSubjects:'Arabe',role:'ADMIN'});
  assert.deepEqual((await service.get(id)).details,{address:'Dakar',teachingSubjects:'Arabe'});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aencAAAAASUVORK5CYII=','base64');
  await service.upload(id,{buffer:png,mimetype:'image/png'});
  assert.equal((await service.get(id)).hasPhoto,true);
  const chunks=[]; for await (const chunk of (await service.photo(id)).getStream()) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks),png);
  await service.removePhoto(id);
  assert.equal((await service.get(id)).hasPhoto,false);
  await assert.rejects(()=>service.photo(id));
  assert.equal((await db.user.findUnique({where:{keycloakId:id}})).role,'ENSEIGNANT');
  console.log('PASS real database: personal details, role protection, photo storage/read/delete');
 } finally {await db.user.deleteMany({where:{keycloakId:id}});await db.$disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1});
