import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCheck, CreditCard, FileSpreadsheet, CalendarCheck, ScanLine,
  Settings, LogOut, Shield, School, UserCog, Menu, X, KeyRound, UserRound, Download,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const roleNames = ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT', 'PARENT', 'CONTROLEUR_PRESENCE'];

export const Layout: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeRole = user?.roles?.find((role) => roleNames.includes(role.toUpperCase()))?.toUpperCase();
  const visibleRole = activeRole === 'CONTROLEUR_PRESENCE'
    ? 'Contrôle des présences'
    : activeRole || 'Utilisateur';
  const navItems = [
    { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['ADMIN', 'DIRECTEUR', 'COMPTABLE'] },
    { to: '/students', label: 'Inscriptions & Élèves', icon: Users, roles: ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT', 'PARENT'] },
    { to: '/parents', label: 'Parents d’élèves', icon: UserCheck, roles: ['ADMIN', 'DIRECTEUR', 'COMPTABLE'] },
    { to: '/finances', label: 'Factures & Paiements', icon: CreditCard, roles: ['ADMIN', 'DIRECTEUR', 'COMPTABLE'] },
    { to: '/grades', label: 'Notes & Bulletins', icon: FileSpreadsheet, roles: ['ADMIN', 'DIRECTEUR', 'ENSEIGNANT'] },
    { to: '/attendance', label: 'Présences & Absences', icon: CalendarCheck, roles: ['ADMIN', 'DIRECTEUR', 'ENSEIGNANT'] },
    { to: '/attendance/scan', label: 'Scanner les QR codes', icon: ScanLine, roles: ['ADMIN', 'DIRECTEUR', 'CONTROLEUR_PRESENCE'] },
    { to: '/classes', label: 'Classes & Matières', icon: Settings, roles: ['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT'] },
    { to: '/users', label: 'Gestion des utilisateurs', icon: UserCog, roles: ['ADMIN'] },
    { to: '/staff-attendance', label: 'Pointage des professeurs', icon: CalendarCheck, roles: ['ADMIN', 'DIRECTEUR', 'CONTROLEUR_PRESENCE'] },
    { to: '/data-transfer', label: 'Import / export', icon: Download, roles: ['ADMIN'] },
    { to: '/profile', label: 'Mon profil', icon: UserRound, roles: roleNames },
    { to: '/password', label: 'Mon mot de passe', icon: KeyRound, roles: roleNames },
  ].filter((item) => hasRole(item.roles));

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-dvh bg-slate-50 text-slate-800 md:h-dvh md:overflow-hidden">
      {mobileMenuOpen && <button aria-label="Fermer le menu" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-30 bg-slate-950/50 md:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col bg-slate-900 text-white shadow-xl transition-transform md:static md:z-20 md:w-64 md:max-w-none md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-5">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-lg"><School className="h-6 w-6" /></div><div><h1 className="text-base font-bold leading-tight">As Sakina</h1><p className="text-xs font-medium uppercase tracking-wider text-emerald-400">École Primaire</p></div></div>
          <button onClick={() => setMobileMenuOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 md:hidden" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => { const Icon = item.icon; return <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3.5 py-3 text-sm font-medium transition-all ${isActive ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}><Icon className="h-4 w-4 shrink-0" /><span>{item.label}</span></NavLink>; })}
        </nav>
        <div className="border-t border-slate-800 bg-slate-950/60 p-4"><div className="mb-3 flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-emerald-400" /><span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Session Keycloak</span></div><div className="flex items-center justify-between border-t border-slate-800/80 pt-3"><div className="flex min-w-0 items-center gap-2"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-xs font-bold uppercase text-emerald-400">{user?.firstName?.[0] || user?.username?.[0] || 'U'}</div><div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.username}</p><p className="truncate text-[10px] text-slate-400">{visibleRole}</p></div></div><button onClick={handleLogout} title="Déconnexion" aria-label="Déconnexion" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"><LogOut className="h-4 w-4" /></button></div></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:overflow-hidden">
        <header className="flex min-h-14 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-xs sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4"><button onClick={() => setMobileMenuOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" aria-label="Ouvrir le menu"><Menu className="h-5 w-5" /></button><div className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-emerald-500" /><span className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">Année scolaire 2026 - 2027</span></div><span className="hidden text-slate-300 sm:inline">|</span><span className="hidden text-xs text-slate-500 sm:inline">Dakar, Sénégal</span></div>
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[10px] font-medium text-emerald-800 sm:text-xs">{visibleRole}</span>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto bg-slate-100/60 p-3 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
};
