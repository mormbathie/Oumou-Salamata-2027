import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { Gender, StudentStatus, InvoiceType, InvoiceStatus } from '@prisma/client';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService, private readonly documents: DocumentsService) {}

  async findAll(params: { classId?: string; search?: string; status?: string }, requester: any) {
    const { classId, search, status } = params;

    const where: any = {};

    if (status) {
      where.status = status as StudentStatus;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { matricule: { contains: search, mode: 'insensitive' } },
      ];
    }

    const roles: string[] = requester?.roles || [];
    const isManager = roles.includes('ADMIN') || roles.includes('DIRECTEUR');
    const isTeacher = roles.includes('ENSEIGNANT') && !isManager;
    if (!isManager && roles.includes('PARENT') && !isTeacher) {
      if (!requester.email) return [];
      where.parent = { is: { email: { equals: requester.email, mode: 'insensitive' } } };
    } else if (isTeacher) {
      if (!requester.email) return [];
      const assigned = await this.prisma.classroom.findMany({
        where: { teacher: { is: { email: requester.email } } },
        select: { id: true },
      });
      const classroomIds = assigned.map((item) => item.id);
      if (classroomIds.length === 0 || (classId && !classroomIds.includes(classId))) return [];
      where.enrollments = {
        some: { classroomId: classId ? classId : { in: classroomIds } },
      };
    } else if (classId) {
      where.enrollments = { some: { classroomId: classId } };
    }

    return this.prisma.student.findMany({
      where,
      include: {
        parent: isTeacher
          ? { select: { id: true, firstName: true, lastName: true, phone: true, relation: true } }
          : true,
        enrollments: {
          include: {
            classroom: true,
            academicYear: true,
          },
          orderBy: { enrollmentDate: 'desc' },
          take: 1,
        },
        ...(!isTeacher ? {
          invoices: {
            select: { amount: true, paidAmount: true, balance: true, status: true },
          },
        } : {}),
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async findOne(id: string, requester: any) {
    const roles: string[] = requester?.roles || [];
    const isManager = roles.includes('ADMIN') || roles.includes('DIRECTEUR');
    const isTeacher = roles.includes('ENSEIGNANT') && !isManager;
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        parent: isTeacher
          ? { select: { id: true, firstName: true, lastName: true, phone: true, relation: true } }
          : { include: { ...(isManager ? { documents: { orderBy: { createdAt: 'desc' as const } } } : {}) } },
        ...(isManager ? { documents: { orderBy: { createdAt: 'desc' as const } } } : {}),
        enrollments: {
          include: { classroom: { include: { teacher: { select: { email: true } } } }, academicYear: true },
          orderBy: { enrollmentDate: 'desc' },
        },
        ...(!isTeacher ? {
          invoices: { include: { payments: true }, orderBy: { createdAt: 'desc' } },
        } : {}),
        grades: {
          include: { subject: true },
          orderBy: { date: 'desc' },
        },
        reportCards: {
          include: { classroom: true },
          orderBy: { term: 'asc' },
        },
        attendances: {
          include: { classroom: { select: { name: true } } },
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Élève avec l'ID ${id} non trouvé`);
    }

    if (!isManager && roles.includes('PARENT') && String((student.parent as any)?.email || '').toLowerCase() !== String(requester.email || '').toLowerCase()) {
      throw new NotFoundException(`Élève avec l'ID ${id} non trouvé`);
    }
    if (!isManager && roles.includes('ENSEIGNANT') &&
        !student.enrollments.some((item) => item.classroom.teacher?.email === requester.email)) {
      throw new NotFoundException(`Élève avec l'ID ${id} non trouvé`);
    }
    if (roles.includes('COMPTABLE') && !isManager) {
      delete (student as any).documents;
      if (student.parent) delete (student.parent as any).documents;
    }

    const attendanceGroups = await this.prisma.attendance.groupBy({
      by: ['status'],
      where: { studentId: id },
      _count: { _all: true },
    });
    const attendanceSummary = {
      total: attendanceGroups.reduce((sum, group) => sum + group._count._all, 0),
      present: attendanceGroups.find((group) => group.status === 'PRESENT')?._count._all || 0,
      absent: attendanceGroups.find((group) => group.status === 'ABSENT')?._count._all || 0,
      late: attendanceGroups.find((group) => group.status === 'LATE')?._count._all || 0,
      excused: attendanceGroups.find((group) => group.status === 'EXCUSED')?._count._all || 0,
    };
    return { ...student, attendanceSummary };
  }

  async getPhoto(id: string, requester: any) {
    const roles: string[] = requester?.roles || [];
    const isManager = roles.includes('ADMIN') || roles.includes('DIRECTEUR');
    const isTeacher = roles.includes('ENSEIGNANT') && !isManager;
    const scannerOnly = roles.includes('CONTROLEUR_PRESENCE') &&
      !roles.some((role) => ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT', 'PARENT'].includes(role));

    const student = await this.prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        parent: { select: { email: true } },
        enrollments: {
          select: { classroom: { select: { teacher: { select: { email: true } } } } },
        },
      },
    });
    if (!student) throw new NotFoundException('Élève introuvable.');

    if (!scannerOnly && !isManager && roles.includes('PARENT') && !isTeacher &&
        String(student.parent?.email || '').toLowerCase() !== String(requester.email || '').toLowerCase()) {
      throw new NotFoundException('Élève introuvable.');
    }
    if (!scannerOnly && isTeacher &&
        !student.enrollments.some((item) => item.classroom.teacher?.email === requester.email)) {
      throw new NotFoundException('Élève introuvable.');
    }
    return this.documents.studentPhoto(id);
  }

  async create(data: {
    firstName: string;
    lastName: string;
    gender: Gender;
    dateOfBirth: string | Date;
    placeOfBirth?: string;
    address?: string;
    bloodGroup?: string;
    photoUrl?: string;
    classroomId?: string;
    academicYearId?: string;
    parentId?: string;
    parentData?: {
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
      relation?: string;
      address?: string;
      profession?: string;
    };
    generateInvoice?: boolean;
  }) {
    // Generate matricule
    const count = await this.prisma.student.count();
    const currentYear = new Date().getFullYear();
    const matricule = `OS-${currentYear}-${String(count + 1).padStart(4, '0')}`;

    let parentId = data.parentId;

    // Create parent if new parent data provided
    if (!parentId && data.parentData && data.parentData.firstName && data.parentData.phone) {
      const parent = await this.prisma.parent.create({
        data: { ...data.parentData, email: data.parentData.email?.trim().toLowerCase() || undefined },
      });
      parentId = parent.id;
    }

    // Create student
    const student = await this.prisma.student.create({
      data: {
        matricule,
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        dateOfBirth: new Date(data.dateOfBirth),
        placeOfBirth: data.placeOfBirth,
        address: data.address,
        bloodGroup: data.bloodGroup,
        photoUrl: data.photoUrl,
        parentId,
      },
      include: { parent: true },
    });

    // Handle Enrollment if classroomId provided
    if (data.classroomId) {
      let academicYearId = data.academicYearId;
      if (!academicYearId) {
        const currentYearRecord = await this.prisma.academicYear.findFirst({
          where: { isCurrent: true },
        });
        academicYearId = currentYearRecord?.id;
      }

      if (academicYearId) {
        await this.prisma.enrollment.create({
          data: {
            studentId: student.id,
            classroomId: data.classroomId,
            academicYearId,
            status: 'REGISTERED',
          },
        });

        // Generate Registration invoice if requested
        if (data.generateInvoice !== false) {
          const classroom = await this.prisma.classroom.findUnique({
            where: { id: data.classroomId },
          });

          if (classroom) {
            const invoiceCount = await this.prisma.invoice.count();
            await this.prisma.invoice.create({
              data: {
                invoiceNumber: `FAC-${currentYear}-${String(invoiceCount + 1).padStart(4, '0')}`,
                studentId: student.id,
                academicYearId,
                title: `Frais d'inscription - ${classroom.name}`,
                type: InvoiceType.REGISTRATION,
                amount: classroom.registrationFee,
                paidAmount: 0,
                balance: classroom.registrationFee,
                dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // in 15 days
                status: InvoiceStatus.UNPAID,
              },
            });
          }
        }
      }
    }

    return this.findOne(student.id, { roles: ['ADMIN', 'DIRECTEUR'] });
  }

  async update(id: string, data: any) {
    const existing = await this.prisma.student.findUnique({ where: { id }, select: { id: true, parentId: true } });
    if (!existing) throw new NotFoundException(`Élève avec l'ID ${id} non trouvé`);

    const studentData: any = {};
    for (const field of ['firstName', 'lastName', 'gender', 'placeOfBirth', 'address', 'bloodGroup', 'status', 'photoUrl']) {
      if (data[field] !== undefined) studentData[field] = data[field];
    }
    if (data.dateOfBirth !== undefined) studentData.dateOfBirth = new Date(data.dateOfBirth);

    if (data.parentData) {
      const parentData: any = {};
      for (const field of ['firstName', 'lastName', 'phone', 'email', 'address', 'profession', 'relation']) {
        if (data.parentData[field] !== undefined) {
          const value = typeof data.parentData[field] === 'string' ? data.parentData[field].trim() : data.parentData[field];
          if (['firstName', 'lastName', 'phone'].includes(field) && !value) continue;
          parentData[field] = value || null;
        }
      }
      if (existing.parentId) {
        await this.prisma.parent.update({ where: { id: existing.parentId }, data: parentData });
      } else if (parentData.firstName && parentData.phone) {
        const parent = await this.prisma.parent.create({ data: parentData });
        studentData.parentId = parent.id;
      }
    }

    if (Object.keys(studentData).length > 0) {
      await this.prisma.student.update({ where: { id }, data: studentData });
    }

    if (data.classroomId !== undefined && data.classroomId) {
      const classroom = await this.prisma.classroom.findUnique({
        where: { id: data.classroomId },
        select: { id: true, academicYearId: true },
      });
      if (!classroom) throw new BadRequestException('Classe sélectionnée introuvable.');
      await this.enroll({ studentId: id, classroomId: classroom.id, academicYearId: classroom.academicYearId });
    }

    return this.findOne(id, { roles: ['ADMIN', 'DIRECTEUR'] });
  }

  async enroll(data: { studentId: string; classroomId: string; academicYearId: string }) {
    const existing = await this.prisma.enrollment.findUnique({
      where: {
        studentId_academicYearId: {
          studentId: data.studentId,
          academicYearId: data.academicYearId,
        },
      },
    });

    if (existing) {
      return this.prisma.enrollment.update({
        where: { id: existing.id },
        data: { classroomId: data.classroomId, status: 'REGISTERED' },
      });
    }

    return this.prisma.enrollment.create({
      data: {
        studentId: data.studentId,
        classroomId: data.classroomId,
        academicYearId: data.academicYearId,
        status: 'REGISTERED',
      },
    });
  }

  async remove(id: string) {
    const documents = await this.prisma.studentDocument.findMany({ where: { studentId: id }, select: { storageKey: true } });
    const removed = await this.prisma.student.delete({ where: { id } });
    await this.documents.removeStoredFiles(documents.map((document) => document.storageKey));
    return removed;
  }
}
