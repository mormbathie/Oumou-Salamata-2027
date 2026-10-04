import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { staffAttendanceApi, usersApi } from '../services/api';
import { useAuth } from '../auth/AuthContext';

type Profile = { username: string; firstName: string; lastName: string; email: string; phone: string; emailVerified: boolean };

export const ProfilePage = () => {
  const { user } = useAuth();
  const isTeacher = Boolean(user?.roles?.includes('ENSEIGNANT'));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<any>(null);
  const [qr, setQr] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void usersApi.getOwnProfile().then(setProfile).catch((err) => setError(err.response?.data?.message || 'Profil indisponible.'));
    if (isTeacher) {
      void staffAttendanceApi.myCard().then((card) => QRCode.toDataURL(card.code, { width: 240, margin: 2 })).then(setQr).catch(() => {});
      void staffAttendanceApi.myHistory().then(setHistory).catch(() => {});
    }
  }, [isTeacher]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const updated = await usersApi.updateOwnProfile(profile);
      setProfile(updated);
      setMessage('Profil enregistré. Une nouvelle connexion peut être nécessaire pour actualiser votre nom dans le menu.');
    } catch (err: any) { setError(err.response?.data?.message || 'Modification impossible.'); }
    finally { setSaving(false); }
  };

  const verify = async () => {
    setError(''); setMessage('');
    try { await usersApi.requestEmailVerification(); setMessage('E-mail de vérification demandé. Vérifiez votre boîte de réception.'); }
    catch (err: any) { setError(err.response?.data?.message || 'Envoi impossible. Le service SMTP doit être configuré.'); }
  };

  return <div className="mx-auto max-w-4xl space-y-6">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <h2 className="text-xl font-bold text-slate-900">Mon profil</h2>
      {profile && <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Prénom<input required value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} className="mt-1 w-full rounded-lg border p-3" /></label>
        <label className="text-sm font-medium">Nom<input required value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} className="mt-1 w-full rounded-lg border p-3" /></label>
        <label className="text-sm font-medium">Adresse e-mail<input required type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="mt-1 w-full rounded-lg border p-3" /></label>
        <label className="text-sm font-medium">Téléphone<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="mt-1 w-full rounded-lg border p-3" /></label>
        <div className="sm:col-span-2 text-sm">E-mail : <strong className={profile.emailVerified ? 'text-emerald-700' : 'text-amber-700'}>{profile.emailVerified ? 'vérifié' : 'non vérifié'}</strong>{!profile.emailVerified && <button type="button" onClick={verify} className="ml-3 text-emerald-700 underline">Envoyer un lien de vérification</button>}</div>
        <div className="sm:col-span-2 flex flex-wrap gap-3"><button disabled={saving} className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer mon profil'}</button><Link to="/password" className="rounded-lg border border-slate-300 px-5 py-3 font-semibold">Changer mon mot de passe</Link></div>
      </form>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    </div>
    {isTeacher && <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <h3 className="text-lg font-bold">Mon pointage</h3>
      <p className="mt-1 text-sm text-slate-600">Présentez ce QR code au contrôleur à l’arrivée et au départ.</p>
      {qr && <img src={qr} alt="Mon QR code de pointage" className="mt-4 h-60 w-60 max-w-full" />}
      {history && <>
        <p className="mt-4 text-sm">Présences : {history.summary.present} · Retards : {history.summary.late} · Absences : {history.summary.absent} · Retard cumulé : {history.summary.minutesLate} min</p>
        <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Date</th><th className="p-2">Arrivée</th><th className="p-2">Départ</th><th className="p-2">Statut</th><th className="p-2">Retard</th><th className="p-2">Contrôleur</th></tr></thead><tbody>{history.records.map((record: any) => <tr key={record.id} className="border-b"><td className="p-2">{record.date.slice(0, 10)}</td><td className="p-2">{record.checkInAt ? new Date(record.checkInAt).toLocaleTimeString('fr-FR') : '—'}</td><td className="p-2">{record.checkOutAt ? new Date(record.checkOutAt).toLocaleTimeString('fr-FR') : '—'}</td><td className="p-2">{record.status}</td><td className="p-2">{record.minutesLate} min</td><td className="p-2">{record.checkInByName || '—'}</td></tr>)}</tbody></table></div>
      </>}
    </div>}
  </div>;
};
