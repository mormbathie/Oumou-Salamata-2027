import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function cashDay(value: Date) { return value.toISOString().slice(0, 10); } // Dakar is UTC year-round.
export function dayRange(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException('Date invalide.');
  const start = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || cashDay(start) !== day) throw new BadRequestException('Date invalide.');
  return { gte: start, lt: new Date(start.getTime() + 86400000) };
}
export async function openCashDay(tx: Prisma.TransactionClient, day: string) {
  dayRange(day);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261009)`;
  if (await tx.cashClosing.findUnique({ where: { day } })) throw new BadRequestException('Cette journée de caisse est clôturée.');
}
