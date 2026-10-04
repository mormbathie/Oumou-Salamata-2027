import { FinancesService } from './finances.service';

describe('Financial action attribution', () => {
  const actor = { userId: 'keycloak-7', username: 'fatou', firstName: 'Fatou', lastName: 'Diop', roles: ['COMPTABLE'] };

  it('records the authenticated cashier instead of a submitted name', async () => {
    const tx: any = {
      invoice: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'invoice', balance: 0, paidAmount: 100 }),
        update: jest.fn().mockResolvedValue({ id: 'invoice', balance: 0, status: 'PAID' }),
      },
      payment: { create: jest.fn().mockResolvedValue({ id: 'payment' }) },
    };
    const prisma: any = {
      invoice: { findUnique: jest.fn().mockResolvedValue({ id: 'invoice', balance: 100 }) },
      $transaction: (callback: (client: any) => unknown) => callback(tx),
    };
    const service = new FinancesService(prisma);
    await service.recordPayment({ invoiceId: 'invoice', amount: 100, paymentMethod: 'CASH', receivedBy: 'Faux nom' } as any, actor);
    expect(tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ receivedBy: 'Fatou Diop', receivedById: 'keycloak-7', receivedByRole: 'COMPTABLE' }),
    }));
  });

  it('attributes invoices to the authenticated creator', async () => {
    const prisma: any = {
      academicYear: { findFirst: jest.fn().mockResolvedValue({ id: 'year' }) },
      invoice: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: 'invoice' }) },
    };
    const service = new FinancesService(prisma);
    await service.createInvoice({ studentId: 'student', title: 'Scolarité', type: 'TUITION', amount: 100, dueDate: '2026-10-30' }, actor);
    expect(prisma.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ createdById: 'keycloak-7', createdByName: 'Fatou Diop', createdByRole: 'COMPTABLE' }),
    }));
  });
});
