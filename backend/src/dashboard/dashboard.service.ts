import { collectionPeriod, type CollectionFilter } from './collection-period';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Gender, StudentStatus, InvoiceStatus, AttendanceStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(filter: CollectionFilter = {}) {
    const period = collectionPeriod(filter);
    const collectedPayments = await this.prisma.payment.findMany({
      where: { ...period.where, cancelledAt: null }, select: { amount: true, invoice: { select: { type: true, category: true } } },
    });
    const byCategory: Record<string, number> = {};
    for (const payment of collectedPayments) {
      const category = payment.invoice.category || payment.invoice.type;
      byCategory[category] = (byCategory[category] || 0) + payment.amount;
    }
    const periodRefunds = await this.prisma.refund.findMany({ where: period.start ? { refundedOn: { gte: new Date(period.start + 'T00:00:00Z'), lt: new Date(new Date(period.end! + 'T00:00:00Z').getTime() + 86400000) } } : {}, select: { amount: true, payment: { select: { invoice: { select: { type: true, category: true } } } } } });
    const gross = collectedPayments.reduce((sum, p) => sum + p.amount, 0);
    const refunds = periodRefunds.reduce((sum, r) => sum + r.amount, 0);
    for (const r of periodRefunds) { const key = r.payment.invoice.category || r.payment.invoice.type; byCategory[key] = (byCategory[key] || 0) - r.amount; }
    const collection = { gross, refunds, mode: period.mode, start: period.start, end: period.end,
      total: gross - refunds, count: collectedPayments.length, byCategory };
    const currentYear = await this.prisma.academicYear.findFirst({
      where: { isCurrent: true },
    });

    const [
      totalStudents,
      maleStudents,
      femaleStudents,
      totalClasses,
      totalParents,
      invoices,
      recentPayments,
      todayAttendances,
      classesWithCount,
      recentStudents,
    ] = await Promise.all([
      this.prisma.student.count({ where: { status: StudentStatus.ACTIVE } }),
      this.prisma.student.count({ where: { gender: Gender.MALE, status: StudentStatus.ACTIVE } }),
      this.prisma.student.count({ where: { gender: Gender.FEMALE, status: StudentStatus.ACTIVE } }),
      this.prisma.classroom.count({ where: { academicYear: { isCurrent: true } } }),
      this.prisma.parent.count(),
      this.prisma.invoice.findMany({
        where: { cancelledAt: null, ...(currentYear ? { academicYearId: currentYear.id } : {}) },
        select: { amount: true, paidAmount: true, balance: true, status: true },
      }),
      this.prisma.payment.findMany({
        where: { cancelledAt: null },
        take: 5,
        orderBy: { paymentDate: 'desc' },
        include: {
          invoice: {
            include: { student: true },
          },
        },
      }),
      this.prisma.attendance.findMany({
        where: {
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.prisma.classroom.findMany({
        where: { academicYear: { isCurrent: true } },
        select: {
          id: true,
          name: true,
          level: true,
          capacity: true,
          _count: { select: { enrollments: { where: { status: 'REGISTERED', student: { status: 'ACTIVE' } } } } },
        },
        orderBy: { level: 'asc' },
      }),
      this.prisma.student.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          parent: true,
          enrollments: {
            include: { classroom: true },
            take: 1,
          },
        },
      }),
    ]);

    // Financial sums
    const totalInvoiced = invoices.reduce((acc, curr) => acc + curr.amount, 0);
    const grossCollected = invoices.reduce((acc, curr) => acc + curr.paidAmount, 0);
    const refundSum = await this.prisma.refund.aggregate({ where: currentYear ? { payment: { invoice: { academicYearId: currentYear.id } } } : {}, _sum: { amount: true } });
    const totalRefunded = refundSum._sum.amount || 0;
    const totalCollected = grossCollected - totalRefunded;
    const totalBalance = invoices.reduce((acc, curr) => acc + curr.balance, 0);
    const recoveryRate = totalInvoiced > 0 ? Math.round((grossCollected / totalInvoiced) * 1000) / 10 : 0;

    // Today attendance rate
    const totalToday = todayAttendances.length;
    const presentToday = todayAttendances.filter((a) => a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE).length;
    const todayAttendanceRate = totalToday > 0 ? Math.round((presentToday / totalToday) * 1000) / 10 : 96.5;

    return {
      collection,
      academicYear: currentYear?.name || '2026-2027',
      counts: {
        totalStudents,
        maleStudents,
        femaleStudents,
        totalClasses,
        totalParents,
      },
      finances: {
        totalInvoiced,
        totalCollected, grossCollected, totalRefunded,
        totalBalance,
        recoveryRate,
        unpaidInvoicesCount: invoices.filter((i) => i.status === InvoiceStatus.UNPAID).length,
      },
      attendance: {
        rate: todayAttendanceRate,
        totalMarked: totalToday,
      },
      classesDistribution: classesWithCount.map((c) => ({
        id: c.id,
        name: c.name,
        level: c.level,
        capacity: c.capacity,
        studentsCount: c._count.enrollments,
        occupancyRate: Math.round((c._count.enrollments / c.capacity) * 100),
      })),
      recentPayments,
      recentStudents,
    };
  }
}
