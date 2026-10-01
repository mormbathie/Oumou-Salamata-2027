import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Term } from '@prisma/client';

@Injectable()
export class GradesService {
  constructor(private prisma: PrismaService) {}

  private async assignedClassIds(requester: any): Promise<string[] | null> {
    const roles: string[] = requester?.roles || [];
    if (!roles.includes('ENSEIGNANT') || roles.includes('ADMIN') || roles.includes('DIRECTEUR')) return null;
    if (!requester?.email) return [];
    const classes = await this.prisma.classroom.findMany({
      where: { teacher: { is: { email: requester.email } } }, select: { id: true },
    });
    return classes.map((item) => item.id);
  }

  private async assertCanTeachClass(classroomId: string, requester: any) {
    const ids = await this.assignedClassIds(requester);
    if (ids && !ids.includes(classroomId)) throw new ForbiddenException('Cette classe ne vous est pas affectée.');
  }

  async getGrades(params: {
    classroomId?: string;
    subjectId?: string;
    term?: Term;
    studentId?: string;
    academicYearId?: string;
  }, requester?: any) {
    const { classroomId, subjectId, term, studentId, academicYearId } = params;
    const where: any = {};

    const assignedIds = await this.assignedClassIds(requester);
    if (assignedIds) {
      if (classroomId && !assignedIds.includes(classroomId)) throw new ForbiddenException('Cette classe ne vous est pas affectée.');
      where.classroomId = classroomId || { in: assignedIds };
    } else if (classroomId) where.classroomId = classroomId;
    if (subjectId) where.subjectId = subjectId;
    if (term) where.term = term;
    if (studentId) where.studentId = studentId;
    if (academicYearId) where.academicYearId = academicYearId;

    return this.prisma.grade.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
        subject: true,
        classroom: true,
      },
      orderBy: [{ date: 'desc' }, { student: { lastName: 'asc' } }],
    });
  }

  async recordGrade(data: {
    studentId: string;
    subjectId: string;
    classroomId: string;
    academicYearId?: string;
    term: Term;
    score: number;
    maxScore?: number;
    coefficient?: number;
    examType?: string;
    remarks?: string;
    date?: string | Date;
  }, requester?: any) {
    await this.assertCanTeachClass(data.classroomId, requester);
    const enrolled = await this.prisma.enrollment.findFirst({
      where: { studentId: data.studentId, classroomId: data.classroomId, status: 'REGISTERED' },
      select: { id: true },
    });
    if (!enrolled) throw new BadRequestException('Cet élève n’est pas inscrit dans cette classe.');
    let academicYearId = data.academicYearId;
    if (!academicYearId) {
      const year = await this.prisma.academicYear.findFirst({ where: { isCurrent: true } });
      academicYearId = year?.id;
    }

    if (!academicYearId) {
      throw new BadRequestException('Année académique introuvable');
    }

    return this.prisma.grade.create({
      data: {
        studentId: data.studentId,
        subjectId: data.subjectId,
        classroomId: data.classroomId,
        academicYearId,
        term: data.term,
        score: data.score,
        maxScore: data.maxScore || 20,
        coefficient: data.coefficient || 1.0,
        examType: data.examType || 'DEVOIR',
        remarks: data.remarks,
        date: data.date ? new Date(data.date) : new Date(),
      },
      include: { student: true, subject: true },
    });
  }

  async recordBatchGrades(data: {
    classroomId: string;
    subjectId: string;
    term: Term;
    examType: string;
    date?: string;
    academicYearId?: string;
    grades: { studentId: string; score: number; remarks?: string }[];
  }, requester?: any) {
    await this.assertCanTeachClass(data.classroomId, requester);
    const submittedStudentIds = [...new Set(data.grades.map((grade) => grade.studentId))];
    const enrolledStudents = await this.prisma.enrollment.findMany({
      where: { classroomId: data.classroomId, status: 'REGISTERED', studentId: { in: submittedStudentIds } },
      select: { studentId: true },
    });
    if (enrolledStudents.length !== submittedStudentIds.length) throw new BadRequestException('La saisie contient un élève qui n’est pas inscrit dans cette classe.');
    let academicYearId = data.academicYearId;
    if (!academicYearId) {
      const year = await this.prisma.academicYear.findFirst({ where: { isCurrent: true } });
      academicYearId = year?.id;
    }

    if (!academicYearId) {
      throw new BadRequestException('Année académique introuvable');
    }

    const subject = await this.prisma.subject.findUnique({
      where: { id: data.subjectId },
    });

    const coeff = subject?.coefficient || 1.0;
    const gradeDate = data.date ? new Date(data.date) : new Date();

    const createdGrades: any[] = [];
    for (const g of data.grades) {
      if (g.score !== undefined && g.score !== null) {
        const item = await this.prisma.grade.create({
          data: {
            studentId: g.studentId,
            subjectId: data.subjectId,
            classroomId: data.classroomId,
            academicYearId,
            term: data.term,
            score: Number(g.score),
            maxScore: 20,
            coefficient: coeff,
            examType: data.examType || 'DEVOIR',
            remarks: g.remarks,
            date: gradeDate,
          },
        });
        createdGrades.push(item);
      }
    }

    return {
      message: `${createdGrades.length} notes enregistrées avec succès`,
      count: createdGrades.length,
    };
  }

  private determineAppreciation(avg: number): string {
    if (avg >= 16) return 'Très Bien - Félicitations du Conseil';
    if (avg >= 14) return 'Bien - Tableau d\'Honneur';
    if (avg >= 12) return 'Assez Bien - Encouragements';
    if (avg >= 10) return 'Passable';
    return 'Insuffisant - Doit redoubler d\'efforts';
  }

  async generateReportCard(studentId: string, classroomId: string, term: Term, academicYearId?: string, requester?: any) {
    await this.assertCanTeachClass(classroomId, requester);
    let yrId = academicYearId;
    if (!yrId) {
      const yr = await this.prisma.academicYear.findFirst({ where: { isCurrent: true } });
      yrId = yr?.id;
    }

    if (!yrId) throw new BadRequestException('Année académique non trouvée');

    // Fetch all student's grades for this term
    const studentGrades = await this.prisma.grade.findMany({
      where: {
        studentId,
        classroomId,
        term,
        academicYearId: yrId,
      },
      include: { subject: true },
    });

    if (studentGrades.length === 0) {
      throw new BadRequestException('Aucune note trouvée pour cet élève sur cette période');
    }

    // Group by subject and calculate average per subject
    const subjectMap = new Map<string, { total: number; count: number; coeff: number }>();
    for (const g of studentGrades) {
      const existing = subjectMap.get(g.subjectId) || { total: 0, count: 0, coeff: g.coefficient };
      existing.total += (g.score / g.maxScore) * 20; // normalize to 20
      existing.count += 1;
      subjectMap.set(g.subjectId, existing);
    }

    let weightedSum = 0;
    let totalCoeff = 0;

    subjectMap.forEach((val) => {
      const subjectAvg = val.total / val.count;
      weightedSum += subjectAvg * val.coeff;
      totalCoeff += val.coeff;
    });

    const overallAverage = totalCoeff > 0 ? Math.round((weightedSum / totalCoeff) * 100) / 100 : 0;
    const appreciation = this.determineAppreciation(overallAverage);

    const reportCard = await this.prisma.reportCard.upsert({
      where: {
        studentId_classroomId_academicYearId_term: {
          studentId,
          classroomId,
          academicYearId: yrId,
          term,
        },
      },
      update: {
        overallAverage,
        totalScore: Math.round(weightedSum * 10) / 10,
        totalCoeff,
        totalMaxScore: totalCoeff * 20,
        appreciation,
        generatedAt: new Date(),
      },
      create: {
        studentId,
        classroomId,
        academicYearId: yrId,
        term,
        overallAverage,
        totalScore: Math.round(weightedSum * 10) / 10,
        totalCoeff,
        totalMaxScore: totalCoeff * 20,
        appreciation,
      },
      include: {
        student: true,
        classroom: true,
        academicYear: true,
      },
    });

    // Update rankings for the class
    await this.updateClassRankings(classroomId, term, yrId);

    return this.getReportCardDetails(studentId, classroomId, term, yrId, requester);
  }

  async generateClassReportCards(classroomId: string, term: Term, academicYearId?: string) {
    let yrId = academicYearId;
    if (!yrId) {
      const yr = await this.prisma.academicYear.findFirst({ where: { isCurrent: true } });
      yrId = yr?.id;
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classroomId, academicYearId: yrId, status: 'REGISTERED' },
    });

    let successCount = 0;
    for (const enr of enrollments) {
      try {
        await this.generateReportCard(enr.studentId, classroomId, term, yrId);
        successCount++;
      } catch (e) {
        // Skip students without grades
      }
    }

    return {
      message: `${successCount} bulletins générés avec succès`,
      count: successCount,
    };
  }

  private async updateClassRankings(classroomId: string, term: Term, academicYearId: string) {
    const reportCards = await this.prisma.reportCard.findMany({
      where: { classroomId, term, academicYearId },
      orderBy: { overallAverage: 'desc' },
    });

    if (reportCards.length === 0) return;

    const averages = reportCards.map((rc) => rc.overallAverage);
    const classAvg = Math.round((averages.reduce((a, b) => a + b, 0) / averages.length) * 100) / 100;
    const minAvg = Math.min(...averages);
    const maxAvg = Math.max(...averages);

    for (let i = 0; i < reportCards.length; i++) {
      await this.prisma.reportCard.update({
        where: { id: reportCards[i].id },
        data: {
          rank: i + 1,
          classAverage: classAvg,
          minAverage: minAvg,
          maxAverage: maxAvg,
        },
      });
    }
  }

  async getReportCardDetails(studentId: string, classroomId: string, term: Term, academicYearId?: string, requester?: any) {
    await this.assertCanTeachClass(classroomId, requester);
    let yrId = academicYearId;
    if (!yrId) {
      const yr = await this.prisma.academicYear.findFirst({ where: { isCurrent: true } });
      yrId = yr?.id;
    }

    const reportCard = await this.prisma.reportCard.findFirst({
      where: { studentId, classroomId, term, academicYearId: yrId },
      include: {
        student: {
          include: { parent: (await this.assignedClassIds(requester)) ? { select: { id: true, firstName: true, lastName: true, phone: true, relation: true } } : true },
        },
        classroom: {
          include: { teacher: true },
        },
        academicYear: true,
      },
    });

    if (!reportCard) {
      throw new NotFoundException('Bulletin non encore généré pour cet élève');
    }

    // Fetch individual subject grades
    const grades = await this.prisma.grade.findMany({
      where: { studentId, classroomId, term, academicYearId: yrId },
      include: { subject: true },
    });

    // Group grades by subject for report card table
    const subjectBreakdown: Record<string, any> = {};
    for (const g of grades) {
      if (!subjectBreakdown[g.subjectId]) {
        subjectBreakdown[g.subjectId] = {
          subjectName: g.subject.name,
          coefficient: g.coefficient,
          scores: [],
          remarks: g.remarks,
        };
      }
      subjectBreakdown[g.subjectId].scores.push({
        score: g.score,
        maxScore: g.maxScore,
        examType: g.examType,
      });
    }

    const items = Object.values(subjectBreakdown).map((sub: any) => {
      const avg = sub.scores.reduce((acc: number, s: any) => acc + (s.score / s.maxScore) * 20, 0) / sub.scores.length;
      return {
        subjectName: sub.subjectName,
        coefficient: sub.coefficient,
        average: Math.round(avg * 10) / 10,
        totalPoints: Math.round(avg * sub.coefficient * 10) / 10,
        appreciation: this.determineAppreciation(avg),
      };
    });

    return {
      ...reportCard,
      subjectBreakdown: items,
    };
  }

  async getClassReportCards(classroomId: string, term: Term, academicYearId?: string, requester?: any) {
    await this.assertCanTeachClass(classroomId, requester);
    let yrId = academicYearId;
    if (!yrId) {
      const yr = await this.prisma.academicYear.findFirst({ where: { isCurrent: true } });
      yrId = yr?.id;
    }

    return this.prisma.reportCard.findMany({
      where: { classroomId, term, academicYearId: yrId },
      include: {
        student: true,
        classroom: true,
      },
      orderBy: { rank: 'asc' },
    });
  }
}
