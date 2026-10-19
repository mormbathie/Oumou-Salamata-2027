import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StaffAttendanceService } from './staff-attendance.service';
import { ActingUser, actorStamp } from '../audit/actor';

export function validateDoorLocation(input: { latitude: number; longitude: number; accuracy: number }, config: { latitude: number; longitude: number; radiusMeters: number }) {
  if (![input?.latitude,input?.longitude,input?.accuracy].every(Number.isFinite) || Math.abs(input.latitude)>90 || Math.abs(input.longitude)>180 || input.accuracy<=0 || input.accuracy>Math.min(50,config.radiusMeters/2)) throw new BadRequestException('Position imprécise ou invalide. Activez la localisation précise près de la porte, ou contactez le contrôleur.');
  const rad = (n: number) => n * Math.PI / 180;
  const a = Math.sin(rad(input.latitude-config.latitude)/2)**2 + Math.cos(rad(config.latitude))*Math.cos(rad(input.latitude))*Math.sin(rad(input.longitude-config.longitude)/2)**2;
  const distance = 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));
  if (distance + input.accuracy > config.radiusMeters) throw new ForbiddenException('Vous devez être à proximité de l’entrée de l’école pour badger.');
}
@Injectable()
export class DoorBadgeService {
  constructor(private readonly prisma: PrismaService, private readonly staff: StaffAttendanceService) {}
  private manager(actor: ActingUser) { if (!actor.roles?.some(r => ['ADMIN','DIRECTEUR'].includes(r))) throw new ForbiddenException('Configuration réservée à la direction.'); }
  async settings(actor: ActingUser) {
    this.manager(actor);
    return this.prisma.staffDoorBadge.upsert({ where: { id: 1 }, update: {}, create: { id: 1, token: randomBytes(24).toString('hex') } });
  }
  async configure(data: { enabled: boolean; latitude?: number; longitude?: number; radiusMeters: number; rotate?: boolean }, actor: ActingUser) {
    this.manager(actor); const author=actorStamp(actor);
    if (typeof data?.enabled !== 'boolean' || !Number.isInteger(data.radiusMeters) || data.radiusMeters<50 || data.radiusMeters>300 || (data.rotate !== undefined && typeof data.rotate !== 'boolean')) throw new BadRequestException('Périmètre autorisé : 50 à 300 mètres.');
    if ((data.enabled || data.latitude !== undefined || data.longitude !== undefined) && (![data.latitude,data.longitude].every(Number.isFinite) || Math.abs(data.latitude!)>90 || Math.abs(data.longitude!)>180)) throw new BadRequestException('Enregistrez la position de la porte avant l’activation.');
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261019)`;
      const current=await tx.staffDoorBadge.findUnique({where:{id:1}});
      const update={ enabled:data.enabled, radiusMeters:data.radiusMeters, ...(data.latitude !== undefined ? {latitude:data.latitude,longitude:data.longitude} : {}), ...(data.rotate ? {token:randomBytes(24).toString('hex')} : {}) };
      const saved=await tx.staffDoorBadge.upsert({where:{id:1},update,create:{id:1,token:randomBytes(24).toString('hex'),...update}});
      await tx.businessAudit.create({data:{action:'STAFF_DOOR_CONFIGURED',entityId:'staff-door',actorId:author.id,actorName:author.name,actorRole:author.role,details:JSON.stringify({enabled:saved.enabled,radiusMeters:saved.radiusMeters,codeRotated:!current||!!data.rotate})}});
      return saved;
    });
  }
  async punch(data: { code: string; action: 'arrival'|'departure'; latitude: number; longitude: number; accuracy: number }, actor: ActingUser) {
    if (!actor.roles?.includes('ENSEIGNANT')) throw new ForbiddenException('Pointage personnel réservé aux professeurs.');
    if (!data || !['arrival','departure'].includes(data.action) || typeof data.code !== 'string' || !/^ASDOOR1:[0-9a-f]{48}$/.test(data.code)) throw new BadRequestException('QR code ou action invalide.');
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261019)`;
      const config=await tx.staffDoorBadge.findUnique({where:{id:1}});
      if (!config?.enabled || config.latitude === null || config.longitude === null) throw new BadRequestException('Le pointage à la porte n’est pas encore activé par la direction.');
      const received=Buffer.from(data.code.slice(8)); const expected=Buffer.from(config.token);
      if (received.length !== expected.length || !timingSafeEqual(received,expected)) throw new ForbiddenException('Ce QR code a été remplacé. Scannez celui affiché à la porte.');
      validateDoorLocation(data,{latitude:config.latitude,longitude:config.longitude,radiusMeters:config.radiusMeters});
      const teacher=await tx.user.findUnique({where:{keycloakId:actor.userId}});
      if (!teacher || teacher.role !== 'ENSEIGNANT') throw new ForbiddenException('Compte professeur introuvable. Contactez la direction.');
      return this.staff.recordPunch(tx,teacher,actor,data.action);
    });
  }
}
