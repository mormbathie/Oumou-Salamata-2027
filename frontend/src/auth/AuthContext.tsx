import React, { createContext, useContext, useEffect, useState } from 'react';

export interface AuthUser {
  userId?: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function responseMessage(response: Response) {
  try {
    const data = await response.json();
    const message = data.message || data.error_description || data.error;
    return Array.isArray(message) ? message.join(', ') : message;
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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('dev_role');
      setToken(null);
      setUser(null);
      setAuthenticated(false);
    };
    window.addEventListener('auth:unauthorized', clearExpiredSession);
    return () => window.removeEventListener('auth:unauthorized', clearExpiredSession);
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (!savedToken) {
      setInitializing(false);
      setAuthenticated(false);
      setUser(null);
      return;
    }

    let cancelled = false;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${savedToken}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session Keycloak expirée');
        return response.json();
      })
      .then((profile) => {
        if (cancelled) return;
        setUser(profile);
        setAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(profile));
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('dev_role');
        setToken(null);
        setUser(null);
        setAuthenticated(false);
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => { cancelled = true; };
  }, []);

  const directLogin = async (username: string, password: string) => {
    let response: Response;
    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
    } catch {
      throw new Error('Impossible de joindre le serveur. Vérifiez que le backend et Keycloak sont démarrés.');
    }

    if (!response.ok) {
      const message = await responseMessage(response);
      throw new Error(message || 'Identifiant ou mot de passe incorrect.');
    }

    const data = await response.json();
    if (!data.access_token) throw new Error('Keycloak n’a pas renvoyé de jeton de connexion.');

    const profileResponse = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (!profileResponse.ok) {
      const message = await responseMessage(profileResponse);
      throw new Error(message || 'Connexion obtenue, mais le profil utilisateur est inaccessible.');
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('dev_role');
    setToken(null);
    setUser(null);
    setAuthenticated(false);
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
