const assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const api=new URL(process.env.TEST_API_URL||'http://127.0.0.1:3003/api/');
const db=new URL(process.env.TEST_DATABASE_URL||'postgresql://invalid/invalid');
if(!['localhost','127.0.0.1'].includes(api.hostname)||!['localhost','127.0.0.1'].includes(db.hostname)||!db.pathname.includes('_test'))throw Error('An explicitly isolated local _test database is required.');
const prisma=new PrismaClient({datasources:{db:{url:db.href}}});
let token;const students=[],classes=[];
async function call(path,data,method='POST',reject=false){const r=await fetch(new URL(path,api),{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});const body=await r.json();if(reject){assert.equal(r.status,400,JSON.stringify(body));return body;}assert.ok(r.ok,path+': '+JSON.stringify(body));return body;}
async function classroom(level,program,registrationFee){const c=await call('classes',{name:'QA financial '+level+' '+Date.now(),level,program,registrationFee,monthlyTuition:15000});classes.push(c.id);return c;}
async function student(c,options={}){const s=await call('students',{firstName:'QA',lastName:'Financial '+students.length,dateOfBirth:'2023-01-01',gender:'MALE',classroomId:c.id,...options});students.push(s.id);return s;}
const initial=s=>s.invoices.find(i=>i.type==='REGISTRATION');
(async()=>{
 const baseline=await prisma.payment.findMany({orderBy:{id:'asc'}});
 token=(await call('auth/login',{username:process.env.TEST_USERNAME,password:process.env.TEST_PASSWORD})).access_token;assert.ok(token);
 const ms=await classroom('MS','PRESCHOOL',50000),ci=await classroom('CI','ELEMENTARY',40500),cp=await classroom('CP','ELEMENTARY',100000);
 for(const [c,options,amount] of [[ms,{},50000],[ms,{transportZone:2},65000],[ms,{transportZone:1,fullDay:true},75000],[ms,{karate:true},52000],[ci,{},40000],[ci,{supplies:true},77500],[ci,{supplies:true,karate:true,transportZone:3},99500]])assert.equal(initial(await student(c,options)).amount,amount);
 console.log('PASS simple registration, CI correction, transport, full-day, karate, supplies, combined options');
 const active=await student(ms,{karate:true});
 for(const level of ['TPS','PS']){const c=await classroom(level,'PRESCHOOL',50000);await call('students',{firstName:'QA',lastName:'Forbidden',dateOfBirth:'2023-01-01',gender:'MALE',classroomId:c.id,karate:true},'POST',true);const s=await student(c);await call('students/'+s.id,{karate:true},'PUT',true);for(const category of ['KIMONO','KARATE'])await call('finances/activities/invoices',{studentId:s.id,category,month:'2026-10'},'POST',true);await call('students/enroll',{studentId:active.id,classroomId:c.id,academicYearId:c.academicYearId},'POST',true);}
 console.log('PASS TPS/PS restrictions for create, edit, enrollment, kimono and karate APIs');
 const old=await student(cp),invoice=initial(old);await call('finances/payments',{invoiceId:invoice.id,amount:80000,paymentMethod:'CASH',paymentDate:'2026-10-02'});
 const receipts=await prisma.payment.findMany({where:{invoiceId:invoice.id}});
 const quote=await call('students/fee-quote',{studentId:old.id,classroomId:cp.id,supplies:true});assert.equal(quote.projectedAmount,137500);assert.equal(quote.projectedBalance,57500);await Promise.all([1,2].map(()=>call('students/'+old.id,{supplies:true},'PUT')));let updated=initial(await call('students/'+old.id,undefined,'GET'));assert.equal(updated.amount,137500);assert.equal(updated.paidAmount,80000);assert.equal(updated.balance,57500);assert.deepEqual(await prisma.payment.findMany({where:{invoiceId:invoice.id}}),receipts);
 await call('students/'+old.id,{supplies:true},'PUT');assert.equal(initial(await call('students/'+old.id,undefined,'GET')).amount,137500);
 console.log('PASS historical payment preserved; supplies adjustment 137500/80000/57500 and idempotent saving');
 const paid=await student(ci,{supplies:true});await call('finances/payments',{invoiceId:initial(paid).id,amount:77500,paymentMethod:'CASH',paymentDate:'2026-10-04'});await call('students/'+paid.id,{supplies:false},'PUT',true);assert.equal((await call('students/'+paid.id,undefined,'GET')).supplies,true);console.log('PASS reducing fees below receipts is rejected atomically');
 const kimono=await call('finances/activities/invoices',{studentId:active.id,category:'KIMONO'});assert.equal(kimono.amount,6000);assert.equal(initial(await call('students/'+active.id,undefined,'GET')).amount,52000);assert.equal((await call('finances/activities/invoices',{studentId:active.id,category:'KIMONO'})).id,kimono.id);
 await call('finances/payments',{invoiceId:kimono.id,amount:6000,paymentMethod:'CASH',paymentDate:'2026-10-03'});
 const monthly=await Promise.all([1,2].map(()=>call('finances/activities/invoices',{studentId:active.id,category:'KARATE',month:'2026-10'})));assert.equal(monthly[0].id,monthly[1].id);assert.equal(monthly[0].amount,2000);
 const double=await Promise.all([1,2].map(()=>fetch(new URL('finances/payments',api),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({invoiceId:monthly[0].id,amount:2000,paymentMethod:'CASH',paymentDate:'2026-10-03'})})));assert.equal(double.filter(r=>r.ok).length,1);assert.equal(double.filter(r=>r.status===400).length,1);assert.equal(await prisma.payment.count({where:{invoiceId:monthly[0].id}}),1);
 console.log('PASS independent kimono 6000, monthly karate 2000, concurrent invoice and receipt deduplication');
 for(const [query,start,end] of [['',new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Dakar',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),null],['?mode=date&start=2026-10-03','2026-10-03',null],['?mode=range&start=2026-10-02&end=2026-10-03','2026-10-02','2026-10-03'],['?mode=all',null,null]]){const summary=await call('dashboard/summary'+query,undefined,'GET');const where=start?{paymentDate:{gte:new Date(start+'T00:00:00Z'),lt:new Date(new Date((end||start)+'T00:00:00Z').getTime()+86400000)}}:{};const sum=await prisma.payment.aggregate({where,_sum:{amount:true}});assert.equal(summary.collection.total,sum._sum.amount||0);if(query.includes('mode=date')){assert.ok(summary.collection.byCategory.KIMONO>=6000);assert.ok(summary.collection.byCategory.KARATE>=2000)}}
 console.log('PASS dashboard actual receipts: today, date, inclusive range, global, category breakdown');
 for(const fullDay of ['true','false']){const list=await call('students?fullDay='+fullDay+'&classId='+ms.id,undefined,'GET');assert.ok(list.every(s=>s.fullDay===(fullDay==='true')))}
 assert.deepEqual(await prisma.payment.findMany({where:{id:{in:baseline.map(p=>p.id)}},orderBy:{id:'asc'}}),baseline);
 console.log('PASS full-day filter and preservation of every pre-existing receipt');
})().finally(async()=>{await prisma.student.deleteMany({where:{id:{in:students},firstName:'QA'}});await prisma.classroom.deleteMany({where:{id:{in:classes},name:{startsWith:'QA financial '}}});await prisma.$disconnect()}).catch(e=>{console.error(e.stack);process.exitCode=1});
