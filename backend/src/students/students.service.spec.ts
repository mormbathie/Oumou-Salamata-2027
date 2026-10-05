jest.mock('../documents/documents.service', () => ({ DocumentsService: class {} }));
import { StudentsService } from './students.service';

describe('Individual full-day registration billing', () => {
  const actor = { userId: 'admin', username: 'admin', roles: ['ADMIN'] };
  function setup() {
    const invoices = [
      { studentId: 'child', amount: 50000, balance: 50000, paidAmount: 0, payments: [], type: 'REGISTRATION', status: 'UNPAID' },
      { studentId: 'child', amount: 50000, balance: 40000, paidAmount: 10000, payments: [{}], type: 'REGISTRATION', status: 'PARTIAL' },
      { studentId: 'other', amount: 50000, balance: 50000, paidAmount: 0, payments: [], type: 'REGISTRATION', status: 'UNPAID' },
      { studentId: 'child', amount: 15000, balance: 15000, paidAmount: 0, payments: [], type: 'TUITION', status: 'UNPAID' },
    ];
    const tx = { student: { update: jest.fn() }, invoice: { updateMany: jest.fn(async ({ where, data }) => {
      expect(where.paidAmount).toBe(0);
      expect(where.payments).toEqual({ none: {} });
      for (const invoice of invoices) if (invoice.studentId === where.studentId && invoice.type === where.type && invoice.status === where.status && invoice.paidAmount === 0 && !invoice.payments.length && where.amount.in.includes(invoice.amount) && invoice.amount !== where.amount.not) Object.assign(invoice, data);
    }) } };
    const prisma: any = { student: { findUnique: jest.fn().mockResolvedValue({ id: 'child', dateOfBirth: new Date('2023-01-01'), enrollments: [{ academicYearId: 'year', classroom: { id: 'class', name: 'PS', level: 'PS', program: 'PRESCHOOL', registrationFee: 50000, monthlyTuition: 15000 } }] }) }, $transaction: jest.fn(async fn => fn(tx)) };
    const service = new StudentsService(prisma, {} as any);
    jest.spyOn(service, 'findOne').mockResolvedValue({} as any);
    return { service, invoices, tx };
  }
  it('adjusts only the unpaid initial invoice and restores the base fee on removal', async () => {
    const { service, invoices } = setup();
    await service.update('child', { fullDay: true }, actor);
    expect(invoices.map(i => i.amount)).toEqual([65000, 50000, 50000, 15000]);
    expect(invoices[0].balance).toBe(65000);
    expect(invoices[1].balance).toBe(40000);
    await service.update('child', { fullDay: false }, actor);
    expect(invoices[0].amount).toBe(50000);
  });
  it('does not recalculate billing during an unrelated profile edit', async () => {
    const { service, tx } = setup();
    await service.update('child', { firstName: 'Updated' }, actor);
    expect(tx.invoice.updateMany).not.toHaveBeenCalled();
  });
});
