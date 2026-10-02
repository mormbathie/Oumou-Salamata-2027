import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { usersApi } from '../services/api';

export const PasswordPage: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (newPassword !== confirmPassword) { setError('Les nouveaux mots de passe ne correspondent pas.'); return; }
    if (newPassword === currentPassword) { setError('Choisissez un nouveau mot de passe différent.'); return; }
    setSaving(true);
    try {
      await usersApi.changeOwnPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Votre mot de passe a été modifié.');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Modification impossible.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
    <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><KeyRound className="h-5 w-5 text-emerald-700" />Changer mon mot de passe</h2>
    <p className="mt-1 text-sm text-slate-500">Saisissez votre mot de passe actuel pour protéger votre compte.</p>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block text-sm font-medium text-slate-700">Mot de passe actuel<input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-3" /></label>
      <label className="block text-sm font-medium text-slate-700">Nouveau mot de passe<input required minLength={8} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-3" /></label>
      <label className="block text-sm font-medium text-slate-700">Confirmer le nouveau mot de passe<input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-3" /></label>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      <button disabled={saving} className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Modification…' : 'Changer mon mot de passe'}</button>
    </form>
  </div>;
};
