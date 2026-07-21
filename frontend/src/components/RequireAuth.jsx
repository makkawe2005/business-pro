import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePermissionsStore } from '../store/permissionsStore';
import { useMyTasksStore } from '../store/myTasksStore';

export function RequireAuth() {
  const token = useAuthStore((s) => s.token);
  const loaded = usePermissionsStore((s) => s.loaded);
  const loadPermissions = usePermissionsStore((s) => s.loadPermissions);
  const myTasksLoaded = useMyTasksStore((s) => s.loaded);
  const loadMyTasksCount = useMyTasksStore((s) => s.loadMyTasksCount);

  useEffect(() => {
    if (token && !loaded) loadPermissions();
  }, [token, loaded, loadPermissions]);

  useEffect(() => {
    if (token && !myTasksLoaded) loadMyTasksCount();
  }, [token, myTasksLoaded, loadMyTasksCount]);

  if (!token) return <Navigate to="/login" replace />;
  if (!loaded || !myTasksLoaded) return null;
  return <Outlet />;
}
