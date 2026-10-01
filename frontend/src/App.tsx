import React from 'react';
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
  return <Navigate to={hasRole(['PARENT', 'ENSEIGNANT']) ? '/students' : '/'} replace />;
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
          <Route path="classes" element={<RequireRoles roles={['ADMIN', 'DIRECTEUR', 'COMPTABLE', 'ENSEIGNANT']}><ClassesPage /></RequireRoles>} />
          <Route path="users" element={<RequireRoles roles={['ADMIN']}><UsersPage /></RequireRoles>} />
        </Route>
        <Route path="*" element={<HomeByRole />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
