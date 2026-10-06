// Additive patch for the existing db-push workflow; never accept a data-loss warning.
const {PrismaClient}=require('@prisma/client');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const prisma=new PrismaClient();
(async()=>{
 const [tables]=await prisma.$queryRawUnsafe('SELECT to_regclass(\'"Student"\')::text AS student, to_regclass(\'"Invoice"\')::text AS invoice');
 if(!tables.student&&!tables.invoice){console.log('Fresh database: Prisma will create the schema.');return;}
 if(!tables.student||!tables.invoice)throw Error('Incomplete existing schema; additive patch stopped.');
 const sql=readFileSync(join(__dirname,'patches/20261006-financial-options.sql'),'utf8');
 const statements=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n').split(';').map(s=>s.trim()).filter(s=>s&&s!=='BEGIN'&&s!=='COMMIT');
 await prisma.$transaction(async tx=>{for(const statement of statements)await tx.$executeRawUnsafe(statement);});
 console.log('Additive financial patch applied; historical records unchanged.');
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>prisma.$disconnect());
