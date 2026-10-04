import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ActingUser, actorStamp } from '../audit/actor';

@Injectable()
export class StaffAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private date(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Date invalide (AAAA-MM-JJ).');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Date invalide.');
    return date;
  }

  private async settings() {
    return this.prisma.schoolCalendarSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  }

  private localTime(now: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return { date: `${values.year}-${values.month}-${values.day}`, minutes: Number(values.hour) * 60 + Number(values.minute) };
  }

  private async assertWorkingDay(date: Date, restDays: string) {
    if (this.restDays(restDays).includes(date.getUTCDay())) throw new BadRequestException('Ce jour est un jour de repos.');
    const holiday = await this.prisma.schoolHoliday.findUnique({ where: { date } });
    if (holiday) throw new BadRequestException(`Ce jour est férié : ${holiday.name}.`);
  }

  async myCard(actor: { userId: string }) {
    const user = await this.prisma.user.findUnique({ where: { keycloakId: actor.userId }, include: { staffCard: true } });
    if (!user || user.role !== Role.ENSEIGNANT) throw new ForbiddenException('Carte réservée aux professeurs.');
    if (user.staffCard) return { code: `ASSTAFF1:${user.staffCard.token}` };
    const token = randomBytes(24).toString('hex');
    const saved = await this.prisma.staffQrCard.upsert({ where: { teacherId: user.id }, update: {}, create: { teacherId: user.id, token } });
    return { code: `ASSTAFF1:${saved.token}` };
  }

  async scan(code: string, actor: ActingUser) {
    const operator = actorStamp(actor);
    if (!/^ASSTAFF1:[0-9a-f]{48}$/.test(code || '')) throw new BadRequestException('QR code de professeur invalide.');
    const card = await this.prisma.staffQrCard.findUnique({ where: { token: code.slice(9) }, include: { teacher: true } });
    const teacher = card?.teacher;
    if (!teacher || teacher.role !== Role.ENSEIGNANT) throw new NotFoundException('Professeur introuvable.');
    const settings = await this.settings();
    const now = new Date();
    const local = this.localTime(now, settings.timeZone);
    const date = this.date(local.date);
    await this.assertWorkingDay(date, settings.restDays);
    const existing = await this.prisma.staffAttendance.findUnique({ where: { teacherId_date: { teacherId: teacher.id, date } } });
    if (existing?.checkOutAt) return { teacher: this.safeTeacher(teacher), attendance: existing, event: 'already-complete' };
    if (existing?.checkInAt) {
      const attendance = await this.prisma.staffAttendance.update({ where: { id: existing.id }, data: { checkOutAt: now, checkOutById: operator.id, checkOutByName: operator.name } });
      return { teacher: this.safeTeacher(teacher), attendance, event: 'departure' };
    }
    const [hour, minute] = settings.startTime.split(':').map(Number);
    const minutesLate = Math.max(0, local.minutes - (hour * 60 + minute));
    const attendance = await this.prisma.staffAttendance.upsert({
      where: { teacherId_date: { teacherId: teacher.id, date } },
      update: { checkInAt: now, status: minutesLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT, minutesLate, checkInById: operator.id, checkInByName: operator.name },
      create: { teacherId: teacher.id, date, checkInAt: now, status: minutesLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT, minutesLate, checkInById: operator.id, checkInByName: operator.name },
    });
    return { teacher: this.safeTeacher(teacher), attendance, event: 'arrival' };
  }

  async myHistory(actor: { userId: string }, start?: string, end?: string) {
    const teacher = await this.prisma.user.findUnique({ where: { keycloakId: actor.userId } });
    if (!teacher || teacher.role !== Role.ENSEIGNANT) throw new ForbiddenException('Historique réservé aux professeurs.');
    const records = await this.prisma.staffAttendance.findMany({
      where: { teacherId: teacher.id, date: { ...(start ? { gte: this.date(start) } : {}), ...(end ? { lte: this.date(end) } : {}) } },
      orderBy: { date: 'desc' }, take: 365,
    });
    return { teacher: this.safeTeacher(teacher), records, summary: this.summary(records) };
  }

  async list(dateStr?: string) {
    const settings = await this.settings();
    const day = this.date(dateStr || this.localTime(new Date(), settings.timeZone).date);
    const teachers = await this.prisma.user.findMany({ where: { role: Role.ENSEIGNANT }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] });
    const records = await this.prisma.staffAttendance.findMany({ where: { date: day } });
    const byTeacher = new Map(records.map((record) => [record.teacherId, record]));
    const isRestDay = this.restDays(settings.restDays).includes(day.getUTCDay());
    const holiday = await this.prisma.schoolHoliday.findUnique({ where: { date: day } });
    return { date: day.toISOString().slice(0, 10), isRestDay, holiday, teachers: teachers.map((teacher) => ({ ...this.safeTeacher(teacher), attendance: byTeacher.get(teacher.id) || null })) };
  }

  async finalize(dateStr: string) {
    const settings = await this.settings();
    const today = this.localTime(new Date(), settings.timeZone).date;
    const day = this.date(dateStr);
    if (dateStr > today) throw new BadRequestException('Impossible de clôturer une date future.');
    await this.assertWorkingDay(day, settings.restDays);
    const teachers = await this.prisma.user.findMany({ where: { role: Role.ENSEIGNANT }, select: { id: true } });
    const result = await this.prisma.staffAttendance.createMany({
      data: teachers.map((teacher) => ({ teacherId: teacher.id, date: day, status: AttendanceStatus.ABSENT })),
      skipDuplicates: true,
    });
    return { date: dateStr, absencesRecorded: result.count };
  }

  async getCalendar() {
    const [settings, holidays] = await Promise.all([this.settings(), this.prisma.schoolHoliday.findMany({ orderBy: { date: 'asc' } })]);
    return { settings, holidays };
  }

  async updateCalendar(input: { restDays: number[]; startTime: string; timeZone: string }) {
    if (!Array.isArray(input?.restDays) || input.restDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input?.startTime || '')) {
      throw new BadRequestException('Jours de repos ou heure de début invalides.');
    }
    try { new Intl.DateTimeFormat('fr-FR', { timeZone: input.timeZone }); } catch { throw new BadRequestException('Fuseau horaire invalide.'); }
    return this.prisma.schoolCalendarSettings.upsert({
      where: { id: 1 },
      update: { restDays: [...new Set(input.restDays)].sort().join(','), startTime: input.startTime, timeZone: input.timeZone },
      create: { id: 1, restDays: [...new Set(input.restDays)].sort().join(','), startTime: input.startTime, timeZone: input.timeZone },
    });
  }

  async addHoliday(input: { date: string; name: string }) {
    const date = this.date(input?.date);
    const name = input?.name?.trim();
    if (!name || name.length > 120) throw new BadRequestException('Nom du jour férié invalide.');
    return this.prisma.schoolHoliday.upsert({ where: { date }, update: { name }, create: { date, name } });
  }

  async removeHoliday(id: string) {
    await this.prisma.schoolHoliday.delete({ where: { id } });
    return { deleted: true };
  }

  private safeTeacher(teacher: { id: string; firstName: string; lastName: string; email: string }) {
    return { id: teacher.id, firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email };
  }

  private restDays(value: string) {
    return value ? value.split(',').map(Number) : [];
  }

  private summary(records: { status: AttendanceStatus; minutesLate: number }[]) {
    return {
      present: records.filter((record) => record.status === AttendanceStatus.PRESENT).length,
      late: records.filter((record) => record.status === AttendanceStatus.LATE).length,
      absent: records.filter((record) => record.status === AttendanceStatus.ABSENT).length,
      excused: records.filter((record) => record.status === AttendanceStatus.EXCUSED).length,
      minutesLate: records.reduce((sum, record) => sum + record.minutesLate, 0),
    };
  }
}
