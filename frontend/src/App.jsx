import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { RequirePage } from './components/RequirePage';
import { AppShell } from './layouts/AppShell';
import { SystemAdminLayout } from './layouts/SystemAdminLayout';
import { LoginPage } from './pages/LoginPage';
import { PublicRegistrationPage } from './pages/PublicRegistrationPage';
import { PhaseView } from './pages/PhaseView';
import { ExecutionPage } from './pages/ExecutionPage';
import { MyTasksPage } from './pages/MyTasksPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExecutionDashboardPage } from './pages/ExecutionDashboardPage';
import { CalendarPage } from './pages/CalendarPage';
import { InvestorsPage } from './pages/InvestorsPage';
import { AdminPage } from './pages/AdminPage';
import { UsersPage } from './pages/UsersPage';
import { PermissionsPage } from './pages/PermissionsPage';
import { RolesPage } from './pages/RolesPage';
import { NoAccessPage } from './pages/NoAccessPage';
import { usePermissionsStore } from './store/permissionsStore';

const PAGE_PRIORITY = [
  ['dashboard', '/dashboard'],
  ['phase1', '/phase1'],
  ['phase2', '/phase2'],
  ['phase3', '/phase3'],
  ['phase4', '/phase4'],
  ['investors', '/investors'],
  ['system_admin', '/system-admin']
];

function IndexRedirect() {
  const pageKeys = usePermissionsStore((s) => s.pageKeys);
  const match = PAGE_PRIORITY.find(([key]) => pageKeys.includes(key));
  // /my-tasks needs no page permission, so it's the fallback for task assignees who hold
  // no other page access at all, instead of sending them to a dead-end "no access" screen.
  return <Navigate to={match ? match[1] : '/my-tasks'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<PublicRegistrationPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<IndexRedirect />} />
            <Route path="/no-access" element={<NoAccessPage />} />
            <Route path="/my-tasks" element={<MyTasksPage />} />
            <Route element={<RequirePage pageKey="dashboard" />}>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>
            <Route element={<RequirePage pageKey="phase4" />}>
              <Route path="/dashboard/execution" element={<ExecutionDashboardPage />} />
            </Route>
            <Route element={<RequirePage pageKey="calendar" />}>
              <Route path="/calendar" element={<CalendarPage />} />
            </Route>
            <Route element={<RequirePage pageKey="investors" />}>
              <Route path="/investors" element={<InvestorsPage />} />
            </Route>
            <Route element={<RequirePage pageKey="phase1" />}>
              <Route
                path="/phase1"
                element={
                  <PhaseView
                    stage="phase1"
                    listStatusFilter={['Prospect', 'Reschedule']}
                    graduateToStage="phase2"
                    deleteLabelKey="pipeline.deleteClient"
                    useAppointments
                  />
                }
              />
            </Route>
            <Route element={<RequirePage pageKey="phase2" />}>
              <Route
                path="/phase2"
                element={
                  <PhaseView
                    stage="phase2"
                    listStatusFilter="Active"
                    graduateToStage="phase3"
                    graduateStatus="Finalizing"
                    deleteLabelKey="pipeline.dealCanceled"
                    canEditClient={false}
                    canAddClient={false}
                    rescheduleTargetStage="phase1"
                    requireCancelReason
                  />
                }
              />
            </Route>
            <Route element={<RequirePage pageKey="phase3" />}>
              <Route
                path="/phase3"
                element={
                  <PhaseView
                    stage="phase3"
                    listStatusFilter="Finalizing"
                    graduateToStage="phase4"
                    graduateStatus="Executing"
                    deleteLabelKey="pipeline.dealCanceled"
                    canEditClient={false}
                    canAddClient={false}
                    rescheduleTargetStage="phase1"
                    requireCancelReason
                  />
                }
              />
            </Route>
            <Route element={<RequirePage pageKey="phase4" />}>
              <Route path="/phase4" element={<ExecutionPage />} />
            </Route>
            <Route element={<RequirePage pageKey="system_admin" />}>
              <Route path="/system-admin" element={<SystemAdminLayout />}>
                <Route index element={<Navigate to="/system-admin/users" replace />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="clients" element={<AdminPage />} />
                <Route path="permissions" element={<PermissionsPage />} />
                <Route path="roles" element={<RolesPage />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
