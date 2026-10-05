import { school } from '../config/school';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { t } from '../i18n';
import { LanguageSelector } from '../components/LanguageSelector';

export const LoginPage: React.FC = () => {
  const { directLogin, authenticated, initializing, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authenticated && !initializing) navigate(user?.roles?.includes('PARENT') ? '/students' : '/', { replace: true });
  }, [authenticated, initializing, navigate, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await directLogin(username, password, totp);
      navigate(user?.roles?.includes('PARENT') ? '/students' : '/', { replace: true });
    } catch (err: any) {
      setError(err.code === 'PASSWORD_UPDATE_REQUIRED'
        ? t('Your temporary password must be changed. Please contact an administrator.')
        : err.message || t('Sign-in failed.'));
    } finally {
      setLoading(false);
    }
  };

  const recover = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (!response.ok) throw new Error(t('Unable to complete the operation.'));
      setNotice(t('If this address belongs to an active account, a reset link will be sent.'));
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-8 text-center text-white">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 border border-white/20 mb-3 shadow-lg">
            <img src={school.logo} alt={school.name} className="w-16 h-16 rounded-xl object-contain bg-white" />
          </div>
          <div className="mb-4 flex justify-end"><LanguageSelector /></div>
          <h1 className="text-xl font-bold tracking-tight">{t('As Sakina School')}</h1>
          <p className="text-xs text-emerald-100 mt-1">{t('Secure School Management Platform')}</p>
        </div>

        <div className="p-8">
          {error && (
            <div role="alert" className="mb-5 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
              {error}
            </div>
          )}
          {notice && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
          {recovery ? <form onSubmit={recover} className="space-y-4">
            <h2 className="font-bold">{t('Reset my password')}</h2>
            <label className="block text-sm">{t('Email address')}<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
            <button disabled={loading} className="w-full rounded-xl bg-emerald-600 p-3 font-bold text-white">{t('Send reset link')}</button>
            <p className="text-xs text-slate-500">{t('The link expires after 15 minutes. Check your spam folder too.')}</p>
          </form> : <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div>
              <label htmlFor="username" className="font-semibold text-slate-700 block mb-1">{t('Username')}</label>
              <input id="username" type="text" autoComplete="username" required value={username}
                onChange={(event) => setUsername(event.target.value)} placeholder={t('Your username')}
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800" />
            </div>
            <div>
              <label htmlFor="password" className="font-semibold text-slate-700 block mb-1">{t('Password')}</label>
              <input id="password" type="password" autoComplete="current-password" required value={password}
                onChange={(event) => setPassword(event.target.value)} placeholder={t('Your password')}
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800" />
            </div>
            <label className="block font-semibold text-slate-700">{t('Authenticator code (if enabled)')}<input value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} className="mt-1 w-full rounded-xl border p-3" /></label>
            <button type="submit" disabled={loading || initializing}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-700/25 transition disabled:opacity-50">
              <KeyRound className="w-4 h-4" />
              <span>{loading ? t('Signing in…') : t('Sign in')}</span>
            </button>
          </form>}
          <button type="button" onClick={() => { setRecovery(!recovery); setError(''); setNotice(''); }} className="mt-4 text-sm font-semibold text-emerald-700">{recovery ? t('Back to sign in') : t('Forgot password?')}</button>
          <p className="mt-4 rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-600">
            {t('First sign-in: change your temporary password in your profile after signing in.')}
          </p>
        </div>
      </div>
    </div>
  );
};
