import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  private async assertTeacherClassroom(classroomId: string, requester: any) {
    const roles: string[] = requester?.roles || [];
    if (!roles.includes('ENSEIGNANT') || roles.includes('ADMIN') || roles.includes('DIRECTEUR')) return;
    const assigned = requester?.email && await this.prisma.classroom.findFirst({
      where: { id: classroomId, teacher: { is: { email: requester.email } } },
      select: { id: true },
    });
    if (!assigned) throw new ForbiddenException('Cette classe ne vous est pas affectée.');
  }

  async getClassAttendanceSheet(classroomId: string, dateStr?: string, requester?: any) {
    await this.assertTeacherClassroom(classroomId, requester);
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    // Normalize to date without hours for exact day matching
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        enrollments: {
          where: { status: 'REGISTERED' },
          include: { student: true },
          orderBy: { student: { lastName: 'asc' } },
        },
      },
    });

    if (!classroom) {
      throw new NotFoundException(`Classe avec l'ID ${classroomId} introuvable`);
    }

    const existingRecords = await this.prisma.attendance.findMany({
      where: {
        classroomId,
        date: startOfDay,
      },
    });

    const recordMap = new Map<string, any>();
    for (const r of existingRecords) {
      recordMap.set(r.studentId, r);
    }

    const sheet = classroom.enrollments.map((enr) => {
      const existing = recordMap.get(enr.studentId);
      return {
        studentId: enr.studentId,
        student: enr.student,
        status: existing ? existing.status : AttendanceStatus.PRESENT,
        reason: existing?.reason || '',
        justified: existing?.justified || false,
        remarks: existing?.remarks || '',
        recordId: existing?.id,
      };
    });

    return {
      classroomId,
      className: classroom.name,
      date: startOfDay,
      students: sheet,
    };
  }

  async saveClassAttendanceSheet(data: {
    classroomId: string;
    date?: string;
    records: {
      studentId: string;
      status: AttendanceStatus;
      reason?: string;
      justified?: boolean;
      remarks?: string;
    }[];
  }, requester?: any) {
    await this.assertTeacherClassroom(data.classroomId, requester);
    const enrolledIds = new Set((await this.prisma.enrollment.findMany({
      where: { classroomId: data.classroomId, status: 'REGISTERED' }, select: { studentId: true },
    })).map((item) => item.studentId));
    if (data.records.some((record) => !enrolledIds.has(record.studentId))) {
      throw new NotFoundException('La feuille contient un élève qui n’est pas inscrit dans cette classe.');
    }
    const targetDate = data.date ? new Date(data.date) : new Date();
    const day = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

    for (const r of data.records) {
      await this.prisma.attendance.upsert({
        where: {
          studentId_classroomId_date: {
            studentId: r.studentId,
            classroomId: data.classroomId,
            date: day,
          },
        },
        update: {
          status: r.status,
          reason: r.reason,
          justified: r.justified ?? false,
          remarks: r.remarks,
        },
        create: {
          studentId: r.studentId,
          classroomId: data.classroomId,
          date: day,
          status: r.status,
          reason: r.reason,
          justified: r.justified ?? false,
          remarks: r.remarks,
        },
      });
    }

    return this.getClassAttendanceSheet(data.classroomId, data.date, requester);
  }

  async getAttendanceStats(params: { classroomId?: string; startDate?: string; endDate?: string }, requester?: any) {
    const where: any = {};
    const roles: string[] = requester?.roles || [];
    if (roles.includes('ENSEIGNANT') && !roles.includes('ADMIN') && !roles.includes('DIRECTEUR')) {
      const assigned = await this.prisma.classroom.findMany({
        where: { teacher: { is: { email: requester.email } } }, select: { id: true },
      });
      const ids = assigned.map((item) => item.id);
      if (params.classroomId && !ids.includes(params.classroomId)) {
        throw new ForbiddenException('Cette classe ne vous est pas affectée.');
      }
      where.classroomId = params.classroomId || { in: ids };
    } else if (params.classroomId) where.classroomId = params.classroomId;

    if (params.startDate || params.endDate) {
      where.date = {};
      if (params.startDate) where.date.gte = new Date(params.startDate);
      if (params.endDate) where.date.lte = new Date(params.endDate);
    }

    const records = await this.prisma.attendance.findMany({ where });

    const total = records.length;
    const present = records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
    const absent = records.filter((r) => r.status === AttendanceStatus.ABSENT).length;
    const late = records.filter((r) => r.status === AttendanceStatus.LATE).length;
    const excused = records.filter((r) => r.status === AttendanceStatus.EXCUSED).length;
    const justified = records.filter((r) => r.justified).length;

    const rate = total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : 100;

    return {
      totalRecords: total,
      present,
      absent,
      late,
      excused,
      justifiedAbsences: justified,
      attendanceRate: rate,
    };
  }
}
