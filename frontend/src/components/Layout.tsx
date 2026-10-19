import api from '../services/api';
import { school } from '../config/school';
import { t } from "../i18n/index";
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCheck, CreditCard, FileSpreadsheet, CalendarCheck, ScanLine,
  Settings, LogOut, Shield, School, UserCog, Menu, X, KeyRound, UserRound, Download,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { LanguageSelector } from './LanguageSelector';
import { roleLabel } from '../i18n';

const roleNames = ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT', 'PARENT', 'CONTROLEUR_PRESENCE'];

export const Layout: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const content = useRef<HTMLElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [yearName, setYearName] = useState(school.year.replace('/', ' - '));
  useEffect(() => { let active = true; const loadYear = () => { api.get('/classes/current-year').then(r => { if (active && r.data?.name) setYearName(r.data.name); }).catch(() => {}); }; loadYear(); window.addEventListener('academic-year-changed', loadYear); return () => { active = false; window.removeEventListener('academic-year-changed', loadYear); }; }, []);
  const activeRole = user?.roles?.find((role) => roleNames.includes(role.toUpperCase()))?.toUpperCase();
  const visibleRole = roleLabel(activeRole || 'User');
  const navItems = [
    { to: '/', label: t("Dashboard"), icon: LayoutDashboard, roles: ['ADMIN', 'DIRECTEUR', 'COMPTABLE'] },
    { to: '/students', label: t("Enrollment & Students"), icon: Users, roles: ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT', 'PARENT'] },
    { to: '/parent-portal', label: 'Espace parents', icon: Users, roles: ['PARENT'] },
    { to: '/academic-transition', label: 'Passage d’année', icon: CalendarCheck, roles: ['ADMIN', 'DIRECTEUR'] },
    { to: '/parents', label: t("Parents & Guardians"), icon: UserCheck, roles: ['ADMIN', 'DIRECTEUR', 'COMPTABLE'] },
    { to: '/kimono', label: t('Kimono sales'), icon: CreditCard, roles: ['ADMIN','DIRECTEUR','COMPTABLE'] },
    { to: '/karate', label: t('Monthly karate payments'), icon: CreditCard, roles: ['ADMIN','DIRECTEUR','COMPTABLE'] },
    { to: '/finance-control', label: 'Contrôle financier', icon: CreditCard, roles: ['ADMIN', 'DIRECTEUR', 'COMPTABLE'] },
    { to: '/registration-report', label: t('Synthèse des inscriptions'), icon: FileSpreadsheet, roles: ['ADMIN','DIRECTEUR','COMPTABLE'] },
    { to: '/teacher-badge', label: t('Mon pointage'), icon: ScanLine, roles: ['ENSEIGNANT'] },
    { to: '/finances', label: t("Invoices & Payments"), icon: CreditCard, roles: ['ADMIN', 'DIRECTEUR', 'COMPTABLE'] },
    { to: '/grades', label: t("Grades & Report Cards"), icon: FileSpreadsheet, roles: ['ADMIN', 'DIRECTEUR', 'ENSEIGNANT'] },
    { to: '/attendance', label: t("Attendance & Absences"), icon: CalendarCheck, roles: ['ADMIN', 'DIRECTEUR', 'ENSEIGNANT'] },
    { to: '/attendance/scan', label: t("Scan Student QR Codes"), icon: ScanLine, roles: ['ADMIN', 'DIRECTEUR', 'CONTROLEUR_PRESENCE'] },
    { to: '/classes', label: t("Classes & Subjects"), icon: Settings, roles: ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT'] },
    { to: '/users', label: t("User Management"), icon: UserCog, roles: ['ADMIN'] },
    { to: '/staff-attendance', label: t("Teacher Attendance"), icon: CalendarCheck, roles: ['ADMIN', 'DIRECTEUR', 'CONTROLEUR_PRESENCE'] },
    { to: '/data-transfer', label: t("Import / Export"), icon: Download, roles: ['ADMIN'] },
    { to: '/school-information', label: t('School information and fees'), icon: School, roles: roleNames },
    { to: '/profile', label: t("My Profile"), icon: UserRound, roles: roleNames },
    { to: '/password', label: t("My Password"), icon: KeyRound, roles: roleNames },
  ].filter((item) => hasRole(item.roles));

  const mobileShortNames: Record<string, string> = { '/': 'Accueil', '/parent-portal': 'Mes enfants', '/students': 'Élèves', '/finances': 'Paiements', '/attendance/scan': 'Scanner', '/attendance': 'Présences', '/grades': 'Notes', '/profile': 'Profil', '/teacher-badge': 'Badger' };
  const mobilePriority = activeRole === 'PARENT' ? ['/parent-portal', '/students', '/profile'] : activeRole === 'ENSEIGNANT' ? ['/teacher-badge', '/students', '/grades', '/profile'] : activeRole === 'CONTROLEUR_PRESENCE' ? ['/attendance/scan', '/attendance', '/profile'] : ['/', '/students', '/finances', '/attendance/scan', '/attendance', '/profile'];
  const mobileTabs = mobilePriority
    .map(to => navItems.find(item => item.to === to)).filter((item): item is typeof navItems[number] => Boolean(item)).slice(0, 4);
  const currentPage = navItems.find(item => item.to === pathname);
  useEffect(() => {
    setMobileMenuOpen(false);
    if (window.matchMedia('(max-width: 767px)').matches) content.current?.scrollTo({ top: 0 });
  }, [pathname]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileMenuOpen(false); };
    window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="mobile-app flex h-dvh min-h-0 overflow-hidden bg-slate-50 text-slate-800">
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col bg-slate-900 text-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-lg"><img src={school.logo} alt="" className="h-10 w-10 rounded-lg bg-white object-contain" /></div><div><h1 className="text-base font-bold leading-tight">{school.shortName}</h1><p className="text-xs font-medium uppercase tracking-wider text-emerald-400">{t("School group")}</p></div></div>
          <button onClick={() => setMobileMenuOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 md:hidden" aria-label={t("Close")}><X className="h-5 w-5" /></button>
        </div>
        <nav className="hide-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => { const Icon = item.icon; return <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3.5 py-3 text-sm font-medium transition-all ${isActive ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}><Icon className="h-4 w-4 shrink-0" /><span>{item.label}</span></NavLink>; })}
        </nav>
        <div className="border-t border-slate-800 bg-slate-950/60 p-4"><div className="mb-3 flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-emerald-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t("Your session")}</span></div><div className="flex items-center justify-between border-t border-slate-800/80 pt-3"><div className="flex min-w-0 items-center gap-2"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-xs font-bold uppercase text-emerald-400">{user?.firstName?.[0] || user?.username?.[0] || 'U'}</div><div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.username}</p><p className="truncate text-[10px] text-slate-400">{visibleRole}</p></div></div><button onClick={handleLogout} title={t("Sign out")} aria-label={t("Sign out")} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"><LogOut className="h-4 w-4" /></button></div></div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 hidden md:flex min-h-14 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-xs sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4"><button onClick={() => setMobileMenuOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label={t("Open menu")}><Menu className="h-5 w-5" /></button><div className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-emerald-500" /><span className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">{t('School year {0}', [yearName])}</span></div><span className="hidden text-slate-300 sm:inline">|</span><span className="hidden text-xs text-slate-500 sm:inline">{t("Dakar, Senegal")}</span></div>
          <LanguageSelector /><span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[10px] font-medium text-emerald-800 sm:text-xs">{visibleRole}</span>
        </header>
        <header className="mobile-topbar z-20 flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 md:hidden">
          <div className="flex min-w-0 items-center gap-2.5"><img src={school.logo} alt="" className="h-10 w-10 shrink-0 rounded-xl border border-emerald-100 object-contain" /><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">As Sakina</p><p className="truncate text-xs text-slate-500">{mobileMenuOpen ? t('Tous les modules') : currentPage?.label || school.shortName}</p></div></div>
          <div className="flex shrink-0 items-center gap-2"><LanguageSelector /><button onClick={() => navigate('/profile')} aria-label={t('My Profile')} className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 font-bold uppercase text-emerald-800">{user?.firstName?.[0] || user?.username?.[0] || 'U'}</button></div>
        </header>
        <main ref={content} className="mobile-content hide-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto bg-slate-100/60 p-4 sm:p-6"><Outlet /></main>
        {mobileMenuOpen && <section aria-label={t('Tous les modules')} className="mobile-modules absolute inset-x-0 z-40 overflow-y-auto bg-slate-50 p-4 md:hidden">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold text-slate-900">{t('Tous les modules')}</h2><p className="text-sm text-slate-500">{visibleRole} · {yearName}</p></div><button onClick={() => setMobileMenuOpen(false)} aria-label={t('Close menu')} className="rounded-xl border bg-white p-3"><X className="h-5 w-5" /></button></div>
          <nav aria-label={t('Tous les modules')} className="grid grid-cols-2 gap-3">{navItems.map(item => { const Icon = item.icon; return <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex min-h-28 flex-col items-start justify-center gap-3 rounded-2xl border p-4 text-sm font-semibold ${isActive ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700'}`}><Icon className="h-6 w-6 text-emerald-700" /><span>{item.label}</span></NavLink>; })}</nav>
          <button onClick={handleLogout} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white text-sm font-semibold text-rose-700"><LogOut className="h-5 w-5" />{t('Sign out')}</button>
        </section>}
        <nav aria-label={t('Navigation mobile')} className="mobile-bottom-nav z-30 flex shrink-0 border-t border-slate-200 bg-white px-1 md:hidden">
          {mobileTabs.map(item => { const Icon = item.icon; return <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold ${isActive && !mobileMenuOpen ? 'text-emerald-700' : 'text-slate-500'}`}><Icon className="h-5 w-5" /><span>{t(mobileShortNames[item.to] || item.label)}</span></NavLink>; })}
          <button onClick={() => setMobileMenuOpen(value => !value)} aria-expanded={mobileMenuOpen} className={`flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold ${mobileMenuOpen ? 'text-emerald-700' : 'text-slate-500'}`}><Menu className="h-5 w-5" /><span>{t('Menu')}</span></button>
        </nav>
      </div>
    </div>
  );
};
