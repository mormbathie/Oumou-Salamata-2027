import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, RefreshCw, ShieldCheck, ShieldOff, Trash2, UserCog, X } from 'lucide-react';
import { usersApi } from '../services/api';
import { useAuth } from '../auth/AuthContext';

interface ManagedUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  roles: string[];
}

const emptyForm = { username: '', email: '', firstName: '', lastName: '', password: '', role: 'ENSEIGNANT' };
const roleOptions = [
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'DIRECTEUR', label: 'Directeur' },
  { value: 'COMPTABLE', label: 'Comptable' },
  { value: 'ENSEIGNANT', label: 'Enseignant' },
  { value: 'PARENT', label: 'Parent' },
];

function errorMessage(error: any) {
  const message = error?.response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message || error?.message || 'Une erreur est survenue.';
}

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await usersApi.getAll());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await usersApi.create(form);
      setModalOpen(false);
      setForm(emptyForm);
      setSuccess('Le compte Keycloak a été créé.');
      await loadUsers();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = async (managedUser: ManagedUser) => {
    setError('');
    setSuccess('');
    try {
      await usersApi.setEnabled(managedUser.id, !managedUser.enabled);
      setSuccess(`Le compte ${managedUser.username} est maintenant ${managedUser.enabled ? 'désactivé' : 'activé'}.`);
      await loadUsers();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const deleteUser = async (managedUser: ManagedUser) => {
    if (!window.confirm(`Supprimer définitivement le compte « ${managedUser.username} » de Keycloak ?`)) return;
    setError('');
    setSuccess('');
    try {
      await usersApi.delete(managedUser.id);
      setSuccess(`Le compte ${managedUser.username} a été supprimé.`);
      await loadUsers();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Gestion des utilisateurs</h2>
          <p className="text-xs text-slate-500">Comptes et rôles synchronisés avec Keycloak</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void loadUsers()} disabled={loading} className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 py-2.5 rounded-xl text-sm hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
          <button onClick={() => { setError(''); setModalOpen(true); }} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
            <Plus className="w-4 h-4" /> Créer un utilisateur
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800"><UserCog className="w-4 h-4 text-emerald-700" /> Comptes Keycloak</div>
          <span className="text-xs text-slate-500">{users.length} utilisateur(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100/60 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
              <tr><th className="px-5 py-3">Utilisateur</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Rôle(s)</th><th className="px-4 py-3">État</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Chargement des comptes…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Aucun utilisateur trouvé.</td></tr>
              ) : users.map((managedUser) => {
                const isCurrentUser = managedUser.id === currentUser?.userId;
                return (
                  <tr key={managedUser.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-800">{managedUser.firstName} {managedUser.lastName}</div>
                      <div className="text-xs text-slate-500">{managedUser.username}{isCurrentUser ? ' · Vous' : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{managedUser.email || '—'}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1">
                      {managedUser.roles.length ? managedUser.roles.map((role) => <span key={role} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{role}</span>) : <span className="text-xs text-slate-400">Aucun rôle applicatif</span>}
                    </div></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${managedUser.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                        {managedUser.enabled ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                        {managedUser.enabled ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => void toggleUser(managedUser)} disabled={isCurrentUser && managedUser.enabled}
                          title={managedUser.enabled ? 'Désactiver' : 'Activer'}
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40" aria-label={`${managedUser.enabled ? 'Désactiver' : 'Activer'} ${managedUser.username}`}>
                          {managedUser.enabled ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        </button>
                        <button onClick={() => void deleteUser(managedUser)} disabled={isCurrentUser}
                          title="Supprimer" className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-40" aria-label={`Supprimer ${managedUser.username}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div><h3 className="font-bold text-slate-800">Créer un utilisateur</h3><p className="text-xs text-slate-500 mt-1">Le compte sera créé dans le realm Keycloak de l’école.</p></div>
              <button onClick={() => setModalOpen(false)} aria-label="Fermer" className="p-2 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={createUser} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="text-xs font-medium text-slate-700">Identifiant *<input required autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm" /></label>
                <label className="text-xs font-medium text-slate-700">Adresse e-mail *<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm" /></label>
                <label className="text-xs font-medium text-slate-700">Prénom *<input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm" /></label>
                <label className="text-xs font-medium text-slate-700">Nom *<input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm" /></label>
                <label className="text-xs font-medium text-slate-700">Rôle *<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm">{roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label>
                <label className="text-xs font-medium text-slate-700">Mot de passe *<div className="relative mt-1"><KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm" /></div><span className="mt-1 block font-normal text-slate-400">8 caractères minimum</span></label>
              </div>
              {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Annuler</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Plus className="w-4 h-4" />{saving ? 'Création…' : 'Créer le compte'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
