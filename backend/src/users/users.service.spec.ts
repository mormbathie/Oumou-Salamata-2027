import { UsersService } from './users.service';
import { BadRequestException, ConflictException } from '@nestjs/common';

jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

describe('UsersService password changes', () => {
  const config: any = { get: () => undefined };
  const prisma: any = { user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
  const auth: any = { directLogin: jest.fn().mockResolvedValue({ access_token: 'valid' }) };

  afterEach(() => jest.clearAllMocks());

  it('lets an administrator reset a password without forcing an external password page', async () => {
    const service = new UsersService(config, prisma, auth);
    const request = jest.spyOn(service as any, 'request').mockResolvedValue(null);

    await service.resetPassword('user-id', 'new-password');

    expect(request).toHaveBeenCalledWith('/users/user-id/reset-password', {
      method: 'PUT',
      body: JSON.stringify({ type: 'password', value: 'new-password', temporary: false }),
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { keycloakId: 'user-id' }, data: { mustChangePassword: true } });
  });

  it('removes only the external password action on an administrator reset', async () => {
    const service = new UsersService(config, prisma, auth);
    const request = jest.spyOn(service as any, 'request').mockImplementation(async (path: string, init?: RequestInit) =>
      path === '/users/user-id' && !init ? { requiredActions: ['UPDATE_PASSWORD', 'VERIFY_EMAIL'] } : null);
    await service.resetPassword('user-id', 'new-password');
    expect(request).toHaveBeenCalledWith('/users/user-id', {
      method: 'PUT', body: JSON.stringify({ id: 'user-id', requiredActions: ['VERIFY_EMAIL'] }),
    });
  });

  it('verifies the current password before changing the signed-in user password', async () => {
    const service = new UsersService(config, prisma, auth);
    const request = jest.spyOn(service as any, 'request').mockResolvedValue(null);

    await service.changeOwnPassword({ userId: 'my-id', username: 'awa' }, 'old-password', 'new-password');

    expect(auth.directLogin).toHaveBeenCalledWith('awa', 'old-password', undefined);
    expect(request).toHaveBeenCalledWith('/users/my-id/reset-password', {
      method: 'PUT',
      body: JSON.stringify({ type: 'password', value: 'new-password', temporary: false }),
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { keycloakId: 'my-id' }, data: { mustChangePassword: false } });
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

  it('does not claim a newly created address was verified', async () => {
    const service = new UsersService(config, prisma, auth);
    const request = jest.spyOn(service as any, 'request').mockImplementation(async (path: string) => {
      if (path === '/users?username=awa&exact=true') return [{ id: 'new-id', username: 'awa', email: 'awa@example.test' }];
      if (path === '/roles/ENSEIGNANT') return { name: 'ENSEIGNANT' };
      return null;
    });
    jest.spyOn(service, 'syncLocalUser').mockResolvedValue(undefined as any);
    await service.create({ username: 'awa', email: 'awa@example.test', firstName: 'Awa', lastName: 'Test', password: 'temporary-password', role: 'ENSEIGNANT' });
    expect(request).toHaveBeenCalledWith('/users', expect.objectContaining({
      method: 'POST', body: expect.stringContaining('"emailVerified":false'),
    }));
  });

  it('invalidates verification when a user changes their email', async () => {
    const local: any = { user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn().mockResolvedValue({ phone: null }), findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new UsersService(config, local, auth);
    let reads = 0;
    const request = jest.spyOn(service as any, 'request').mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/users/my-id') return init?.method === 'PUT'
        ? null : { id: 'my-id', username: 'awa', email: reads++ ? 'new@example.test' : 'old@example.test', emailVerified: reads === 1, firstName: 'Awa', lastName: 'Test' };
      return null;
    });
    await service.updateOwnProfile({ userId: 'my-id' }, { firstName: 'Awa', lastName: 'Test', email: 'new@example.test', phone: '' });
    expect(request).toHaveBeenCalledWith('/users/my-id', expect.objectContaining({
      method: 'PUT', body: expect.stringContaining('"emailVerified":false'),
    }));
  });
});
