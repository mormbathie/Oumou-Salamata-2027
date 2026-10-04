import { useEffect, useState } from 'react';
import { dataTransferApi } from '../services/api';

const messageFrom = (error: any) => error.response?.data?.message || error.message || 'Opération impossible.';

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
    if (!file || !preview || !window.confirm(`Importer ${preview.totalRows} ligne(s) ? Les lignes existantes seront conservées.`)) return;
    setBusy(true); setError('');
    try {
      const result = await dataTransferApi.import(file, file.name.toLowerCase().endsWith('.csv') ? model : undefined);
      setMessage(`${result.created.reduce((sum: number, row: any) => sum + row.created, 0)} nouvelle(s) ligne(s) enregistrée(s).`);
      setPreview(null);
    } catch (err) { setError(messageFrom(err)); }
    finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-3xl space-y-5">
    <div><h2 className="text-2xl font-bold">Import et export des données</h2><p className="mt-1 text-sm text-slate-600">Réservé aux administrateurs. Un fichier XLSX contient une feuille par table ; un CSV concerne une seule table.</p></div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <section className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="font-bold">Exporter</h3><p className="mt-1 text-sm text-slate-500">Utilisez l’export comme modèle pour préparer un import. Les fichiers de documents eux-mêmes ne sont pas inclus.</p><div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} onClick={() => void download('xlsx')} className="rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white">Toutes les tables · Excel</button><select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border p-3">{models.map((name) => <option key={name}>{name}</option>)}</select><button disabled={busy} onClick={() => void download('csv', model)} className="rounded-lg border border-emerald-600 px-4 py-3 font-semibold text-emerald-700">Table choisie · CSV</button></div></section>
    <section className="rounded-2xl bg-white p-5 shadow-sm"><h3 className="font-bold">Importer</h3><p className="mt-1 text-sm text-slate-500">L’import ajoute les identifiants absents. Il ne remplace pas les enregistrements existants et échoue entièrement si une relation est invalide. Les comptes Keycloak et les fichiers de documents sont gérés séparément.</p><input type="file" accept=".xlsx,.csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); }} className="mt-4 block w-full text-sm" /><div className="mt-3 flex flex-wrap gap-3"><button disabled={busy || !file} onClick={inspect} className="rounded-lg border border-emerald-600 px-4 py-3 font-semibold text-emerald-700 disabled:opacity-50">Prévisualiser</button>{preview && <button disabled={busy} onClick={execute} className="rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white">Importer les lignes absentes</button>}</div>{preview && <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm"><p className="font-semibold">{preview.totalRows} ligne(s) à examiner</p><ul className="mt-2 space-y-1">{preview.tables.map((table: any) => <li key={table.model}>{table.model} : {table.rows}</li>)}</ul></div>}</section>
  </div>;
};
