import { BadRequestException } from '@nestjs/common';
export const PROGRAMS = ['PRESCHOOL','ELEMENTARY','FULL_DAY','DAARA_DAY','DAARA_BOARDING','FRANCO_ARAB_BOARDING'];
export const LEVELS = ['TPS','PS','MS','GS','CI','CP','CE1','CE2','CM1','CM2','DAARA'];
const ITEMS = ['BIRTH_CERTIFICATE','IDJI_BOOK','QURAN_JUZZ','MATTRESS_SHEETS','BOARDING_KIT','SCHOOL_SUPPLIES','DIAPERS'];
export function schoolOptions(data: Record<string, unknown>) {
  const result: Record<string, any> = {};
  if (data.transportZone !== undefined) {
    if (data.transportZone !== null && ![1,2,3].includes(data.transportZone as number)) throw new BadRequestException('Zone de transport invalide.');
    result.transportZone = data.transportZone;
  }
  for (const key of ['karate','eveningClasses']) if (data[key] !== undefined) {
    if (typeof data[key] !== 'boolean') throw new BadRequestException('Option scolaire invalide.');
    result[key] = data[key];
  }
  for (const key of ['emergencyContactName','emergencyContactPhone','healthNotes','schoolItemsProvided']) if (data[key] !== undefined) {
    if (data[key] !== null && typeof data[key] !== 'string') throw new BadRequestException('Renseignement scolaire invalide.');
    const value = String(data[key] || '').trim();
    if (value.length > (key === 'healthNotes' ? 2000 : 400)) throw new BadRequestException('Renseignement trop long.');
    if (key === 'schoolItemsProvided' && value.split(',').filter(Boolean).some(item => !ITEMS.includes(item))) throw new BadRequestException('Pièce du dossier invalide.');
    result[key] = value || null;
  }
  return result;
}
export function validateProgramAge(program: string | null | undefined, birth: string | Date) {
  const date = new Date(birth);
  if (!Number.isFinite(date.getTime()) || date > new Date()) throw new BadRequestException('Date de naissance invalide.');
  if (['DAARA_DAY','DAARA_BOARDING','FRANCO_ARAB_BOARDING'].includes(program || '')) {
    const latestBirth = new Date(); latestBirth.setFullYear(latestBirth.getFullYear()-6);
    if (date > latestBirth) throw new BadRequestException('Cette formule accueille les enfants à partir de six ans.');
  }
}
