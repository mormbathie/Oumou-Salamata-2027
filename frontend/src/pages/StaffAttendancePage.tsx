import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { staffAttendanceApi } from '../services/api';
import { useAuth } from '../auth/AuthContext';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const errorMessage = (error: any) => error.response?.data?.message || error.message || 'Une erreur est survenue.';

export const StaffAttendancePage = () => {
  const { user } = useAuth();
  const isManager = Boolean(user?.roles?.some((role) => ['ADMIN', 'DIRECTEUR'].includes(role)));
  const [date, setDate] = useState(today());
  const [roster, setRoster] = useState<any>(null);
  const [calendar, setCalendar] = useState<any>(null);
  const [code, setCode] = useState('');
  const [cameraActive, setCameraActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<any>(null);
  const busyRef = useRef(false);
  const lastScanRef = useRef({ code: '', at: 0 });

  const load = useCallback(async () => {
    try { setRoster(await staffAttendanceApi.list(date)); setCalendar(await staffAttendanceApi.getCalendar()); }
    catch (err) { setError(errorMessage(err)); }
  }, [date]);
  useEffect(() => { void load(); }, [load]);

  const scan = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value || busyRef.current || (lastScanRef.current.code === value && Date.now() - lastScanRef.current.at < 5000)) return;
    lastScanRef.current = { code: value, at: Date.now() };
    busyRef.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await staffAttendanceApi.scan(value);
      const event = result.event === 'arrival' ? 'Arrivée enregistrée' : result.event === 'departure' ? 'Départ enregistré' : 'Pointage déjà complet';
      setMessage(`${result.teacher.firstName} ${result.teacher.lastName} · ${event}${result.attendance.minutesLate ? ` · ${result.attendance.minutesLate} min de retard` : ''}`);
      setCode('');
      await load();
    } catch (err) { setError(errorMessage(err)); }
    finally { busyRef.current = false; setBusy(false); }
  }, [load]);

  useEffect(() => {
    if (!cameraActive || !videoRef.current) return;
    let disposed = false;
    const reader = new BrowserMultiFormatReader();
    reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' } } }, videoRef.current, (result) => {
      if (result) void scan(result.getText());
    }).then((controls) => { if (disposed) controls.stop(); else controlsRef.current = controls; })
      .catch(() => { if (!disposed) { setCameraActive(false); setError('Caméra indisponible. Vous pouvez saisir le code manuellement.'); } });
    return () => { disposed = true; controlsRef.current?.stop(); controlsRef.current = null; };
  }, [cameraActive, scan]);

  const finalize = async () => {
    if (!window.confirm(`Marquer absents les professeurs non pointés le ${date} ?`)) return;
    try { const result = await staffAttendanceApi.finalize(date); setMessage(`${result.absencesRecorded} absence(s) enregistrée(s).`); await load(); }
    catch (err) { setError(errorMessage(err)); }
  };

  const saveCalendar = async () => {
    try {
      await staffAttendanceApi.updateCalendar({ ...calendar.settings, restDays: String(calendar.settings.restDays).split(',').filter(Boolean).map(Number) });
      setMessage('Calendrier enregistré.'); await load();
    } catch (err) { setError(errorMessage(err)); }
  };

  const addHoliday = async () => {
    try { await staffAttendanceApi.addHoliday(holidayDate, holidayName); setHolidayDate(''); setHolidayName(''); setMessage('Jour férié enregistré.'); await load(); }
    catch (err) { setError(errorMessage(err)); }
  };

  return <div className="mx-auto max-w-6xl space-y-5">
    <div><h2 className="text-2xl font-bold">Pointage des professeurs</h2><p className="text-sm text-slate-600">Scanner le QR code personnel à l’arrivée puis au départ.</p></div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex justify-between gap-3"><h3 className="font-bold">Scanner</h3><button onClick={() => setCameraActive(!cameraActive)} className="text-sm text-emerald-700">{cameraActive ? 'Arrêter' : 'Démarrer'} la caméra</button></div>
        <div className="overflow-hidden rounded-xl bg-slate-950"><video ref={videoRef} muted playsInline className={`h-[min(42dvh,360px)] min-h-52 w-full object-contain ${cameraActive ? 'block' : 'hidden'}`} />{!cameraActive && <div className="grid min-h-52 place-items-center text-slate-400">Caméra arrêtée</div>}</div>
        <form onSubmit={(event) => { event.preventDefault(); void scan(code); }} className="mt-3 flex flex-wrap gap-2"><input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Code du professeur" className="min-w-0 flex-1 rounded-lg border p-3" /><button disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white">Enregistrer</button></form>
      </section>
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Présences du jour</h3><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-lg border p-2" /></div>
        {roster?.holiday && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm">Jour férié : {roster.holiday.name}</p>}
        {roster?.isRestDay && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm">Jour de repos</p>}
        <div className="mt-3 max-h-96 overflow-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Professeur</th><th className="p-2">Arrivée</th><th className="p-2">Départ</th><th className="p-2">État</th></tr></thead><tbody>{roster?.teachers?.map((teacher: any) => <tr key={teacher.id} className="border-b"><td className="p-2">{teacher.firstName} {teacher.lastName}</td><td className="p-2">{teacher.attendance?.checkInAt ? new Date(teacher.attendance.checkInAt).toLocaleTimeString('fr-FR') : '—'}</td><td className="p-2">{teacher.attendance?.checkOutAt ? new Date(teacher.attendance.checkOutAt).toLocaleTimeString('fr-FR') : '—'}</td><td className="p-2">{teacher.attendance?.status || 'Non pointé'}</td></tr>)}</tbody></table></div>
        {isManager && !roster?.isRestDay && !roster?.holiday && <button onClick={finalize} className="mt-4 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700">Clôturer les absences</button>}
      </section>
    </div>
    {isManager && calendar && <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5"><h3 className="font-bold">Calendrier de travail</h3><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-sm">Jours de repos (0=dimanche, 6=samedi)<input value={calendar.settings.restDays} onChange={(event) => setCalendar({ ...calendar, settings: { ...calendar.settings, restDays: event.target.value } })} className="mt-1 w-full rounded-lg border p-2" /></label><label className="text-sm">Début de journée<input type="time" value={calendar.settings.startTime} onChange={(event) => setCalendar({ ...calendar, settings: { ...calendar.settings, startTime: event.target.value } })} className="mt-1 w-full rounded-lg border p-2" /></label><label className="text-sm">Fuseau horaire<input value={calendar.settings.timeZone} onChange={(event) => setCalendar({ ...calendar, settings: { ...calendar.settings, timeZone: event.target.value } })} className="mt-1 w-full rounded-lg border p-2" /></label></div><button onClick={saveCalendar} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Enregistrer le calendrier</button>
      <h4 className="mt-6 font-semibold">Jours fériés et fermetures</h4><div className="mt-2 flex flex-wrap gap-2"><input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} className="rounded-lg border p-2" /><input value={holidayName} onChange={(e) => setHolidayName(e.target.value)} placeholder="Nom du jour" className="min-w-0 flex-1 rounded-lg border p-2" /><button onClick={addHoliday} className="rounded-lg bg-emerald-700 px-4 py-2 text-white">Ajouter</button></div><ul className="mt-3 space-y-1 text-sm">{calendar.holidays.map((holiday: any) => <li key={holiday.id} className="flex justify-between gap-3 border-b py-2"><span>{holiday.date.slice(0, 10)} · {holiday.name}</span><button onClick={() => { void staffAttendanceApi.removeHoliday(holiday.id).then(load).catch((err) => setError(errorMessage(err))); }} className="text-rose-700">Supprimer</button></li>)}</ul>
    </section>}
  </div>;
};
