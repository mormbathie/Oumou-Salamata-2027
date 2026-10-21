import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { DataTransferService, EXPORT_MODELS } from './data-transfer.service';
import { EXPORT_MARKER, TABLE_LABELS } from './export-design';

describe('Formatted school exports', () => {
  function setup() {
    const records: Record<string,any[]> = {
      AcademicYear:[{id:'year',name:'2026/2027',startDate:new Date('2026-09-01'),endDate:new Date('2027-07-31'),isCurrent:true}],
      Parent:[{id:'parent',firstName:'Awa',lastName:'Diop',phone:'0771234567'}],
      Student:[{id:'student',matricule:'OS-2026-0001',firstName:'Élève',lastName:'DIOP',dateOfBirth:new Date('2022-01-12T00:00:00Z'),gender:'FEMALE',status:'ACTIVE',fullDay:true,karate:false,parentId:'parent',address:'Dakar, Sénégal',healthNotes:'Ligne 1\nLigne "2"'}],
      Invoice:[{id:'invoice',invoiceNumber:'FAC-001',studentId:'student',academicYearId:'year',title:'Inscription',type:'REGISTRATION',amount:60000,paidAmount:40000,balance:20000,dueDate:new Date('2026-10-01'),status:'PARTIAL'}],
      Refund:[{id:'refund',refundNumber:'REM-001',paymentId:'payment',amount:10000,refundedOn:new Date('2026-10-20'),paymentMethod:'CASH',mode:'ALREADY_PAID_REGULARIZATION'}],
      Payment:[{id:'payment',paymentNumber:'REC-001',invoiceId:'invoice',amount:40000,paymentDate:new Date('2026-10-01'),paymentMethod:'CASH'}],
    };
    const db: any = { $executeRawUnsafe:jest.fn() };
    for(const name of [...EXPORT_MODELS,'User']) db[name[0].toLowerCase()+name.slice(1)]={findMany:jest.fn(async()=>records[name]||[]),createMany:jest.fn(async({data})=>({count:data.length}))};
    db.$transaction=jest.fn(async fn=>fn(db));
    return {db,records,service:new DataTransferService(db)};
  }
  async function workbook(buffer: Buffer) { const wb=new ExcelJS.Workbook();await wb.xlsx.load(buffer as any);return wb; }
  it('builds a branded workbook with a linked summary, reusable logo, French labels, filters and frozen panes', async()=>{
    const {service}=setup();const result=await service.export('xlsx');const wb=await workbook(result.data);
    expect(wb.worksheets).toHaveLength(EXPORT_MODELS.length+1);
    expect(wb.worksheets[0].name).toBe('Sommaire');expect(wb.worksheets[0].getCell('A6').value).toBe(EXPORT_MARKER+'|INDEX');
    const sheet=wb.getWorksheet('Élèves')!;expect(sheet.getImages()).toHaveLength(1);expect(sheet.getRow(7).hidden).toBe(true);expect(sheet.views[0]).toMatchObject({state:'frozen',ySplit:8});expect(sheet.autoFilter).toBeTruthy();
    expect((sheet.getRow(8).values as any[])).toContain('Prénom');expect((sheet.getRow(8).values as any[])).toContain('Parent (repère)');
    expect(sheet.getCell(9,(sheet.getRow(7).values as any[]).indexOf('__info_parentId')).value).toBe('Awa · Diop');
    expect((await JSZip.loadAsync(result.data)).file(/xl\/media\//)).toHaveLength(1);
  });
  it('round-trips the formatted data, French enum/boolean labels and dates without importing consultation-only ledgers',async()=>{
    const {service,db}=setup();const result=await service.export('xlsx');const preview=await service.preview({originalname:'export.xlsx',buffer:result.data});
    expect(preview.ignoredTables).toContain('Refund');expect(preview.tables.find(t=>t.model==='Student')?.rows).toBe(1);
    await service.import({originalname:'export.xlsx',buffer:result.data});
    expect(db.student.createMany).toHaveBeenCalledWith({skipDuplicates:true,data:[expect.objectContaining({id:'student',firstName:'Élève',gender:'FEMALE',status:'ACTIVE',dateOfBirth:new Date('2022-01-12'),fullDay:true,karate:false,parentId:'parent',healthNotes:'Ligne 1\nLigne "2"'})]});
    expect(db.refund.createMany).not.toHaveBeenCalled();
    expect(db.invoice.createMany.mock.calls[0][0].data[0]).toMatchObject({amount:60000,paidAmount:40000,balance:20000,status:'PARTIAL',type:'REGISTRATION'});
  });
  it('exports one chosen table in Excel and keeps dates, amounts and telephone text typed correctly',async()=>{
    const {service}=setup();const wb=await workbook((await service.export('xlsx','Invoice')).data);expect(wb.worksheets.map(s=>s.name)).toEqual(['Sommaire','Factures']);
    const sheet=wb.getWorksheet('Factures')!,headers=sheet.getRow(7).values as any[];
    expect(sheet.getCell(9,headers.indexOf('amount')).value).toBe(60000);expect(sheet.getCell(9,headers.indexOf('amount')).numFmt).toContain('F CFA');expect(sheet.getCell(9,headers.indexOf('dueDate')).value).toBeInstanceOf(Date);
  });
  it('writes UTF-8 CSV with accents, quotes, line breaks, leading zeros and reversible formula protection',async()=>{
    const {service,db,records}=setup();records.Parent=[{id:'p',firstName:'=HYPERLINK("bad")',lastName:"'=literal",phone:'0771234567',address:'  =1+1',profession:'\t=cmd',email:'normal@example.test'}];
    const result=await service.export('csv','Parent');expect(result.data.subarray(0,3)).toEqual(Buffer.from([239,187,191]));
    await service.import({originalname:'parents.csv',buffer:result.data},'Parent');
    expect(db.parent.createMany.mock.calls[0][0].data[0]).toMatchObject(records.Parent[0]);
    const student=await service.export('csv','Student');await service.import({originalname:'eleves.csv',buffer:student.data},'Student');expect(db.student.createMany.mock.calls[0][0].data[0].healthNotes).toBe('Ligne 1\nLigne "2"');
  });
  it('downloads all CSV tables as a ZIP with a guide and cannot reimport protected registries',async()=>{
    const {service}=setup();const result=await service.export('csv');expect(result.mime).toBe('application/zip');expect(result.filename).toMatch(/\.zip$/);const zip=await JSZip.loadAsync(result.data);
    expect(zip.file(/\.csv$/)).toHaveLength(EXPORT_MODELS.length);expect(await zip.file('LIRE-MOI.txt')!.async('string')).toContain('consultation uniquement');
    await expect(service.preview({originalname:'refund.csv',buffer:await zip.file('Refund.csv')!.async('nodebuffer')},'Refund')).rejects.toThrow();
    const ledger=await service.export('xlsx','Refund');expect((await service.preview({originalname:'refund.xlsx',buffer:ledger.data})).ignoredTables).toEqual(['Refund']);await expect(service.import({originalname:'refund.xlsx',buffer:ledger.data})).rejects.toThrow('uniquement');
  });
  it('still accepts old raw XLSX templates and rejects formulas instead of executing them',async()=>{
    const {service,db}=setup();const wb=new ExcelJS.Workbook(),sheet=wb.addWorksheet('Parent');sheet.addRow(['id','firstName','lastName','phone']);sheet.addRow(['legacy','Ancien','Modèle','0771234567']);
    await service.import({originalname:'legacy.xlsx',buffer:Buffer.from(await wb.xlsx.writeBuffer())});expect(db.parent.createMany.mock.calls[0][0].data[0].phone).toBe('0771234567');
    sheet.getCell('B2').value={formula:'1+1'};await expect(service.preview({originalname:'formula.xlsx',buffer:Buffer.from(await wb.xlsx.writeBuffer())})).rejects.toThrow('formule');
  });
  it('does not query secrets or identity tables for export and rejects invalid requests',async()=>{
    const {service,db}=setup();await expect(service.export('xlsx','User')).rejects.toThrow();await expect(service.export('pdf')).rejects.toThrow();expect(db.$transaction).not.toHaveBeenCalled();
    expect(service.exportModels().map(m=>m.name)).not.toContain('StaffDoorBadge');
  });
  it('releases the export guard after failure and prevents concurrent heavy jobs',async()=>{
    const {service,db}=setup();let release!:()=>void;const barrier=new Promise<void>(r=>release=r);db.$transaction.mockImplementationOnce(async()=>{await barrier;throw new Error('DB failed');});const first=service.export('xlsx','Student');await expect(service.export('csv','Student')).rejects.toThrow('déjà en cours');release();await expect(first).rejects.toThrow('DB failed');expect((await service.export('csv','Student')).mime).toContain('csv');
  });
});
