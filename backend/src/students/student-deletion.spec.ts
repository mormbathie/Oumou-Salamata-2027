jest.mock('../auth/guards/jwt-auth.guard', () => ({ JwtAuthGuard: class {} }));
jest.mock('../documents/documents.service', () => ({ DocumentsService: class {} }));
import { ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { RolesGuard } from '../auth/guards/roles.guard';
const admin = { userId: 'admin', username: 'Admin', roles: ['ADMIN'] };
describe('Admin-only student deletion', () => {
  function setup() {
    const student: any = { id: 'student', matricule: 'OS-2026-0042', firstName: 'Test', lastName: 'Duplicate',
      documents: [{storageKey:'photo.png'}], enrollments: [], grades: [], reportCards: [], attendances: [], departure: null,
      invoices: [{id:'invoice',amount:50000,payments:[{id:'payment',amount:40000,refunds:[{amount:10000}]}]}] };
    const tx:any = { student: { findUnique: jest.fn(async()=>student), delete:jest.fn() },
      paymentReminder:{findMany:jest.fn(async()=>[]),deleteMany:jest.fn()},
      paymentInstallment:{findMany:jest.fn(async()=>[]),deleteMany:jest.fn()},
      refund:{deleteMany:jest.fn()},studentDeparture:{deleteMany:jest.fn()},businessAudit:{create:jest.fn()},$queryRaw:jest.fn() };
    const prisma:any = {$transaction:jest.fn(async fn=>fn(tx))};
    const documents:any = {removeStoredFiles:jest.fn()};
    return {service:new StudentsService(prisma,documents),tx,prisma,documents,student};
  }
  it.each(['DIRECTEUR','COMPTABLE','ENSEIGNANT','PARENT','CONTROLEUR_PRESENCE'])('rejects %s before database access',async role=>{
    const {service,prisma}=setup();const user={...admin,roles:[role]};
    await expect(service.deletionPreview('student',user)).rejects.toThrow(ForbiddenException);
    await expect(service.remove('student',{},user)).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each(['remove','deletionPreview'] as const)('protects HTTP route %s',method=>{
    const guard=new RolesGuard(new Reflector());
    for(const role of ['DIRECTEUR','COMPTABLE','ADMIN']){
      const ctx:any={getHandler:()=>StudentsController.prototype[method],getClass:()=>StudentsController,
        switchToHttp:()=>({getRequest:()=>({user:{roles:[role]}})})};
      if(role==='ADMIN')expect(guard.canActivate(ctx)).toBe(true);
      else expect(()=>guard.canActivate(ctx)).toThrow(ForbiddenException);
    }
  });
  it('requires reason and exact matricule',async()=>{
    const {service,tx}=setup();await expect(service.remove('student',{},admin)).rejects.toThrow(BadRequestException);
    const p=await service.deletionPreview('student',admin);
    await expect(service.remove('student',{reason:'Doublon confirmé',matricule:'wrong',confirmationToken:p.confirmationToken},admin)).rejects.toThrow(BadRequestException);
    expect(tx.student.delete).not.toHaveBeenCalled();
  });
  it('rejects stale payment preview',async()=>{
    const {service,student,tx}=setup();const p=await service.deletionPreview('student',admin);student.invoices[0].payments[0].amount=50000;
    await expect(service.remove('student',{reason:'Doublon confirmé',matricule:p.matricule,confirmationToken:p.confirmationToken},admin)).rejects.toThrow(ConflictException);
    expect(tx.student.delete).not.toHaveBeenCalled();
  });
  it('audits snapshot and removes documents after commit',async()=>{
    const {service,tx,documents}=setup();const p=await service.deletionPreview('student',admin);
    expect(p).toMatchObject({invoiced:50000,received:40000,refunded:10000,counts:{payments:1,refunds:1}});
    await expect(service.remove('student',{reason:'Doublon confirmé',matricule:p.matricule,confirmationToken:p.confirmationToken},admin)).resolves.toEqual({id:'student',deleted:true});
    const audit=tx.businessAudit.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({action:'STUDENT_DELETED',actorId:'admin',reason:'Doublon confirmé'});
    expect(JSON.parse(audit.details).student.invoices[0].payments[0].amount).toBe(40000);
    expect(tx.businessAudit.create.mock.invocationCallOrder[0]).toBeLessThan(tx.student.delete.mock.invocationCallOrder[0]);
    expect(tx.student.delete.mock.invocationCallOrder[0]).toBeLessThan(documents.removeStoredFiles.mock.invocationCallOrder[0]);
    expect(documents.removeStoredFiles).toHaveBeenCalledWith(['photo.png']);
  });
  it('keeps documents on transaction failure',async()=>{
    const {service,tx,documents}=setup();const p=await service.deletionPreview('student',admin);tx.student.delete.mockRejectedValue(new Error('DB unavailable'));
    await expect(service.remove('student',{reason:'Doublon confirmé',matricule:p.matricule,confirmationToken:p.confirmationToken},admin)).rejects.toThrow('DB unavailable');
    expect(documents.removeStoredFiles).not.toHaveBeenCalled();
  });
});
