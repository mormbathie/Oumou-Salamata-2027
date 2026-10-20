jest.mock('../documents/documents.service', () => ({ DocumentsService: class {} }));
jest.mock('../auth/guards/jwt-auth.guard', () => ({ JwtAuthGuard: class {} }));
import { Reflector } from '@nestjs/core';
import { RefundsController } from './refunds.controller';
import { RefundsService, operationDate } from './refunds.service';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { StudentsService } from '../students/students.service';

describe('Refund and departure permissions', () => {
  it('restricts both writes to ADMIN and permits finance staff to read', () => {
    const reflector = new Reflector();
    expect(reflector.get(ROLES_KEY, RefundsController)).toEqual(['ADMIN','DIRECTEUR','COMPTABLE']);
    for (const method of ['create','depart'] as const) expect(reflector.get(ROLES_KEY, RefundsController.prototype[method])).toEqual(['ADMIN']);
  });
  it.each(['DIRECTEUR','COMPTABLE','PARENT','ENSEIGNANT','CONTROLEUR_PRESENCE'])('blocks %s before any write', async role => {
    const db: any = { $transaction: jest.fn() }; const service = new RefundsService(db); const actor = { userId:'test', username:'test',roles:[role] };
    await expect(service.create({} as any,actor)).rejects.toMatchObject({status:403});
    await expect(service.depart('student',{} as any,actor)).rejects.toMatchObject({status:403});
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects invalid and future dates', () => {
    for (const value of ['2026-02-30','not-a-date','2999-01-01']) expect(() => operationDate(value)).toThrow();
  });
  it('never hard deletes a student, even without an invoice', async () => {
    const db: any = { student: { delete: jest.fn() } };
    await expect(new StudentsService(db,{} as any).remove('student')).rejects.toThrow('suppression');
    expect(db.student.delete).not.toHaveBeenCalled();
  });
});
