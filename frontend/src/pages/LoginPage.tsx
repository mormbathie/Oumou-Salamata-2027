import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, Shield, KeyRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export const LoginPage: React.FC = () => {
  const { directLogin, authenticated, initializing, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
      await directLogin(username, password);
      navigate(user?.roles?.includes('PARENT') ? '/students' : '/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'La connexion a échoué.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-8 text-center text-white">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 border border-white/20 mb-3 shadow-lg">
            <School className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">École Primaire Oumou Salamat</h1>
          <p className="text-xs text-emerald-100 mt-1">Plateforme de Gestion Scolaire Sécurisée</p>
          <div className="mt-4 inline-flex items-center space-x-1.5 bg-black/20 px-3 py-1 rounded-full text-[11px] font-semibold text-emerald-200">
            <Shield className="w-3.5 h-3.5 text-amber-300" />
            <span>Authentification Keycloak</span>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div role="alert" className="mb-5 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div>
              <label htmlFor="username" className="font-semibold text-slate-700 block mb-1">Identifiant</label>
              <input id="username" type="text" autoComplete="username" required value={username}
                onChange={(event) => setUsername(event.target.value)} placeholder="Votre identifiant Keycloak"
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800" />
            </div>
            <div>
              <label htmlFor="password" className="font-semibold text-slate-700 block mb-1">Mot de passe</label>
              <input id="password" type="password" autoComplete="current-password" required value={password}
                onChange={(event) => setPassword(event.target.value)} placeholder="Votre mot de passe"
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800" />
            </div>
            <button type="submit" disabled={loading || initializing}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-700/25 transition disabled:opacity-50">
              <KeyRound className="w-4 h-4" />
              <span>{loading ? 'Connexion en cours…' : 'Se connecter'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
