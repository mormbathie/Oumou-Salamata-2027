import { UsersService } from './users.service';
import { BadRequestException, ConflictException } from '@nestjs/common';

jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

describe('UsersService password changes', () => {
  const config: any = { get: () => undefined };
  const prisma: any = {};
  const auth: any = { directLogin: jest.fn().mockResolvedValue({ access_token: 'valid' }) };

  afterEach(() => jest.clearAllMocks());

  it('sets an administrator reset as a temporary password', async () => {
    const service = new UsersService(config, prisma, auth);
    const request = jest.spyOn(service as any, 'request').mockResolvedValue(null);

    await service.resetPassword('user-id', 'new-password');

    expect(request).toHaveBeenCalledWith('/users/user-id/reset-password', {
      method: 'PUT',
      body: JSON.stringify({ type: 'password', value: 'new-password', temporary: true }),
    });
  });

  it('verifies the current password before changing the signed-in user password', async () => {
    const service = new UsersService(config, prisma, auth);
    const request = jest.spyOn(service as any, 'request').mockResolvedValue(null);

    await service.changeOwnPassword({ userId: 'my-id', username: 'awa' }, 'old-password', 'new-password');

    expect(auth.directLogin).toHaveBeenCalledWith('awa', 'old-password');
    expect(request).toHaveBeenCalledWith('/users/my-id/reset-password', {
      method: 'PUT',
      body: JSON.stringify({ type: 'password', value: 'new-password', temporary: false }),
    });
  });

  it('rejects reuse of the current password', async () => {
    const service = new UsersService(config, prisma, auth);
    await expect(service.changeOwnPassword({ userId: 'my-id', username: 'awa' }, 'same-password', 'same-password')).rejects.toBeInstanceOf(BadRequestException);
    expect(auth.directLogin).not.toHaveBeenCalled();
  });

  it('prevents the administrator from removing their own ADMIN role', async () => {
    const service = new UsersService(config, prisma, auth);
    await expect(service.update('my-id', { email: 'admin@school.test', firstName: 'Admin', lastName: 'Test', role: 'ENSEIGNANT' }, 'my-id')).rejects.toBeInstanceOf(ConflictException);
  });

  it('changes an application role while preserving unrelated Keycloak roles', async () => {
    const service = new UsersService(config, prisma, auth);
    const request = jest.spyOn(service as any, 'request').mockImplementation(async (path: string) => {
      if (path === '/users/target-id') return { id: 'target-id', username: 'teacher', enabled: true };
      if (path === '/users/target-id/role-mappings/realm') return [{ name: 'ADMIN' }, { name: 'offline_access' }];
      if (path === '/roles/ENSEIGNANT') return { name: 'ENSEIGNANT' };
      return null;
    });
    jest.spyOn(service, 'syncLocalUser').mockResolvedValue(undefined as any);

    const result = await service.update('target-id', { email: 'teacher@school.test', firstName: 'Awa', lastName: 'Test', role: 'ENSEIGNANT' }, 'admin-id');

    expect(result.roles).toEqual(['ENSEIGNANT']);
    expect(request).toHaveBeenCalledWith('/users/target-id/role-mappings/realm', {
      method: 'DELETE', body: JSON.stringify([{ name: 'ADMIN' }]),
    });
    expect(request).toHaveBeenCalledWith('/users/target-id/role-mappings/realm', {
      method: 'POST', body: JSON.stringify([{ name: 'ENSEIGNANT' }]),
    });
  });
});
