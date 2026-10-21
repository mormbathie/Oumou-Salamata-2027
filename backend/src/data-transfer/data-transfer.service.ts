import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { EXPORT_MARKER, READ_ONLY_MODELS, TABLE_LABELS, ENUM_LABELS, REFERENCES, styledWorkbook, type ExportTable } from './export-design';
import { PrismaService } from '../prisma/prisma.service';

// Parent tables precede dependent tables so an entire workbook can be inserted atomically.
export const BUSINESS_MODELS = [
  'AcademicYear', 'Parent', 'Subject', 'Student', 'Classroom', 'Enrollment',
  'Grade', 'ReportCard', 'Invoice', 'Payment', 'Attendance', 'StaffAttendance',
  'SchoolHoliday', 'SchoolCalendarSettings', 'StudentDocument', 'ParentDocument',
] as const;

export const EXPORT_MODELS = [...BUSINESS_MODELS, ...READ_ONLY_MODELS] as const;
type BusinessModel = typeof BUSINESS_MODELS[number];
type ExportModel = typeof EXPORT_MODELS[number];
type SheetRows = { model: BusinessModel; rows: Record<string, unknown>[] };

@Injectable()
export class DataTransferService {
  constructor(private readonly prisma: PrismaService) {}

  private metadata(model: ExportModel) {
    const metadata = Prisma.dmmf.datamodel.models.find((item) => item.name === model);
    if (!metadata) throw new BadRequestException(`Table inconnue : ${model}.`);
    return metadata.fields.filter((field) => field.kind !== 'object' && field.name !== 'staffQrToken');
  }

  private model(name: string): BusinessModel {
    if (!BUSINESS_MODELS.includes(name as BusinessModel)) throw new BadRequestException('Table métier inconnue.');
    return name as BusinessModel;
  }

  private delegate(prisma: any, model: string) {
    return prisma[model[0].toLowerCase() + model.slice(1)];
  }

  private exporting = false;

  exportModels() { return EXPORT_MODELS.map(name => ({ name, label: TABLE_LABELS[name], importable: BUSINESS_MODELS.includes(name as BusinessModel) })); }

  async export(format: string, modelName?: string) {
    if (format !== 'xlsx' && format !== 'csv') throw new BadRequestException('Format xlsx ou csv requis.');
    if (modelName && !EXPORT_MODELS.includes(modelName as ExportModel)) throw new BadRequestException('Table métier inconnue.');
    if (this.exporting) throw new ServiceUnavailableException('Un export est déjà en cours. Réessayez après son téléchargement.');
    this.exporting = true;
    try {
      const models = modelName ? [modelName as ExportModel] : [...EXPORT_MODELS];
      const tables = await this.prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        const result: ExportTable[] = []; let rowCount = 0, cells = 0;
        for (const model of models) {
          const fields = this.metadata(model);
          const primary = fields.find(f => f.isId)!;
          const names = new Set(fields.map(f=>f.name));
          const ordering = names.has('lastName') ? [{lastName:'asc'},{firstName:'asc'}] : names.has('name') ? [{name:'asc'}] : ['refundedOn','departedOn','paymentDate','date','startDate','createdAt'].filter(key=>names.has(key)).slice(0,1).map(key=>({[key]:'desc'}));
          const rows = await this.delegate(tx, model).findMany({ take: 50001, select: Object.fromEntries(fields.map(f => [f.name,true])), orderBy: [...ordering,{ [primary.name]: 'asc' }] });
          if (rows.length > 50000) throw new BadRequestException(`La table ${model} dépasse la limite de 50 000 lignes.`);
          rowCount += rows.length; cells += rows.length * (fields.length + fields.filter(f => REFERENCES[f.name]).length);
          if (rowCount > 100000 || cells > 1000000) throw new BadRequestException('Cet export est trop volumineux. Exportez les tables séparément.');
          if (format === 'xlsx' && rows.some(row => fields.some(f => typeof row[f.name] === 'string' && row[f.name].length > 32767))) throw new BadRequestException(`Une cellule de ${TABLE_LABELS[model]} dépasse la capacité Excel. Utilisez le CSV pour conserver le texte intégral.`);
          result.push({ model, fields, rows, references: {}, readOnly: READ_ONLY_MODELS.includes(model as any) });
        }
        if (format === 'xlsx') {
          const loaded = new Map(result.map(t => [t.model,t]));
          for (const table of result) for (const field of table.fields) {
            const reference = REFERENCES[field.name]; if (!reference) continue;
            const ids = [...new Set(table.rows.map(r => r[field.name]).filter(Boolean))] as string[];
            if (!ids.length) { table.references[field.name] = new Map(); continue; }
            const cached = loaded.get(reference.model); const records: any[] = cached ? cached.rows : [];
            if (!cached) for (let i=0;i<ids.length;i+=500) records.push(...await this.delegate(tx,reference.model).findMany({ where:{id:{in:ids.slice(i,i+500)}},select:Object.fromEntries(['id',...reference.fields].map(key=>[key,true])) }));
            table.references[field.name] = new Map(records.map(row => [row.id,reference.fields.map(key=>row[key]).filter(Boolean).join(' · ')]));
          }
        }
        return result;
      }, { isolationLevel: 'RepeatableRead', timeout: 60000 });
      const stamp = new Date().toISOString().slice(0,10);
      if (format === 'xlsx') return { data: await styledWorkbook(tables), filename: `as-sakina-${modelName || 'toutes-les-tables'}-${stamp}.xlsx`, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
      const csv = (table: ExportTable) => {
        const cell = (value: any, isText = false) => {
          let text = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value);
          if (isText && (/^['\t\r\n]/.test(text) || /^\s*[=+@-]/.test(text))) text = "'" + text;
          return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g,'""') + '"' : text;
        };
        return '\uFEFF' + [table.fields.map(f=>cell(f.name)).join(','), ...table.rows.map(row=>table.fields.map(f=>cell(row[f.name], f.type==='String'||f.kind==='enum')).join(','))].join('\r\n') + '\r\n';
      };
      if (modelName) return { data: Buffer.from(csv(tables[0]),'utf8'), filename: `as-sakina-${modelName}-${stamp}.csv`, mime: 'text/csv; charset=utf-8' };
      const zip = new JSZip();
      for (const table of tables) zip.file(table.model+'.csv',csv(table));
      zip.file('LIRE-MOI.txt', 'ÉCOLE AS SAKINA — EXPORT CSV\r\n\r\nUn fichier UTF-8 par table. Le CSV ne contient ni logo ni couleurs : choisissez Excel pour la présentation.\r\nPour réimporter : décompressez cette archive, puis choisissez une table importable dans l’application et son CSV. Les identifiants et les valeurs techniques sont conservés.\r\nLes tables de remboursement, départ, caisse et audit sont en consultation uniquement ; elles ne peuvent pas être importées.\r\nLes comptes, secrets, photos de profil, QR codes d’accès et fichiers joints ne sont pas inclus.\r\n\r\n' + tables.map(t=>`${TABLE_LABELS[t.model]} (${t.model}.csv) : ${t.rows.length} lignes — ${t.readOnly?'consultation uniquement':'importable'}`).join('\r\n'));
      return { data: await zip.generateAsync({ type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:3} }), filename:`as-sakina-toutes-les-tables-${stamp}.zip`,mime:'application/zip' };
    } finally { this.exporting = false; }
  }

  async preview(file: { originalname: string; buffer: Buffer }, modelName?: string) {
    const { sheets, ignoredTables } = await this.parse(file, modelName);
    return { tables: sheets.map((sheet) => ({ model: sheet.model, rows: sheet.rows.length })), totalRows: sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0), ignoredTables, mode: 'insert-only' };
  }

  async import(file: { originalname: string; buffer: Buffer }, modelName?: string) {
    const { sheets, ignoredTables } = await this.parse(file, modelName);
    if (!sheets.length) throw new BadRequestException('Ce fichier contient uniquement des registres de consultation, non importables.');
    const created = await this.prisma.$transaction(async (tx) => {
      const counts: { model: BusinessModel; created: number }[] = [];
      for (const sheet of sheets) {
        if (!sheet.rows.length) continue;
        const result = await this.delegate(tx, sheet.model).createMany({ data: sheet.rows, skipDuplicates: true });
        counts.push({ model: sheet.model, created: result.count });
      }
      return counts;
    }, { timeout: 120000 });
    return { created, ignoredTables, mode: 'insert-only' };
  }

  private async parse(file: { originalname: string; buffer: Buffer }, modelName?: string): Promise<{sheets: SheetRows[]; ignoredTables: string[]}> {
    if (!file?.buffer?.length || file.buffer.length > 10 * 1024 * 1024) throw new BadRequestException('Fichier absent ou supérieur à 10 Mo.');
    const workbook = new ExcelJS.Workbook();
    const name = file.originalname?.toLowerCase() || '';
    if (name.endsWith('.csv')) {
      if (!modelName) throw new BadRequestException('Choisissez la table du CSV.');
      const stream = require('node:stream').Readable.from(file.buffer);
      await workbook.csv.read(stream, { sheetName: this.model(modelName), map: (value: string) => value });
    } else if (name.endsWith('.xlsx')) {
      await workbook.xlsx.load(file.buffer as any);
    } else throw new BadRequestException('Seuls les fichiers .xlsx et .csv sont acceptés.');
    const sheets: SheetRows[] = []; const ignoredTables: string[] = []; const seen = new Set<string>();
    for (const sheet of workbook.worksheets) {
      const marker = sheet.getCell('A6').value;
      const branded = name.endsWith('.xlsx') && typeof marker === 'string' && marker.startsWith(EXPORT_MARKER+'|');
      if (branded && marker === EXPORT_MARKER+'|INDEX') continue;
      const segments = branded ? String(marker).split('|') : [];
      if (branded && segments[1] === 'READONLY' && READ_ONLY_MODELS.includes(segments[2] as any)) { ignoredTables.push(segments[2]); continue; }
      if (branded && (segments[1] !== 'TABLE' || segments.length !== 3)) throw new BadRequestException('Métadonnées de feuille invalides.');
      const model = this.model(branded ? segments[2] : sheet.name);
      if (seen.has(model)) throw new BadRequestException(`La table ${model} apparaît plusieurs fois.`);
      seen.add(model);
      const headerRow = branded ? 7 : 1, dataStart = branded ? 9 : 2;
      const fields = this.metadata(model);
      const fieldMap = new Map(fields.map((field) => [field.name, field]));
      const headers = (sheet.getRow(headerRow).values as unknown[]).slice(1).map((value) => String(value || '').trim());
      const displayColumns = new Set(fields.filter(f=>REFERENCES[f.name]).map(f=>'__info_'+f.name));
      if (!headers.length || headers.every(header=>!fieldMap.has(header)) || headers.some((header) => !fieldMap.has(header) && !(branded && displayColumns.has(header))) || new Set(headers).size !== headers.length) {
        throw new BadRequestException(`Colonnes invalides dans ${model}. Utilisez le fichier exporté comme modèle.`);
      }
      const rows: Record<string, unknown>[] = [];
      sheet.eachRow((row, index) => {
        if (index < dataStart) return;
        if (rows.length >= 5000) throw new BadRequestException(`La table ${model} dépasse 5 000 lignes importables.`);
        const data: Record<string, unknown> = {};
        headers.forEach((header, column) => {
          const cell = row.getCell(column + 1);
          const value = cell.value;
          if (value === null || value === '') return;
          if (typeof value === 'object' && !(value instanceof Date)) throw new BadRequestException(`Cellule complexe ou formule interdite : ${model}, ligne ${index}.`);
          if (branded && displayColumns.has(header)) return;
          const field = fieldMap.get(header)!;
          const text = name.endsWith('.csv') ? String(value).replace(/^'(?=['\t\r\n]|\s*[=+@-])/, '') : String(value);
          if (field.type === 'DateTime') {
            const date = value instanceof Date ? value : new Date(text);
            if (Number.isNaN(date.getTime())) throw new BadRequestException(`Date invalide : ${model}, ligne ${index}.`);
            data[header] = date;
          } else if (field.type === 'Int' || field.type === 'Float' || field.type === 'Decimal') {
            const number = Number(value);
            if (!Number.isFinite(number) || (field.type === 'Int' && !Number.isInteger(number))) throw new BadRequestException(`Nombre invalide : ${model}, ligne ${index}.`);
            data[header] = number;
          } else if (field.type === 'Boolean') {
            if (!['true', 'false', '1', '0', ...(branded ? ['oui','non'] : [])].includes(text.toLowerCase())) throw new BadRequestException(`Booléen invalide : ${model}, ligne ${index}.`);
            data[header] = text.toLowerCase() === 'true' || text === '1' || (branded && text.toLowerCase() === 'oui');
          } else if (branded && field.kind === 'enum') {
            data[header] = Object.entries(ENUM_LABELS[field.type] || {}).find(([,label])=>label===text)?.[0] || text;
          } else data[header] = text;
        });
        if (Object.keys(data).length) rows.push(data);
      });
      sheets.push({ model, rows });
    }
    if (!sheets.length && !ignoredTables.length) throw new BadRequestException('Aucune feuille métier trouvée.');
    sheets.sort((a, b) => BUSINESS_MODELS.indexOf(a.model) - BUSINESS_MODELS.indexOf(b.model));
    return { sheets, ignoredTables };
  }
}
