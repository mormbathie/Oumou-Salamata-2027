jest.mock('../documents/documents.service', () => ({ DocumentsService: class {} }));
import { StudentsService } from './students.service';

describe('Registration adjustments preserve recorded receipts', () => {
  const actor = { userId: 'admin', username: 'admin', roles: ['ADMIN'] };
  function setup(amount=100000, paidAmount=80000) {
    const current:any = { id:'child', dateOfBirth:new Date('2023-01-01'), supplies:false, karate:false, fullDay:false, enrollments:[{id:'enrollment',academicYearId:'year',classroomId:'class',classroom:{id:'class',level:'CI',program:'ELEMENTARY',registrationFee:40000,monthlyTuition:15000}}] };
    const invoice:any = {id:'initial',amount,paidAmount,balance:amount-paidAmount,status:'PARTIAL'};
    const payments = [{id:'receipt',amount:paidAmount,reference:'original',paymentDate:'2026-10-01'}];
    const tx:any = {studentDeparture:{findUnique:jest.fn(async()=>null)},$queryRaw:jest.fn(),student:{findUnique:jest.fn(async()=>current),update:jest.fn(async({data})=>Object.assign(current,data))},invoice:{findMany:jest.fn(async()=>[invoice]),update:jest.fn(async({data})=>Object.assign(invoice,data))}};
    const prisma:any = {student:{findUnique:jest.fn(async()=>current)},$transaction:jest.fn(async fn=>fn(tx))};
    const service = new StudentsService(prisma,{} as any);jest.spyOn(service,'findOne').mockResolvedValue({} as any);
    return {service,invoice,payments,current,tx};
  }
  it('keeps a historic custom invoice unchanged when supplies are selected',async()=>{
    const {service,invoice,payments}=setup();const original=JSON.stringify(payments);
    await service.update('child',{supplies:true},actor);
    expect(invoice).toMatchObject({amount:100000,paidAmount:80000,balance:20000,status:'PARTIAL'});
    expect(JSON.stringify(payments)).toBe(original);
    await service.update('child',{supplies:true},actor);
    expect(invoice.amount).toBe(100000);
  });
  it('does not reprice an unrelated profile edit',async()=>{
    const {service,tx}=setup();await service.update('child',{firstName:'Updated'},actor);expect(tx.invoice.update).not.toHaveBeenCalled();
  });
  it('does not deduct historically billed supplies when the option is cleared',async()=>{
    const {service,current,tx}=setup(77500,77500);current.supplies=true;const invoice=(await tx.invoice.findMany())[0];invoice.registrationOptions=JSON.stringify({supplies:true});
    await service.update('child',{supplies:false},actor);expect(tx.invoice.update).not.toHaveBeenCalled();expect(invoice.amount).toBe(77500);
  });
  it('leaves even ambiguous invoices untouched when only the supplies flag changes',async()=>{
    const {service,tx}=setup();tx.invoice.findMany.mockResolvedValue([{id:'one'},{id:'two'}]);await expect(service.update('child',{supplies:true},actor)).resolves.toBeDefined();expect(tx.invoice.update).not.toHaveBeenCalled();
  });
});
