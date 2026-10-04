import { t } from "../i18n/index";
const apiBaseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

let refreshPromise: Promise<string> | null = null;

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('dev_role');
  window.dispatchEvent(new Event('auth:unauthorized'));
}

export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    }).then(async (response) => {
      if (!response.ok) {
        if (response.status === 401) clearSession();
        throw new Error(t("Session expired. Sign in again."));
      }
      const data = await response.json();
      if (!data.access_token) throw new Error('Renouvellement de session invalide.');
      localStorage.setItem('token', data.access_token);
      window.dispatchEvent(new CustomEvent('auth:token', { detail: data.access_token }));
      return data.access_token as string;
    }).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export function tokenExpiresSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now() + 120_000;
  } catch {
    return true;
  }
}
