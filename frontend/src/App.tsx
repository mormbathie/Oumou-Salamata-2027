import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { ParentsPage } from './pages/ParentsPage';
import { FinancesPage } from './pages/FinancesPage';
import { GradesPage } from './pages/GradesPage';
import { AttendancePage } from './pages/AttendancePage';
import { ClassesPage } from './pages/ClassesPage';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import { PasswordPage } from './pages/PasswordPage';

const AttendanceScanPage = lazy(() => import('./pages/AttendanceScanPage').then((module) => ({ default: module.AttendanceScanPage })));

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authenticated, initializing } = useAuth();
  if (initializing) return <div className="grid min-h-screen place-items-center text-slate-500">Vérification de la session…</div>;
  return authenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const RequireRoles: React.FC<{ roles: string[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { hasRole } = useAuth();
  if (hasRole(roles)) return <>{children}</>;
  return <Navigate to={hasRole(['PARENT', 'ENSEIGNANT']) ? '/students' : '/'} replace />;
};

const HomeByRole: React.FC = () => {
  const { hasRole } = useAuth();
  const destination = hasRole(['CONTROLEUR_PRESENCE']) ? '/attendance/scan' : hasRole(['PARENT', 'ENSEIGNANT']) ? '/students' : '/';
  return <Navigate to={destination} replace />;
};

export const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<RequireRoles roles={['ADMIN', 'DIRECTEUR', 'COMPTABLE']}><DashboardPage /></RequireRoles>} />
          <Route path="students" element={<RequireRoles roles={['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT', 'PARENT']}><StudentsPage /></RequireRoles>} />
          <Route path="parents" element={<RequireRoles roles={['ADMIN', 'DIRECTEUR', 'COMPTABLE']}><ParentsPage /></RequireRoles>} />
          <Route path="finances" element={<RequireRoles roles={['ADMIN', 'DIRECTEUR', 'COMPTABLE']}><FinancesPage /></RequireRoles>} />
          <Route path="grades" element={<RequireRoles roles={['ADMIN', 'DIRECTEUR', 'ENSEIGNANT']}><GradesPage /></RequireRoles>} />
          <Route path="attendance" element={<RequireRoles roles={['ADMIN', 'DIRECTEUR', 'ENSEIGNANT']}><AttendancePage /></RequireRoles>} />
          <Route path="attendance/scan" element={<RequireRoles roles={['ADMIN', 'DIRECTEUR', 'CONTROLEUR_PRESENCE']}><Suspense fallback={<div className="p-8 text-sm text-slate-500">Chargement du scanner…</div>}><AttendanceScanPage /></Suspense></RequireRoles>} />
          <Route path="classes" element={<RequireRoles roles={['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT']}><ClassesPage /></RequireRoles>} />
          <Route path="users" element={<RequireRoles roles={['ADMIN']}><UsersPage /></RequireRoles>} />
          <Route path="password" element={<PasswordPage />} />
        </Route>
        <Route path="*" element={<HomeByRole />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
