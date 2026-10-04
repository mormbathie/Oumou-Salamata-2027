import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

// Parent tables precede dependent tables so an entire workbook can be inserted atomically.
export const BUSINESS_MODELS = [
  'AcademicYear', 'Parent', 'Subject', 'Student', 'Classroom', 'Enrollment',
  'Grade', 'ReportCard', 'Invoice', 'Payment', 'Attendance', 'StaffAttendance',
  'SchoolHoliday', 'SchoolCalendarSettings', 'StudentDocument', 'ParentDocument',
] as const;

type BusinessModel = typeof BUSINESS_MODELS[number];
type SheetRows = { model: BusinessModel; rows: Record<string, unknown>[] };

@Injectable()
export class DataTransferService {
  constructor(private readonly prisma: PrismaService) {}

  private metadata(model: BusinessModel) {
    const metadata = Prisma.dmmf.datamodel.models.find((item) => item.name === model);
    if (!metadata) throw new BadRequestException(`Table inconnue : ${model}.`);
    return metadata.fields.filter((field) => field.kind !== 'object' && field.name !== 'staffQrToken');
  }

  private model(name: string): BusinessModel {
    if (!BUSINESS_MODELS.includes(name as BusinessModel)) throw new BadRequestException('Table métier inconnue.');
    return name as BusinessModel;
  }

  private delegate(prisma: any, model: BusinessModel) {
    return prisma[model[0].toLowerCase() + model.slice(1)];
  }

  async export(format: string, modelName?: string) {
    if (format !== 'xlsx' && format !== 'csv') throw new BadRequestException('Format xlsx ou csv requis.');
    if (format === 'csv' && !modelName) throw new BadRequestException('Choisissez une table pour le CSV.');
    const models = modelName ? [this.model(modelName)] : [...BUSINESS_MODELS];
    const workbook = new ExcelJS.Workbook();
    for (const model of models) {
      const fields = this.metadata(model);
      const rows = await this.delegate(this.prisma, model).findMany({ take: 50001 });
      if (rows.length > 50000) throw new BadRequestException(`La table ${model} dépasse la limite de 50 000 lignes.`);
      const sheet = workbook.addWorksheet(model);
      sheet.addRow(fields.map((field) => field.name));
      for (const row of rows) sheet.addRow(fields.map((field) => {
        const value = row[field.name];
        if (value instanceof Date) return value.toISOString();
        if (typeof value === 'string' && /^[=+@-]/.test(value)) return `'${value}`;
        return value ?? '';
      }));
      sheet.getRow(1).font = { bold: true };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }
    const data = format === 'csv' ? await workbook.csv.writeBuffer({ sheetName: models[0] }) : await workbook.xlsx.writeBuffer();
    return { data: Buffer.from(data), filename: `as-sakina-${modelName || 'donnees'}.${format}`, mime: format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  async preview(file: { originalname: string; buffer: Buffer }, modelName?: string) {
    const sheets = await this.parse(file, modelName);
    return { tables: sheets.map((sheet) => ({ model: sheet.model, rows: sheet.rows.length })), totalRows: sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0), mode: 'insert-only' };
  }

  async import(file: { originalname: string; buffer: Buffer }, modelName?: string) {
    const sheets = await this.parse(file, modelName);
    const created = await this.prisma.$transaction(async (tx) => {
      const counts: { model: BusinessModel; created: number }[] = [];
      for (const sheet of sheets) {
        if (!sheet.rows.length) continue;
        const result = await this.delegate(tx, sheet.model).createMany({ data: sheet.rows, skipDuplicates: true });
        counts.push({ model: sheet.model, created: result.count });
      }
      return counts;
    }, { timeout: 120000 });
    return { created, mode: 'insert-only' };
  }

  private async parse(file: { originalname: string; buffer: Buffer }, modelName?: string): Promise<SheetRows[]> {
    if (!file?.buffer?.length || file.buffer.length > 10 * 1024 * 1024) throw new BadRequestException('Fichier absent ou supérieur à 10 Mo.');
    const workbook = new ExcelJS.Workbook();
    const name = file.originalname?.toLowerCase() || '';
    if (name.endsWith('.csv')) {
      if (!modelName) throw new BadRequestException('Choisissez la table du CSV.');
      const stream = require('node:stream').Readable.from(file.buffer);
      await workbook.csv.read(stream, { sheetName: this.model(modelName) });
    } else if (name.endsWith('.xlsx')) {
      await workbook.xlsx.load(file.buffer as any);
    } else throw new BadRequestException('Seuls les fichiers .xlsx et .csv sont acceptés.');
    const sheets: SheetRows[] = [];
    for (const sheet of workbook.worksheets) {
      const model = this.model(sheet.name);
      const fields = this.metadata(model);
      const fieldMap = new Map(fields.map((field) => [field.name, field]));
      const headers = (sheet.getRow(1).values as unknown[]).slice(1).map((value) => String(value || '').trim());
      if (!headers.length || headers.some((header) => !fieldMap.has(header)) || new Set(headers).size !== headers.length) {
        throw new BadRequestException(`Colonnes invalides dans ${model}. Utilisez le fichier exporté comme modèle.`);
      }
      const rows: Record<string, unknown>[] = [];
      sheet.eachRow((row, index) => {
        if (index === 1) return;
        if (rows.length >= 5000) throw new BadRequestException(`La table ${model} dépasse 5 000 lignes importables.`);
        const data: Record<string, unknown> = {};
        headers.forEach((header, column) => {
          const cell = row.getCell(column + 1);
          const value = cell.value;
          if (value === null || value === '') return;
          if (typeof value === 'object' && !(value instanceof Date)) throw new BadRequestException(`Cellule complexe ou formule interdite : ${model}, ligne ${index}.`);
          const field = fieldMap.get(header)!;
          const text = String(value).replace(/^'(?=[=+@-])/, '');
          if (field.type === 'DateTime') {
            const date = value instanceof Date ? value : new Date(text);
            if (Number.isNaN(date.getTime())) throw new BadRequestException(`Date invalide : ${model}, ligne ${index}.`);
            data[header] = date;
          } else if (field.type === 'Int' || field.type === 'Float' || field.type === 'Decimal') {
            const number = Number(value);
            if (!Number.isFinite(number) || (field.type === 'Int' && !Number.isInteger(number))) throw new BadRequestException(`Nombre invalide : ${model}, ligne ${index}.`);
            data[header] = number;
          } else if (field.type === 'Boolean') {
            if (!['true', 'false', '1', '0'].includes(text.toLowerCase())) throw new BadRequestException(`Booléen invalide : ${model}, ligne ${index}.`);
            data[header] = text.toLowerCase() === 'true' || text === '1';
          } else data[header] = text;
        });
        if (Object.keys(data).length) rows.push(data);
      });
      sheets.push({ model, rows });
    }
    if (!sheets.length) throw new BadRequestException('Aucune feuille métier trouvée.');
    sheets.sort((a, b) => BUSINESS_MODELS.indexOf(a.model) - BUSINESS_MODELS.indexOf(b.model));
    return sheets;
  }
}
