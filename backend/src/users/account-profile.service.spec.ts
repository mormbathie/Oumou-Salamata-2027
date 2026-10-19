import { AccountProfileService, validateProfileDetails, validateProfilePhoto } from './account-profile.service';

describe('Account profiles', () => {
  it('keeps only personal fields and never accepts permission changes', () => {
    expect(validateProfileDetails({ city: ' Dakar ', role: 'ADMIN', keycloakId: 'other' })).toEqual({ city: 'Dakar' });
  });
  it('rejects invalid or oversized personal information', () => {
    expect(() => validateProfileDetails({ address: 'x'.repeat(301) })).toThrow();
    expect(() => validateProfileDetails({ emergencyContactPhone: 'not a phone' })).toThrow();
    expect(() => validateProfileDetails({ city: {} })).toThrow();
  });
  it('rejects SVG, disguised uploads and oversized photos', () => {
    expect(() => validateProfilePhoto({ buffer: Buffer.from('<svg/>'), mimetype: 'image/png' })).toThrow();
    expect(() => validateProfilePhoto({ buffer: Buffer.alloc(1024 * 1024 + 1), mimetype: 'image/jpeg' })).toThrow();
    expect(validateProfilePhoto({ buffer: Buffer.from([255,216,255,224]), mimetype: 'image/jpeg' })).toBe('image/jpeg');
    expect(() => validateProfilePhoto({ buffer: Buffer.from([255,216,255,224]), mimetype: 'image/png' })).toThrow();
  });
  it('uses only the authenticated account identifier to save a file', async () => {
    const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'local-id' }) }, accountProfile: { upsert: jest.fn(), findUnique: jest.fn().mockResolvedValue({ details: { city: 'Dakar' } }) } };
    await new AccountProfileService(prisma).update('authenticated-id', { city: 'Dakar', keycloakId: 'victim' });
    expect(prisma.accountProfile.upsert).toHaveBeenCalledWith({ where: { keycloakId: 'authenticated-id' }, create: { keycloakId: 'authenticated-id', details: { city: 'Dakar' } }, update: { details: { city: 'Dakar' } } });
  });
  it('returns personal details without downloading the stored photo', async () => {
    const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'local' }) }, accountProfile: { findUnique: jest.fn().mockResolvedValue({ details: {}, photoMime: 'image/jpeg' }) } };
    expect((await new AccountProfileService(prisma).get('self')).hasPhoto).toBe(true);
    expect(prisma.accountProfile.findUnique).toHaveBeenCalledWith(expect.objectContaining({ select: { details: true, photoMime: true, updatedAt: true } }));
  });
  it('rejects profiles without a synchronized account', async () => {
    const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue(null) }, accountProfile: { upsert: jest.fn() } };
    await expect(new AccountProfileService(prisma).update('missing', {})).rejects.toThrow('Compte introuvable');
    expect(prisma.accountProfile.upsert).not.toHaveBeenCalled();
  });
});
