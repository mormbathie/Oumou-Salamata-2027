import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from '../documents/documents.service';
import { normalizeEmail } from '../common/email';

@Injectable()
export class ParentsService {
  constructor(private prisma: PrismaService, private readonly documents: DocumentsService) {}

  async findAll(search?: string) {
    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    return this.prisma.parent.findMany({
      where,
      include: {
        students: {
          include: {
            enrollments: {
              include: { classroom: true },
            },
            invoices: {
              select: { amount: true, paidAmount: true, balance: true, status: true },
            },
          },
        },
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async findOne(id: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { id },
      include: {
        students: {
          include: {
            enrollments: {
              include: { classroom: true, academicYear: true },
            },
            invoices: {
              include: { payments: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!parent) {
      throw new NotFoundException(`Parent avec l'ID ${id} non trouvé`);
    }

    return parent;
  }

  async create(data: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    address?: string;
    profession?: string;
    relation?: string;
  }) {
    return this.prisma.parent.create({
      data: { ...data, email: normalizeEmail(data.email) },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.parent.update({
      where: { id },
      data: { ...data, ...(data.email !== undefined ? { email: normalizeEmail(data.email) } : {}) },
    });
  }

  async remove(id: string) {
    const documents = await this.prisma.parentDocument.findMany({ where: { parentId: id }, select: { storageKey: true } });
    const removed = await this.prisma.parent.delete({ where: { id } });
    await this.documents.removeStoredFiles(documents.map((document) => document.storageKey));
    return removed;
  }
}
