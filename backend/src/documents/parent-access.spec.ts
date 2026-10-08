jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));
import { DocumentsService } from './documents.service';
import { StudentsService } from '../students/students.service';

describe('Parent portal isolation', () => {
  it('requires a verified email and never retrieves files for unverified accounts', async () => {
    const prisma: any = { student: { findFirst: jest.fn() } };
    const service = new DocumentsService(prisma, { get: () => '/tmp' } as any);
    await expect(service.assertParentOwnsStudent('child', { email: 'parent@example.invalid', emailVerified: false })).rejects.toThrow('Vérifiez');
    expect(prisma.student.findFirst).not.toHaveBeenCalled();
  });
  it('checks both the child ID and the authenticated parent email', async () => {
    const prisma: any = { student: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new DocumentsService(prisma, { get: () => '/tmp' } as any);
    await expect(service.assertParentOwnsStudent('other-child', { email: 'parent@example.invalid', emailVerified: true })).rejects.toThrow('introuvable');
    expect(prisma.student.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{id:'other-child',parent:{is:{email:{equals:'parent@example.invalid',mode:'insensitive'}}}}}));
  });
  it('rejects reading another family dossier', async () => {
    const prisma: any = { student: { findUnique: jest.fn().mockResolvedValue({ parent: { email: 'other@example.invalid' }, enrollments: [] }) } };
    const service = new StudentsService(prisma, {} as any);
    await expect(service.findOne('other-child', { roles: ['PARENT'], email: 'parent@example.invalid', emailVerified: true })).rejects.toThrow('non trouvé');
  });
});
