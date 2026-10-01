import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import {
  AlertCircle, Camera, CameraOff, Check, CheckCircle2, Clock3, ScanLine,
  ShieldCheck, UserRound, Users, XCircle,
} from 'lucide-react';
import { attendanceApi, classesApi, studentsApi } from '../services/api';

function schoolDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function messageFrom(error: any) {
  const message = error?.response?.data?.message || error?.message;
  return Array.isArray(message) ? message.join(', ') : message || 'Une erreur est survenue.';
}

const statusLabels: Record<string, string> = {
  PRESENT: 'Présent',
  ABSENT: 'Absent',
  LATE: 'En retard',
  EXCUSED: 'Excusé',
};

function formatTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' });
}

export const AttendanceScanPage: React.FC = () => {
  const [classes, setClasses] = useState<any[]>([]);
  const [classroomId, setClassroomId] = useState('');
  const [roster, setRoster] = useState<any>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanError, setScanError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [lastScan, setLastScan] = useState<any>(null);
  const [lastScanPhoto, setLastScanPhoto] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeMessage, setFinalizeMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<any>(null);
  const inFlightRef = useRef(false);
  const today = schoolDate();

  useEffect(() => {
    let active = true;
    classesApi.getAll()
      .then((items) => {
        if (!active) return;
        setClasses(items);
        if (items.length) setClassroomId(items[0].id);
      })
      .catch((error) => setScanError(messageFrom(error)))
      .finally(() => { if (active) setLoadingClasses(false); });
    return () => { active = false; };
  }, []);

  const loadRoster = useCallback(async () => {
    if (!classroomId) {
      setRoster(null);
      return;
    }
    setLoadingRoster(true);
    try {
      setRoster(await attendanceApi.getScanRoster(classroomId, today));
    } catch (error) {
      setScanError(messageFrom(error));
    } finally {
      setLoadingRoster(false);
    }
  }, [classroomId, today]);

  useEffect(() => { void loadRoster(); }, [loadRoster]);

  const processScan = useCallback(async (code: string) => {
    if (!classroomId || !code.trim() || inFlightRef.current) return;
    inFlightRef.current = true;
    setScanBusy(true);
    setScanError('');
    setCameraActive(false);
    controlsRef.current?.stop();
    setFinalizeMessage('');
    try {
      const result = await attendanceApi.scanStudent({ qrCode: code.trim(), classroomId });
      setLastScan(result);
      setManualCode('');
      await loadRoster();
    } catch (error) {
      setScanError(messageFrom(error));
    } finally {
      setScanBusy(false);
      inFlightRef.current = false;
    }
  }, [classroomId, loadRoster]);

  useEffect(() => {
    if (!cameraActive || !classroomId || !videoRef.current) return;
    let disposed = false;
    const reader = new BrowserMultiFormatReader();
    setCameraError('');
    reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
      if (result && !inFlightRef.current) void processScan(result.getText());
    }).then((controls) => {
      if (disposed) controls.stop();
      else controlsRef.current = controls;
    }).catch((error: any) => {
      if (disposed) return;
      setCameraError(error?.name === 'NotAllowedError'
        ? 'Autorisez l’accès à la caméra dans le navigateur, ou saisissez le matricule ci-dessous.'
        : messageFrom(error));
      setCameraActive(false);
    });
    return () => {
      disposed = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [cameraActive, classroomId, processScan]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (lastScan?.student?.id) {
      studentsApi.getPhoto(lastScan.student.id)
        .then((blob) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(blob);
          setLastScanPhoto(objectUrl);
        })
        .catch(() => { if (active) setLastScanPhoto(''); });
    } else setLastScanPhoto('');
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [lastScan?.student?.id]);

  const finalizeAttendance = async () => {
    if (!classroomId || !window.confirm('Clôturer l’appel ? Tous les élèves sans pointage enregistré seront marqués absents.')) return;
    setFinalizing(true);
    setScanError('');
    setFinalizeMessage('');
    try {
      const result = await attendanceApi.finalizeScan({ classroomId, date: today });
      setRoster(result);
      setFinalizeMessage(result.absencesRecorded + ' absence(s) enregistrée(s). Un scan tardif corrigera l’absence et conservera l’heure d’arrivée.');
    } catch (error) {
      setScanError(messageFrom(error));
    } finally {
      setFinalizing(false);
    }
  };

  const summary = roster?.summary || { total: 0, present: 0, absent: 0, late: 0, excused: 0 };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <ScanLine className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Contrôle de présence</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Scanner les élèves</h2>
          <p className="mt-1 text-sm text-slate-500">Chaque scan enregistre l’arrivée une seule fois. Clôturez l’appel pour enregistrer les absences.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <Clock3 className="h-4 w-4 text-emerald-600" />
          {new Date(today + 'T12:00:00Z').toLocaleDateString('fr-FR', { dateStyle: 'full', timeZone: 'Africa/Dakar' })}
        </div>
      </div>

      {scanError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{scanError}</div>}
      {finalizeMessage && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{finalizeMessage}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-xs font-semibold text-slate-600">
              Classe
              <select value={classroomId} onChange={(event) => { setClassroomId(event.target.value); setLastScan(null); setScanError(''); }} disabled={loadingClasses || !classes.length} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                {classes.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name} · {classroom._count?.enrollments ?? 0} élèves</option>)}
              </select>
            </label>
            <button type="button" onClick={() => { setCameraError(''); setCameraActive((active) => !active); }} disabled={!classroomId || scanBusy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {cameraActive ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {cameraActive ? 'Arrêter la caméra' : 'Démarrer le scan'}
            </button>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-slate-950">
            <video ref={videoRef} className={'aspect-video w-full object-cover ' + (cameraActive ? '' : 'hidden')} muted playsInline />
            {!cameraActive && <div className="grid aspect-video place-items-center p-6 text-center text-slate-400"><div><Camera className="mx-auto mb-3 h-10 w-10 text-slate-600" /><p className="text-sm">La caméra est arrêtée</p><p className="mt-1 text-xs">Démarrez le scan ou saisissez un matricule.</p></div></div>}
            {scanBusy && <div className="absolute inset-0 grid place-items-center bg-slate-950/70 text-sm font-semibold text-white">Enregistrement du pointage…</div>}
          </div>
          {cameraError && <p role="alert" className="text-xs text-amber-700">{cameraError}</p>}

          <form onSubmit={(event) => { event.preventDefault(); void processScan(manualCode); }} className="flex flex-col gap-2 sm:flex-row">
            <input value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="QR code ou matricule (ex. OS-2026-0001)" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <button type="submit" disabled={!manualCode.trim() || scanBusy || !classroomId} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"><Check className="h-4 w-4" />Pointer</button>
          </form>

          {lastScan && (
            <div role="status" className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center">
              {lastScanPhoto ? <img src={lastScanPhoto} alt="" className="h-16 w-16 rounded-lg object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-lg bg-emerald-100 text-emerald-700"><UserRound className="h-7 w-7" /></div>}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-emerald-950">{lastScan.student.firstName} {lastScan.student.lastName}</p>
                <p className="font-mono text-xs text-emerald-800">{lastScan.student.matricule} · {lastScan.classroom.name}</p>
                <p className="mt-1 text-xs text-emerald-800">{lastScan.duplicate ? 'Déjà pointé' : 'Présence enregistrée'} à {formatTime(lastScan.attendance.checkInAt)}</p>
              </div>
              <button type="button" onClick={() => { setLastScan(null); setCameraActive(true); }} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">Scanner le suivant</button>
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="font-bold text-slate-900">Pointage du jour</h3><p className="text-xs text-slate-500">{roster?.classroom?.name || 'Choisissez une classe'}</p></div>
            <button type="button" onClick={() => void loadRoster()} disabled={loadingRoster || !classroomId} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{loadingRoster ? 'Actualisation…' : 'Actualiser'}</button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3"><span className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500"><Users className="h-3 w-3" />Total</span><b className="mt-1 block text-xl">{summary.total}</b></div>
            <div className="rounded-lg bg-emerald-50 p-3"><span className="text-[10px] font-bold uppercase text-emerald-700">Présents</span><b className="mt-1 block text-xl text-emerald-800">{summary.present}</b></div>
            <div className="rounded-lg bg-rose-50 p-3"><span className="text-[10px] font-bold uppercase text-rose-700">Absents</span><b className="mt-1 block text-xl text-rose-800">{summary.absent}</b></div>
            <div className="rounded-lg bg-amber-50 p-3"><span className="text-[10px] font-bold uppercase text-amber-700">Retards</span><b className="mt-1 block text-xl text-amber-800">{summary.late}</b></div>
          </div>

          <div className="max-h-[460px] overflow-auto rounded-lg border border-slate-100">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-2">Élève</th><th className="px-3 py-2">État</th><th className="px-3 py-2">Arrivée</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(roster?.students || []).map((student: any) => <tr key={student.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5"><span className="font-semibold text-slate-800">{student.firstName} {student.lastName}</span><span className="ml-2 font-mono text-[10px] text-slate-400">{student.matricule}</span></td>
                  <td className="px-3 py-2.5"><span className={'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ' + (student.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' : student.status === 'LATE' ? 'bg-amber-100 text-amber-800' : student.status === 'EXCUSED' ? 'bg-sky-100 text-sky-800' : 'bg-rose-100 text-rose-800')}>{student.status === 'PRESENT' ? <CheckCircle2 className="h-3 w-3" /> : student.status === 'ABSENT' ? <XCircle className="h-3 w-3" /> : null}{statusLabels[student.status] || student.status}{student.status === 'ABSENT' && !student.scanned ? ' · non scanné' : ''}</span></td>
                  <td className="px-3 py-2.5 text-slate-600">{formatTime(student.checkInAt)}</td>
                </tr>)}
                {!loadingRoster && roster?.students?.length === 0 && <tr><td colSpan={3} className="p-5 text-center text-slate-400">Aucun élève inscrit dans cette classe.</td></tr>}
                {loadingRoster && <tr><td colSpan={3} className="p-5 text-center text-slate-400">Chargement du registre…</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-1.5 text-[11px] text-slate-500"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />Les élèves non scannés deviennent absents à la clôture de l’appel.</p>
            <button type="button" onClick={() => void finalizeAttendance()} disabled={finalizing || loadingRoster || !classroomId} className="rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{finalizing ? 'Clôture…' : 'Clôturer l’appel'}</button>
          </div>
        </section>
      </div>
    </div>
  );
};
