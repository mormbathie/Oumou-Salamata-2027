const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const url=new URL(process.env.TEST_DATABASE_URL||'postgresql://invalid/invalid');
if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.includes('_test'))throw Error('An isolated local _test database is required.');
const prisma=new PrismaClient({datasources:{db:{url:url.href}}});
async function snapshot(){const data={};for(const model of ['student','parent','enrollment','invoice','payment'])data[model]=await prisma[model].findMany({orderBy:{id:'asc'}});return data;}
(async()=>{
 const before=await snapshot();
 const env={...process.env,DATABASE_URL:url.href};
 for(let i=0;i<2;i++)execFileSync(process.execPath,['prisma/apply-financial-options.cjs'],{env,stdio:'pipe'});
 assert.deepEqual(await snapshot(),before);
 execFileSync('./node_modules/.bin/prisma',['migrate','diff','--from-schema-datasource','prisma/schema.prisma','--to-schema-datamodel','prisma/schema.prisma','--exit-code'],{env,stdio:'pipe'});
 console.log('PASS additive patch repeated twice: existing rows unchanged; no Prisma schema drift.');
})().finally(()=>prisma.$disconnect()).catch(e=>{console.error(e.message);process.exitCode=1});
