import { t, translateMessage } from "../i18n/index";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { clearSession, refreshAccessToken, tokenExpiresSoon } from './session';

export interface AuthUser {
  userId?: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  mustChangePassword?: boolean;
}

interface AuthContextType {
  authenticated: boolean;
  initializing: boolean;
  user: AuthUser | null;
  token: string | null;
  directLogin: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: string | string[]) => boolean;
}

const apiBaseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function responseMessage(response: Response) {
  try {
    const data = await response.json();
    const message = data.message || data.error_description || data.error;
    return Array.isArray(message) ? message.map(translateMessage).join(', ') : translateMessage(message);
  } catch {
    return '';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [authenticated, setAuthenticated] = useState<boolean>(() => Boolean(localStorage.getItem('token')));
  const [initializing, setInitializing] = useState<boolean>(() => Boolean(localStorage.getItem('token')));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('user');
    if (!saved) return null;
    try { return JSON.parse(saved); } catch { return null; }
  });

  useEffect(() => {
    const clearExpiredSession = () => {
      setToken(null);
      setUser(null);
      setAuthenticated(false);
    };
    const updateToken = (event: Event) => setToken((event as CustomEvent<string>).detail);
    window.addEventListener('auth:unauthorized', clearExpiredSession);
    window.addEventListener('auth:token', updateToken);
    return () => {
      window.removeEventListener('auth:unauthorized', clearExpiredSession);
      window.removeEventListener('auth:token', updateToken);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        let accessToken = localStorage.getItem('token');
        if (!accessToken || tokenExpiresSoon(accessToken)) accessToken = await refreshAccessToken();
        let response = await fetch(`${apiBaseUrl}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: 'include' });
        if (response.status === 401) {
          accessToken = await refreshAccessToken();
          response = await fetch(`${apiBaseUrl}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` }, credentials: 'include' });
        }
        if (response.status === 401) { clearSession(); return; }
        if (!response.ok) throw new Error(t("Profile temporarily unavailable."));
        const profile = await response.json();
        if (cancelled) return;
        setUser(profile);
        setToken(accessToken);
        setAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(profile));
      } catch {
        // A network interruption must not destroy a valid local session.
        if (!cancelled && !localStorage.getItem('token')) {
          setUser(null);
          setAuthenticated(false);
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    };
    void restore();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const renew = () => {
      const current = localStorage.getItem('token');
      if (current && tokenExpiresSoon(current)) void refreshAccessToken().catch(() => {});
    };
    const interval = window.setInterval(renew, 60_000);
    window.addEventListener('focus', renew);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', renew); };
  }, []);

  const directLogin = async (username: string, password: string) => {
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password }),
      });
    } catch {
      throw new Error(t("Unable to reach the server. Check that the application services are running."));
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (body.code === 'PASSWORD_UPDATE_REQUIRED') {
        throw Object.assign(new Error(body.message), { code: body.code });
      }
      const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      throw new Error(translateMessage(message) || t("Identifiant ou mot de passe incorrect."));
    }

    const data = await response.json();
    if (!data.access_token) throw new Error(t("The sign-in service did not return an access token."));

    const profileResponse = await fetch(`${apiBaseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
      credentials: 'include',
    });
    if (!profileResponse.ok) {
      const message = await responseMessage(profileResponse);
      throw new Error(message || t("Connexion obtenue, mais le profil utilisateur est inaccessible."));
    }

    const profile = await profileResponse.json();
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(profile));
    localStorage.removeItem('dev_role');
    setToken(data.access_token);
    setUser(profile);
    setAuthenticated(true);
  };

  const logout = () => {
    void fetch(`${apiBaseUrl}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    clearSession();
  };

  const hasRole = (roles: string | string[]) => {
    if (!user?.roles) return false;
    const required = Array.isArray(roles) ? roles : [roles];
    const normalized = user.roles.map((role) => role.toUpperCase());
    return normalized.includes('ADMIN') || normalized.some((role) => required.includes(role));
  };

  return (
    <AuthContext.Provider value={{ authenticated, initializing, user, token, directLogin, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
