import { allocatePackage, packageFor, prorata, registrationCycle, registrationPackages } from './registration-allocation';
const ps={level:'PS',program:'PRESCHOOL',registrationFee:50000,monthlyTuition:15000},ci={level:'CI',program:'ELEMENTARY',registrationFee:40000,monthlyTuition:15000};
const invoice=(amount:number,options:any={})=>({amount,registrationOptions:JSON.stringify({fullDay:false,karate:false,supplies:false,transportZone:null,...options})});
describe('Validated registration allocation — read only',()=>{
 it('has exact validated totals and paper at 2000 with no hidden negative adjustment',()=>{
  expect(registrationPackages.PRESCHOOL.reduce((s,l)=>s+l.amount,0)).toBe(50000);
  expect(registrationPackages.ELEMENTARY.reduce((s,l)=>s+l.amount,0)).toBe(40000);
  expect(registrationPackages.ELEMENTARY.find(l=>l.code==='PAPER')?.amount).toBe(2000);
 });
 it('gives the requested fully-paid badge/registration/paper examples for ten pupils',()=>{
  for(const [c,total,badge] of [[ps,50000,500],[ci,40000,1000]] as const){const p=packageFor(invoice(total),c,{});expect(p.reason).toBeUndefined();const a=allocatePackage(p.lines,total,0);expect(a.lines.find(l=>l.code==='BADGE')!.paid*10).toBe(badge*10);expect(a.lines.find(l=>l.code==='REGISTRATION')!.paid*10).toBe(70000);}
  const a=allocatePackage(registrationPackages.ELEMENTARY,40000,0);expect(a.lines.find(l=>l.code==='PAPER')!.paid*10).toBe(20000);
 });
 it('allocates 20000 out of 40000 to badge=500 and keeps every FCFA accounted for',()=>{
  const a=allocatePackage(registrationPackages.ELEMENTARY,20000,0);expect(a.lines.find(l=>l.code==='BADGE')!.paid).toBe(500);expect(a.lines.reduce((s,l)=>s+l.paid,0)).toBe(20000);expect(a.lines.reduce((s,l)=>s+l.balance,0)).toBe(20000);
 });
 it('uses exact, deterministic largest remainders, even near the safe integer boundary',()=>{
  expect(prorata(2,[1,1,1])).toEqual([1,1,0]);
  expect(prorata(9007199254740000,[4503599627370000,4503599627370001])).toEqual([4503599627370000,4503599627370000]);
  for(let amount=0;amount<=50000;amount+=137){const a=allocatePackage(registrationPackages.PRESCHOOL,amount,Math.floor(amount/3));expect(a.lines.reduce((s,l)=>s+l.paid,0)).toBe(amount-Math.floor(amount/3));expect(a.lines.every(l=>l.paid>=0&&l.balance>=0&&l.refunded>=0&&l.amount===l.paid+l.balance+l.refunded)).toBe(true);}
 });
 it('caps overpayments and does not reopen a debt after a refund',()=>{
  let a=allocatePackage(registrationPackages.ELEMENTARY,45000,0);expect(a.overpayment).toBe(5000);expect(a.lines.reduce((s,l)=>s+l.paid,0)).toBe(40000);
  a=allocatePackage(registrationPackages.ELEMENTARY,40000,10000);expect(a.lines.reduce((s,l)=>s+l.balance,0)).toBe(0);expect(a.lines.reduce((s,l)=>s+l.refunded,0)).toBe(10000);expect(a.lines.reduce((s,l)=>s+l.paid,0)).toBe(30000);
  a=allocatePackage(registrationPackages.ELEMENTARY,45000,2000);expect(a.overpayment).toBe(3000);expect(a.refundOutsidePackage).toBe(2000);expect(a.lines.reduce((s,l)=>s+l.refunded,0)).toBe(0);
 });
 it('excludes new separate supplies but recognizes exactly recorded legacy bundled supplies',()=>{
  expect(packageFor(invoice(40000,{supplies:true,suppliesSeparate:true}),ci,{}).lines.some(l=>l.code==='LEGACY_SUPPLIES')).toBe(false);
  const legacy=packageFor(invoice(77500,{supplies:true}),ci,{});expect(legacy.lines.find(l=>l.code==='LEGACY_SUPPLIES')?.amount).toBe(37500);
  expect(packageFor(invoice(40000,{supplies:true}),ci,{}).reason).toBe('CUSTOM_AMOUNT');
 });
 it('does not invent discounts, exemptions, full-day contents or unsupported class tariffs',()=>{
  for(const amount of [0,35000,45000])expect(packageFor(invoice(amount),ci,{}).reason).toBe('CUSTOM_AMOUNT');
  expect(packageFor(invoice(65000,{fullDay:true}),ps,{}).reason).toBe('FULL_DAY');
  expect(packageFor(invoice(40000),{...ci,level:'CE2'},{}).reason).toBe('LEVEL_UNVERIFIED');
  expect(packageFor(invoice(60000),{...ci,registrationFee:60000},{}).reason).toBe('CUSTOM_CLASS');
  expect(packageFor(invoice(60000),{...ci,program:'DAARA_DAY'},{}).reason).toBe('OTHER_PROGRAM');
 });
 it('handles null snapshots conservatively and never uses changed current flags to reprice a snapshot',()=>{
  expect(packageFor({amount:40000,registrationOptions:null},ci,{}).lines).toHaveLength(9);
  expect(packageFor({amount:40000,registrationOptions:null},ci,{fullDay:true}).reason).toBe('BAD_SNAPSHOT');
  expect(packageFor(invoice(40000),ci,{fullDay:true,karate:true,supplies:true}).reason).toBeUndefined();
  expect(packageFor({amount:40000,registrationOptions:'null'},ci,{}).reason).toBe('BAD_SNAPSHOT');
  expect(registrationCycle({...ps,level:'TPS',program:'ELEMENTARY'})).toBe('PRESCHOOL');
 });
});
