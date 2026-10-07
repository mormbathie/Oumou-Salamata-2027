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
  for (const key of ['karate','eveningClasses','fullDay','supplies']) if (data[key] !== undefined) {
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
export function validateProgramAge(_program: string | null | undefined, birth: string | Date) {
  const date = new Date(birth);
  if (!Number.isFinite(date.getTime()) || date > new Date()) throw new BadRequestException('Date de naissance invalide.');
}
export const optionTariffs = { elementaryRegistration: 40000, supplies: 37500, karateRegistration: 2000, karateMonthly: 2000, kimono: 6000, fullDayRegistration: 65000, elementaryFullDaySupplement: 25000, fullDayMonthly: 35000, transport: { 1: 10000, 2: 15000, 3: 20000 } };
export type FeeOptions = { fullDay?: boolean; supplies?: boolean; karate?: boolean; transportZone?: number | null };
export type FeeClass = { level?: string; program?: string | null; registrationFee: number; monthlyTuition: number };
export const elementaryClass = (classroom: FeeClass) => classroom.program === 'ELEMENTARY' || ['CI','CP','CE1','CE2','CM1','CM2'].includes(classroom.level || '');
export function validateOptionsForClass(student: FeeOptions, classroom?: FeeClass | null) {
  if (!classroom) {
    if (student.karate || student.supplies || student.fullDay) throw new BadRequestException('Choisissez une classe pour ces options.');
    return;
  }
  if (student.karate && ['TPS', 'PS'].includes(classroom.level || '')) throw new BadRequestException('Karaté interdit en TPS et PS.');
  if (student.supplies && !elementaryClass(classroom)) throw new BadRequestException('Fournitures réservées à l’élémentaire.');
  if (student.fullDay && !(classroom.program === 'PRESCHOOL' || ['TPS','PS','MS','GS','CI','CP','CE1'].includes(classroom.level || ''))) throw new BadRequestException('Journée continue réservée à la maternelle, au CI, au CP et au CE1.');
}
export function schoolFees(student: FeeOptions, classroom: FeeClass) {
  const preschool = classroom.program === 'PRESCHOOL' || ['TPS','PS','MS','GS'].includes(classroom.level || '');
  const fullDay = student.fullDay && (preschool || ['CI','CP','CE1'].includes(classroom.level || ''));
  // Correct the former standard CI tariff prospectively; preserve custom class tariffs.
  const base = classroom.level === 'CI' && classroom.registrationFee === 40500 ? optionTariffs.elementaryRegistration : classroom.registrationFee;
  const registrationBase = fullDay ? (preschool ? optionTariffs.fullDayRegistration : base + optionTariffs.elementaryFullDaySupplement) : base;
  const transport = optionTariffs.transport[student.transportZone || 0] || 0;
  const karate = student.karate ? optionTariffs.karateRegistration : 0;
  const supplies = student.supplies && elementaryClass(classroom) ? optionTariffs.supplies : 0;
  return { registrationFee: registrationBase + transport + karate + supplies,
    monthlyTuition: fullDay ? optionTariffs.fullDayMonthly : classroom.monthlyTuition };
}

// Keep a billing snapshot: legacy transport/karate flags were never charged automatically.
export function registrationAdjustment(current: FeeOptions, next: FeeOptions, previousClass: FeeClass, nextClass: FeeClass,
  invoice: { amount: number; registrationOptions?: string | null }) {
  let billed: FeeOptions;
  if (invoice.registrationOptions) {
    try { billed = JSON.parse(invoice.registrationOptions); }
    catch { throw new BadRequestException('Référence tarifaire illisible : faites vérifier la facture.'); }
    if (!billed || typeof billed !== 'object' || Array.isArray(billed)) throw new BadRequestException('Référence tarifaire invalide.');
    billed = schoolOptions(billed);
  } else {
    billed = { fullDay: Boolean(current.fullDay && invoice.amount === optionTariffs.fullDayRegistration), supplies: false, karate: false, transportZone: null };
  }
  const after = { ...billed };
  for (const key of ['fullDay','supplies','karate','transportZone'] as const) {
    if ((current[key] || false) !== (next[key] || false)) (after as any)[key] = next[key] ?? (key === 'transportZone' ? null : false);
  }
  return { delta: schoolFees(after, nextClass).registrationFee - schoolFees(billed, previousClass).registrationFee,
    registrationOptions: JSON.stringify(after) };
}
export function registrationSnapshot(student: FeeOptions) {
  return JSON.stringify({ fullDay: !!student.fullDay, supplies: !!student.supplies, karate: !!student.karate, transportZone: student.transportZone ?? null });
}
