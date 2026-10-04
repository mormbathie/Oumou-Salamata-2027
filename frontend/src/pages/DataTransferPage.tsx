import { t, modelLabel } from "../i18n/index";
import { useEffect, useState } from 'react';
import { dataTransferApi } from '../services/api';

const messageFrom = (error: any) => error.response?.data?.message || error.message || t("Unable to complete the operation.");

export const DataTransferPage = () => {
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('AcademicYear');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { void dataTransferApi.models().then(setModels).catch((err) => setError(messageFrom(err))); }, []);

  const download = async (format: 'xlsx' | 'csv', selected?: string) => {
    setBusy(true); setError('');
    try {
      const blob = await dataTransferApi.export(format, selected);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `as-sakina-${selected || 'donnees'}.${format}`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(messageFrom(err)); }
    finally { setBusy(false); }
  };

  const inspect = async () => {
    if (!file) return;
    setBusy(true); setError(''); setPreview(null); setMessage('');
    try { setPreview(await dataTransferApi.preview(file, file.name.toLowerCase().endsWith('.csv') ? model : undefined)); }
    catch (err) { setError(messageFrom(err)); }
    finally { setBusy(false); }
  };

  const execute = async () => {
    if (!file || !preview || !window.confirm(t("Import {0} rows? Existing records will be kept.", [preview.totalRows]))) return;
    setBusy(true); setError('');
    try {
      const result = await dataTransferApi.import(file, file.name.toLowerCase().endsWith('.csv') ? model : undefined);
      setMessage(t("{0} new rows added.", [result.created.reduce((sum: number, row: any) => sum + row.created, 0)]));
      setPreview(null);
    } catch (err) { setError(messageFrom(err)); }
    finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-3xl space-y-5">
    <div><h2 className="text-2xl font-bold">{t("Data Import and Export")}</h2><p className="mt-1 text-sm text-slate-600">{t("Administrators only. An XLSX file contains one sheet per table; a CSV file contains one table.")}</p></div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <section className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="font-bold">{t("Export")}</h3><p className="mt-1 text-sm text-slate-500">{t("Use an export as a template for importing. Document files are not included.")}</p><div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} onClick={() => void download('xlsx')} className="rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white">{t("All tables · Excel")}</button><select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border p-3">{models.map((name) => <option key={name} value={name}>{modelLabel(name)}</option>)}</select><button disabled={busy} onClick={() => void download('csv', model)} className="rounded-lg border border-emerald-600 px-4 py-3 font-semibold text-emerald-700">{t("Selected table · CSV")}</button></div></section>
    <section className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="font-bold">{t("Import")}</h3><p className="mt-1 text-sm text-slate-500">{t("Import adds missing records. It keeps existing records and stops if a relationship is invalid. User accounts and document files are managed separately.")}</p><input id="data-import-file" type="file" accept=".xlsx,.csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); }} className="sr-only" /><div className="mt-4 flex flex-wrap items-center gap-3"><label htmlFor="data-import-file" className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm">{t("Choose a file")}</label><span className="text-sm text-slate-500">{file?.name || t("No file selected")}</span></div><div className="mt-3 flex flex-wrap gap-3"><button disabled={busy || !file} onClick={inspect} className="rounded-lg border border-emerald-600 px-4 py-3 font-semibold text-emerald-700 disabled:opacity-50">{t("Preview")}</button>{preview && <button disabled={busy} onClick={execute} className="rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white">{t("Import missing rows")}</button>}</div>{preview && <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm"><p className="font-semibold">{preview.totalRows} {t("rows to review")}</p><ul className="mt-2 space-y-1">{preview.tables.map((table: any) => <li key={table.model}>{modelLabel(table.model)} : {table.rows}</li>)}</ul></div>}</section>
  </div>;
};
