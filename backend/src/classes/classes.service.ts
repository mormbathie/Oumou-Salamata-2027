import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService, private readonly users: UsersService) {}

  async findAll(requester?: any) {
    const roles: string[] = requester?.roles || [];
    const managesAll = roles.includes('ADMIN') || roles.includes('DIRECTEUR');
    if (roles.includes('ENSEIGNANT') && !managesAll) {
      if (!requester.email) return [];
      return this.prisma.classroom.findMany({
        where: { teacher: { is: { email: requester.email } } },
        include: {
          academicYear: true,
          teacher: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { enrollments: true } },
        },
        orderBy: { level: 'asc' },
      });
    }
    return this.prisma.classroom.findMany({
      include: {
        academicYear: true,
        teacher: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: { level: 'asc' },
    });
  }

  async findOne(id: string, requester?: any) {
    const roles: string[] = requester?.roles || [];
    const isTeacher = roles.includes('ENSEIGNANT') && !roles.includes('ADMIN') && !roles.includes('DIRECTEUR');
    const classroom = await this.prisma.classroom.findUnique({
      where: { id },
      include: {
        academicYear: true,
        teacher: true,
        enrollments: {
          include: {
            student: {
              include: {
                parent: isTeacher
                  ? { select: { id: true, firstName: true, lastName: true, phone: true, relation: true } }
                  : true,
              },
            },
          },
        },
      },
    });

    if (!classroom) {
      throw new NotFoundException(`Classe avec l'ID ${id} non trouvée`);
    }
    if (isTeacher && classroom.teacher?.email !== requester.email) {
      throw new NotFoundException(`Classe avec l'ID ${id} non trouvée`);
    }

    return classroom;
  }

  async getTeachers() {
    // Sync existing Keycloak accounts so teachers can be assigned immediately.
    const keycloakUsers = await this.users.findAll();
    const activeTeacherEmails = keycloakUsers
      .filter((user) => user.enabled && user.roles.includes('ENSEIGNANT') && user.email)
      .map((user) => user.email.toLowerCase());
    if (activeTeacherEmails.length === 0) return [];
    return this.prisma.user.findMany({
      where: { role: 'ENSEIGNANT', email: { in: activeTeacherEmails } },
      select: { id: true, username: true, firstName: true, lastName: true, email: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async create(data: {
    name: string;
    level: string;
    capacity?: number;
    monthlyTuition?: number;
    registrationFee?: number;
    academicYearId?: string;
    teacherId?: string;
  }) {
    const academicYear = data.academicYearId
      ? await this.prisma.academicYear.findUnique({ where: { id: data.academicYearId } })
      : await this.getOrCreateCurrentAcademicYear();

    if (!academicYear) {
      throw new NotFoundException('Année scolaire introuvable');
    }

    return this.prisma.classroom.create({
      data: {
        name: data.name.trim(),
        level: data.level,
        capacity: data.capacity ?? 30,
        monthlyTuition: data.monthlyTuition ?? 25000,
        registrationFee: data.registrationFee ?? 50000,
        academicYearId: academicYear.id,
        teacherId: data.teacherId,
      },
      include: { academicYear: true, teacher: true },
    });
  }

  private async getOrCreateCurrentAcademicYear() {
    const currentYear = await this.prisma.academicYear.findFirst({
      where: { isCurrent: true },
      orderBy: { startDate: 'desc' },
    });

    if (currentYear) {
      return currentYear;
    }

    const today = new Date();
    const startYear = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
    const name = String(startYear) + '-' + String(startYear + 1);

    return this.prisma.academicYear.upsert({
      where: { name },
      update: { isCurrent: true },
      create: {
        name,
        startDate: new Date(Date.UTC(startYear, 8, 1)),
        endDate: new Date(Date.UTC(startYear + 1, 5, 30)),
        isCurrent: true,
      },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.classroom.update({
      where: { id },
      data,
    });
  }

  async getAcademicYears() {
    return this.prisma.academicYear.findMany({
      orderBy: { startDate: 'desc' },
    });
  }

  async getSubjects() {
    return this.prisma.subject.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createSubject(data: { name: string; code: string; coefficient?: number; level?: string }) {
    return this.prisma.subject.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        coefficient: data.coefficient || 1.0,
        level: data.level,
      },
    });
  }
}
