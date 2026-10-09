jest.mock('../auth/guards/jwt-auth.guard', () => ({ JwtAuthGuard: class {} }));
jest.mock('./school-mail.service', () => ({ SchoolMailService: class {} }));
import { Reflector } from '@nestjs/core';
import { FinanceControlService } from './finance-control.service';
import { FinanceControlController } from './finance-control.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
describe('Payment correction access', () => {
  it('allows only ADMIN on both correction endpoints', () => {
    const reflector = new Reflector();
    for (const method of ['correctPayment', 'correctionHistory'] as const) {
      expect(reflector.get(ROLES_KEY, FinanceControlController.prototype[method])).toEqual(['ADMIN']);
    }
  });
  it.each(['DIRECTEUR','COMPTABLE','PARENT','ENSEIGNANT','CONTROLEUR_PRESENCE'])('refuses %s before accessing the database', async role => {
    const prisma: any = { $transaction: jest.fn() };
    await expect(new FinanceControlService(prisma).correctPayment('p', { amount:40000, expectedAmount:50000,expectedPaidAmount:50000,reason:'Correction justifiée' }, { userId:'qa',username:'QA',roles:[role] })).rejects.toMatchObject({status:403});
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
