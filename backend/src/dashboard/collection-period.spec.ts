import { collectionPeriod } from './collection-period';
import { DashboardService } from './dashboard.service';
describe('Actual cash receipts',()=>{
  it('uses the school day in Dakar, independent of the server timezone',()=>{
    const result=collectionPeriod({},new Date('2026-10-05T23:30:00Z'));
    expect(result.start).toBe('2026-10-05');expect((result.where as any).paymentDate.gte.toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });
  it.each([
    [{mode:'date',start:'2026-10-03'},'2026-10-03T00:00:00.000Z','2026-10-04T00:00:00.000Z'],
    [{mode:'range',start:'2026-10-01',end:'2026-10-03'},'2026-10-01T00:00:00.000Z','2026-10-04T00:00:00.000Z'],
  ])('includes the whole end day for %j',(filter,start,end)=>{const period=collectionPeriod(filter);expect((period.where as any).paymentDate.gte.toISOString()).toBe(start);expect((period.where as any).paymentDate.lt.toISOString()).toBe(end);});
  it('removes date restrictions for global receipts',()=>expect(collectionPeriod({mode:'all'}).where).toEqual({}));
  it.each([{mode:'date',start:'2026-02-30'},{mode:'range',start:'2026-10-03',end:'2026-10-01'},{mode:'unknown'}])('rejects invalid dates %j',filter=>expect(()=>collectionPeriod(filter)).toThrow());
  it('sums actual payments and preserves categories, including kimono and karate',async()=>{
    const payments=[{amount:80000,invoice:{type:'REGISTRATION',category:null}},{amount:6000,invoice:{type:'OTHER',category:'KIMONO'}},{amount:2000,invoice:{type:'OTHER',category:'KARATE'}}];
    const prisma:any={academicYear:{findFirst:jest.fn(async()=>null)},student:{count:jest.fn(async()=>0),findMany:jest.fn(async()=>[])},classroom:{count:jest.fn(async()=>0),findMany:jest.fn(async()=>[])},parent:{count:jest.fn(async()=>0)},invoice:{findMany:jest.fn(async()=>[{amount:100000,paidAmount:80000,balance:20000,status:'PARTIAL'}])},attendance:{findMany:jest.fn(async()=>[])},payment:{findMany:jest.fn(async args=>args.select?payments:[])}};
    const result=await new DashboardService(prisma).getSummary({mode:'all'});
    expect(result.collection.total).toBe(88000);expect(result.collection.byCategory).toEqual({REGISTRATION:80000,KIMONO:6000,KARATE:2000});expect(result.finances.totalInvoiced).toBe(100000);
  });
});
