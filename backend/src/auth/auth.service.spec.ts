import { AuthService } from './auth.service';
import { ForbiddenException } from '@nestjs/common';

jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

describe('AuthService Keycloak session', () => {
  const originalFetch = global.fetch;
  const config: any = { get: (key: string) => key === 'KEYCLOAK_INTERNAL_URL' ? 'http://keycloak:8080' : undefined };
  const prisma: any = { user: { findFirst: jest.fn().mockResolvedValue(null) } };

  afterEach(() => { global.fetch = originalFetch; jest.clearAllMocks(); });

  it('renews an access token using the refresh grant', async () => {
    const response = { ok: true, json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh' }) };
    global.fetch = jest.fn().mockResolvedValue(response);
    const service = new AuthService(config, prisma);

    await expect(service.refresh('old-refresh')).resolves.toMatchObject({ access_token: 'new-access' });
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/protocol/openid-connect/token');
    expect(options.body.get('grant_type')).toBe('refresh_token');
    expect(options.body.get('refresh_token')).toBe('old-refresh');
  });

  it('requires browser password update for a temporary password', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'invalid_grant', error_description: 'Account is not fully set up' }),
    });
    const service = new AuthService(config, prisma);

    await expect(service.directLogin('teacher', 'temporary-password')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});

describe('Second factor at sign-in', () => {
  afterEach(() => jest.restoreAllMocks());
  it('forwards the authenticator code to the identity provider', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ access_token: 'test-token' }) } as Response);
    const service = new AuthService({ get: () => undefined } as any, { user: { findFirst: async () => null } } as any);
    await service.directLogin('awa', 'test-password', '123456');
    expect((fetchMock.mock.calls[0][1]?.body as URLSearchParams).get('totp')).toBe('123456');
  });
  it('refuses a failed password or OTP exchange without issuing a session', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, json: async () => ({ error: 'invalid_grant' }) } as Response);
    const service = new AuthService({ get: () => undefined } as any, {} as any);
    await expect(service.directLogin('awa', 'test-password', '000000')).rejects.toThrow('code de vérification incorrect');
  });
});
