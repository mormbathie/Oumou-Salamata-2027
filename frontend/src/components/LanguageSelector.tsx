import { getLanguage, setLanguage, type Language } from '../i18n';

export function LanguageSelector() {
  return <select aria-label="Langue / Language / اللغة" value={getLanguage()}
    onChange={(event) => setLanguage(event.target.value as Language)}
    className="max-w-32 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700">
    <option value="fr">Français</option>
    <option value="en">English</option>
    <option value="ar">العربية</option>
  </select>;
}
