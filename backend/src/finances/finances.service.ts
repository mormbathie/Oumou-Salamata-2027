import { schoolFees, optionTariffs } from '../school/school-options';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, InvoiceStatus, InvoiceType, PaymentMethod } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ActingUser, actorStamp } from '../audit/actor';

@Injectable()
export class FinancesService {
  constructor(private prisma: PrismaService) {}

  async getInvoices(params: {
    studentId?: string;
    classroomId?: string;
    status?: string;
    type?: string;
    academicYearId?: string;
    category?: string;
  }) {
    const { studentId, classroomId, status, type, academicYearId, category } = params;

    const where: any = {};

    if (category) where.category = category;
    if (studentId) where.studentId = studentId;
    if (status) where.status = status as InvoiceStatus;
    if (type) where.type = type as InvoiceType;
    if (academicYearId) where.academicYearId = academicYearId;

    if (classroomId) {
      where.student = {
        enrollments: {
          some: { classroomId },
        },
      };
    }

    return this.prisma.invoice.findMany({
      where,
      include: {
        student: {
          include: {
            parent: true,
            enrollments: {
              include: { classroom: true },
              take: 1,
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            parent: true,
            enrollments: {
              include: { classroom: true },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        academicYear: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Facture avec l'ID ${id} non trouvée`);
    }

    return invoice;
  }

  async createInvoice(data: {
    studentId: string;
    academicYearId?: string;
    title: string;
    type: InvoiceType;
    amount: number;
    dueDate: string | Date;
  }, actor: ActingUser) {
    const author = actorStamp(actor);
    let academicYearId = data.academicYearId;
    if (!academicYearId) {
      const currentYear = await this.prisma.academicYear.findFirst({
        where: { isCurrent: true },
      });
      academicYearId = currentYear?.id;
    }

    if (!academicYearId) {
      throw new BadRequestException('Année académique non définie');
    }

    const count = await this.prisma.invoice.count();
    const year = new Date().getFullYear();
    const invoiceNumber = `FAC-${year}-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        studentId: data.studentId,
        academicYearId,
        title: data.title,
        type: data.type,
        amount: data.amount,
        paidAmount: 0,
        balance: data.amount,
        dueDate: new Date(data.dueDate),
        status: InvoiceStatus.UNPAID,
        createdById: author.id,
        createdByName: author.name,
        createdByRole: author.role,
      },
      include: { student: true },
    });
  }

  async recordPayment(data: {
    invoiceId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    reference?: string;
    notes?: string;
    paymentDate?: string | Date;
  }, actor: ActingUser) {
    const author = actorStamp(actor);
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: data.invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Facture avec l'ID ${data.invoiceId} introuvable`);
    }

    if (data.paymentDate && !Number.isFinite(new Date(data.paymentDate).getTime())) throw new BadRequestException('Date de paiement invalide.');
    if (!Object.values(PaymentMethod).includes(data.paymentMethod)) throw new BadRequestException('Mode de paiement invalide.');
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new BadRequestException('Le montant du paiement doit être un nombre supérieur à zéro');
    }

    if (data.amount > invoice.balance) {
      throw new BadRequestException(
        `Le montant (${data.amount}) dépasse le solde restant (${invoice.balance})`,
      );
    }

    const year = new Date().getFullYear();
    const paymentNumber = 'REC-' + year + '-' + randomUUID().slice(0, 8).toUpperCase();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.updateMany({
        where: { id: invoice.id, balance: { gte: data.amount } },
        data: {
          paidAmount: { increment: data.amount },
          balance: { decrement: data.amount },
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException('Le solde de cette facture a changé. Actualisez la page avant de réessayer.');
      }

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          invoiceId: invoice.id,
          amount: data.amount,
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
          paymentMethod: data.paymentMethod,
          reference: data.reference,
          receivedBy: author.name,
          receivedById: author.id,
          receivedByRole: author.role,
          notes: data.notes,
        },
      });

      const include = {
        student: {
          include: {
            parent: true,
            enrollments: { include: { classroom: true } },
          },
        },
        payments: { orderBy: { paymentDate: 'desc' as const } },
        academicYear: true,
      };
      const updatedInvoice = await tx.invoice.findUnique({ where: { id: invoice.id }, include });
      if (!updatedInvoice) throw new NotFoundException('Facture introuvable après l’enregistrement du paiement.');

      const status = updatedInvoice.balance <= 0
        ? InvoiceStatus.PAID
        : updatedInvoice.paidAmount > 0
          ? InvoiceStatus.PARTIAL
          : InvoiceStatus.UNPAID;
      const invoiceWithStatus = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status },
        include,
      });

      return { ...invoiceWithStatus, createdPayment: payment };
    });
  }

  async generateTuitionInvoicesForClass(data: {
    classroomId: string;
    monthName: string;
    dueDate: string | Date;
    academicYearId?: string;
  }, actor: ActingUser) {
    const author = actorStamp(actor);
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: data.classroomId },
      include: {
        enrollments: {
          where: { status: 'REGISTERED' },
          include: { student: true },
        },
      },
    });

    if (!classroom) {
      throw new NotFoundException(`Classe avec l'ID ${data.classroomId} non trouvée`);
    }

    let academicYearId = data.academicYearId || classroom.academicYearId;
    const year = new Date().getFullYear();
    let createdCount = 0;

    for (const enrollment of classroom.enrollments) {
      // Check if invoice for this month already exists
      const title = `Scolarité ${data.monthName} - ${classroom.name}`;
      const existing = await this.prisma.invoice.findFirst({
        where: {
          studentId: enrollment.studentId,
          academicYearId,
          title,
        },
      });

      if (!existing) {
        const count = await this.prisma.invoice.count();
        const invoiceNumber = `FAC-${year}-${String(count + 1).padStart(4, '0')}`;

        await this.prisma.invoice.create({
          data: {
            invoiceNumber,
            studentId: enrollment.studentId,
            academicYearId,
            title,
            type: InvoiceType.TUITION,
            amount: schoolFees(enrollment.student, classroom).monthlyTuition,
            paidAmount: 0,
            balance: schoolFees(enrollment.student, classroom).monthlyTuition,
            dueDate: new Date(data.dueDate),
            status: InvoiceStatus.UNPAID,
            createdById: author.id,
            createdByName: author.name,
            createdByRole: author.role,
          },
        });
        createdCount++;
      }
    }

    return {
      message: `${createdCount} factures générées pour la classe ${classroom.name}`,
      createdCount,
    };
  }

  async createActivityInvoice(data: { studentId: string; category: string; month?: string }, actor: ActingUser) {
    const author = actorStamp(actor);
    if (!['KIMONO', 'KARATE'].includes(data.category)) throw new BadRequestException('Catégorie invalide.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Student" WHERE id = ${data.studentId} FOR UPDATE`);
      const student = await tx.student.findUnique({ where: { id: data.studentId }, include: {
        enrollments: { where: { academicYear: { isCurrent: true }, status: 'REGISTERED' }, take: 1, include: { classroom: true, academicYear: true } },
      } });
      const enrollment = student?.enrollments[0];
      if (!student || !enrollment || student.status !== 'ACTIVE') throw new BadRequestException('Élève actif inscrit requis.');
      if (['TPS', 'PS'].includes(enrollment.classroom.level)) throw new BadRequestException('Karaté et Kimono interdits en TPS et PS.');
      if (data.category === 'KARATE' && !student.karate) throw new BadRequestException('L’option Karaté doit être active.');
      if (data.category === 'KARATE' && (!data.month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(data.month))) throw new BadRequestException('Mois requis au format AAAA-MM.');
      const billingKey = `${data.category}:${student.id}:${enrollment.academicYearId}:${data.category === 'KARATE' ? data.month : 'once'}`;
      const amount = data.category === 'KIMONO' ? optionTariffs.kimono : optionTariffs.karateMonthly;
      // The unique key protects concurrent submissions, not only clicks in the UI.
      return tx.invoice.upsert({ where: { billingKey }, update: {}, create: {
        billingKey, category: data.category, studentId: student.id, academicYearId: enrollment.academicYearId,
        invoiceNumber: 'FAC-' + new Date().getFullYear() + '-' + randomUUID().slice(0, 12).toUpperCase(),
        title: data.category === 'KIMONO' ? 'Vente Kimono' : `Karaté ${data.month}`,
        type: InvoiceType.OTHER, amount, paidAmount: 0, balance: amount, dueDate: new Date(), status: InvoiceStatus.UNPAID,
        createdById: author.id, createdByName: author.name, createdByRole: author.role,
      }, include: { student: true, payments: { orderBy: { paymentDate: 'desc' } } } });
    });
  }

  async getFinancialStats(academicYearId?: string) {
    const where: any = academicYearId ? { academicYearId } : {};

    const invoices = await this.prisma.invoice.findMany({
      where,
      select: {
        amount: true,
        paidAmount: true,
        balance: true,
        status: true,
        type: true,
      },
    });

    const totalInvoiced = invoices.reduce((acc, curr) => acc + curr.amount, 0);
    const totalCollected = invoices.reduce((acc, curr) => acc + curr.paidAmount, 0);
    const totalOutstanding = invoices.reduce((acc, curr) => acc + curr.balance, 0);
    const recoveryRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

    const byStatus = {
      PAID: invoices.filter((i) => i.status === InvoiceStatus.PAID).length,
      PARTIAL: invoices.filter((i) => i.status === InvoiceStatus.PARTIAL).length,
      UNPAID: invoices.filter((i) => i.status === InvoiceStatus.UNPAID).length,
      OVERDUE: invoices.filter((i) => i.status === InvoiceStatus.OVERDUE).length,
    };

    const recentPayments = await this.prisma.payment.findMany({
      take: 10,
      orderBy: { paymentDate: 'desc' },
      include: {
        invoice: {
          include: {
            student: true,
          },
        },
      },
    });

    return {
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      recoveryRate: Math.round(recoveryRate * 10) / 10,
      invoiceCount: invoices.length,
      byStatus,
      recentPayments,
    };
  }
}
