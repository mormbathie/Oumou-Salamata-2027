import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ActingUser, actorStamp } from '../audit/actor';
import { PrismaService } from '../prisma/prisma.service';
import { cashDay, dayRange, openCashDay } from './cash-day';

export type RefundInput = { paymentId: string; amount: number; expectedRefundedAmount: number; refundedOn: string; paymentMethod: PaymentMethod; reason: string; recipient: string; mode: string; requestKey: string };
function text(value: unknown, name: string, min: number, max: number) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new BadRequestException(`${name} : ${min} à ${max} caractères requis.`);
  return value.trim();
}
function admin(actor: ActingUser) {
  if (!actor?.roles?.includes('ADMIN')) throw new ForbiddenException('Cette action est réservée à l’administrateur.');
  return actorStamp(actor);
}
export function operationDate(value: string) {
  dayRange(value);
  if (value > cashDay(new Date())) throw new BadRequestException('La date ne peut pas être future.');
  return new Date(value + 'T00:00:00Z');
}
const refundInclude = { payment: { include: { invoice: { include: { student: { select: { id: true, firstName: true, lastName: true, matricule: true, parent: { select: { firstName: true, lastName: true, phone: true } }, enrollments: { select: { academicYearId: true, classroom: { select: { name: true } } } } } }, academicYear: true } } } } };

@Injectable()
export class RefundsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(studentId?: string) {
    return this.prisma.refund.findMany({ where: studentId ? { payment: { invoice: { studentId } } } : {}, include: refundInclude, orderBy: [{ refundedOn: 'desc' }, { createdAt: 'desc' }], take: 500 });
  }
  async payments(studentId: string) {
    if (!studentId) throw new BadRequestException('Choisissez un élève.');
    const payments = await this.prisma.payment.findMany({ where: { cancelledAt: null, invoice: { studentId, cancelledAt: null } }, include: { refunds: true, invoice: { select: { invoiceNumber: true, title: true } } }, orderBy: { paymentDate: 'desc' } });
    return payments.map(p => { const refundedAmount = p.refunds.reduce((sum, r) => sum + r.amount, 0); return { ...p, refundedAmount, refundableAmount: p.amount - refundedAmount }; });
  }
  async create(data: RefundInput, actor: ActingUser) {
    const author = admin(actor);
    const reason = text(data?.reason, 'Motif', 10, 1000), recipient = text(data?.recipient, 'Bénéficiaire', 2, 150);
    const requestKey = text(data?.requestKey, 'Référence de demande', 16, 100);
    const paymentId = text(data?.paymentId, 'Paiement', 1, 100), refundedOn = operationDate(data?.refundedOn);
    if (!Number.isSafeInteger(data.amount) || data.amount <= 0 || data.amount > 2147483647 || !Number.isSafeInteger(data.expectedRefundedAmount) || data.expectedRefundedAmount < 0) throw new BadRequestException('Montant entier positif en F CFA requis.');
    if (!Object.values(PaymentMethod).includes(data.paymentMethod) || !['REFUND_RECORDED','ALREADY_PAID_REGULARIZATION'].includes(data.mode)) throw new BadRequestException('Mode de remboursement invalide.');
    const sameRequest = (r: any) => r.paymentId === paymentId && r.amount === data.amount && cashDay(r.refundedOn) === data.refundedOn && r.reason === reason && r.recipient === recipient && r.mode === data.mode && r.paymentMethod === data.paymentMethod && r.actorId === author.id;
    return this.prisma.$transaction(async tx => {
      const previous = await tx.refund.findUnique({ where: { requestKey }, include: refundInclude });
      if (previous) { if (!sameRequest(previous)) throw new ConflictException('Cette référence a déjà été utilisée pour une autre opération.'); return previous; }
      // Same lock order as payment/cash corrections. All refunds for an invoice serialize.
      await openCashDay(tx, data.refundedOn);
      const original = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!original) throw new NotFoundException('Paiement introuvable.');
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Invoice" WHERE id = ${original.invoiceId} FOR UPDATE`);
      const duplicate = await tx.refund.findUnique({ where: { requestKey }, include: refundInclude });
      if (duplicate) { if (!sameRequest(duplicate)) throw new ConflictException('Référence déjà utilisée.'); return duplicate; }
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { invoice: true, refunds: true } });
      if (payment.cancelledAt || payment.invoice.cancelledAt) throw new BadRequestException('Paiement ou facture annulé.');
      if (data.refundedOn < cashDay(payment.paymentDate)) throw new BadRequestException('Le remboursement ne peut pas précéder le paiement.');
      const total = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
      if (total !== data.expectedRefundedAmount) throw new ConflictException('Le montant déjà remboursé a changé. Actualisez avant de confirmer.');
      if (data.amount > payment.amount - total) throw new BadRequestException('Le remboursement dépasse le montant encore remboursable.');
      const refund = await tx.refund.create({ data: { paymentId, requestKey, amount: data.amount, refundedOn, paymentMethod: data.paymentMethod, mode: data.mode, reason, recipient,
        refundNumber: 'REM-' + data.refundedOn.slice(0,4) + '-' + randomUUID().toUpperCase(), actorId: author.id, actorName: author.name, actorRole: author.role }, include: refundInclude });
      await tx.businessAudit.create({ data: { action: 'REFUND_RECORDED', entityId: refund.id, actorId: author.id, actorName: author.name, actorRole: author.role, reason,
        details: JSON.stringify({ paymentId, invoiceId: payment.invoiceId, amount: refund.amount, mode: refund.mode, refundedOn: data.refundedOn, requestKey }) } });
      return refund;
    }, { timeout: 15000 });
  }
  async departures() {
    return this.prisma.studentDeparture.findMany({ include: { student: { include: { parent: true, enrollments: { include: { classroom: true } }, invoices: { where: { cancelledAt: null }, select: { amount: true, paidAmount: true, balance: true } } } } }, orderBy: { departedOn: 'desc' }, take: 500 });
  }
  async depart(studentId: string, data: { departedOn: string; reason: string; requestKey: string }, actor: ActingUser) {
    const author = admin(actor), reason = text(data?.reason, 'Motif', 10, 1000), requestKey = text(data?.requestKey, 'Référence de demande', 16, 100), departedOn = operationDate(data?.departedOn);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Student" WHERE id = ${studentId} FOR UPDATE`);
      const student = await tx.student.findUnique({ where: { id: studentId } });
      if (!student) throw new NotFoundException('Élève introuvable.');
      const existing = await tx.studentDeparture.findUnique({ where: { studentId } });
      if (existing) {
        if (existing.requestKey === requestKey && existing.reason === reason && cashDay(existing.departedOn) === data.departedOn && existing.actorId === author.id) return existing;
        throw new ConflictException('Le départ de cet élève est déjà enregistré.');
      }
      if (await tx.studentDeparture.findUnique({ where: { requestKey } })) throw new ConflictException('Référence déjà utilisée.');
      const departure = await tx.studentDeparture.create({ data: { studentId, departedOn, reason, requestKey, actorId: author.id, actorName: author.name, actorRole: author.role } });
      await tx.student.update({ where: { id: studentId }, data: { status: 'INACTIVE', updatedById: author.id, updatedByName: author.name } });
      await tx.enrollment.updateMany({ where: { studentId, status: 'REGISTERED', academicYear: { endDate: { gte: departedOn } } }, data: { status: 'WITHDRAWN' } });
      await tx.businessAudit.create({ data: { action: 'STUDENT_DEPARTED', entityId: studentId, actorId: author.id, actorName: author.name, actorRole: author.role, reason,
        details: JSON.stringify({ departureId: departure.id, departedOn: data.departedOn, previousStatus: student.status, outstandingTreatment: 'UNCHANGED' }) } });
      return departure;
    });
  }
}
