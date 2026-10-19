import { BadRequestException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const PROFILE_FIELDS = {
  address: 300, city: 100, alternatePhone: 30, emergencyContactName: 120,
  emergencyContactPhone: 30, emergencyContactRelationship: 80,
  qualifications: 1000, teachingSubjects: 300, professionalExperience: 2000,
};

export function validateProfileDetails(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Dossier invalide.');
  const result: Record<string, string> = {};
  for (const [key, limit] of Object.entries(PROFILE_FIELDS)) {
    const value = (input as any)[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.length > limit) throw new BadRequestException(`Champ invalide : ${key}.`);
    result[key] = value.trim();
    if (key.toLowerCase().includes('phone') && result[key] && !/^[+\d\s().-]+$/.test(result[key])) throw new BadRequestException('Numéro de téléphone invalide.');
  }
  return result;
}

export function validateProfilePhoto(file: any): string {
  const b = file?.buffer;
  if (!Buffer.isBuffer(b) || !b.length || b.length > 1024 * 1024) throw new BadRequestException('Choisissez une photo JPEG, PNG ou WebP de moins de 1 Mo.');
  const mime = b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
    : b[0] === 255 && b[1] === 216 && b[2] === 255 ? 'image/jpeg'
    : b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : '';
  if (!mime || mime !== file.mimetype) throw new BadRequestException('Format de photo invalide.');
  return mime;
}

@Injectable()
export class AccountProfileService {
  constructor(private readonly prisma: PrismaService) {}
  private async identity(id: string) {
    if (!id || !await this.prisma.user.findUnique({ where: { keycloakId: id }, select: { id: true } })) throw new NotFoundException('Compte introuvable.');
  }
  async get(id: string) {
    await this.identity(id);
    const row = await this.prisma.accountProfile.findUnique({ where: { keycloakId: id }, select: { details: true, photoMime: true, updatedAt: true } });
    return { details: row?.details || {}, hasPhoto: Boolean(row?.photoMime), updatedAt: row?.updatedAt || null };
  }
  async update(id: string, input: unknown) {
    const details = validateProfileDetails(input);
    await this.identity(id);
    await this.prisma.accountProfile.upsert({ where: { keycloakId: id }, create: { keycloakId: id, details }, update: { details } });
    return this.get(id);
  }
  async upload(id: string, file: any) {
    const photoMime = validateProfilePhoto(file);
    await this.identity(id);
    const data = { photo: new Uint8Array(file.buffer), photoMime };
    await this.prisma.accountProfile.upsert({ where: { keycloakId: id }, create: { keycloakId: id, ...data }, update: data });
    return this.get(id);
  }
  async photo(id: string) {
    await this.identity(id);
    const row = await this.prisma.accountProfile.findUnique({ where: { keycloakId: id }, select: { photo: true, photoMime: true } });
    if (!row?.photo || !row.photoMime) throw new NotFoundException('Photo indisponible.');
    return new StreamableFile(Buffer.from(row.photo), { type: row.photoMime, disposition: 'inline' });
  }
  async removePhoto(id: string) {
    await this.identity(id);
    await this.prisma.accountProfile.updateMany({ where: { keycloakId: id }, data: { photo: null, photoMime: null } });
    return this.get(id);
  }
}
