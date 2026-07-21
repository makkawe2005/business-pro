import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePermissionsStore } from '../store/permissionsStore';

export function RequireAuth() {
  const token = useAuthStore((s) => s.token);
  const loaded = usePermissionsStore((s) => s.loaded);
  const loadPermissions = usePermissionsStore((s) => s.loadPermissions);

  useEffect(() => {
    if (token && !loaded) loadPermissions();
  }, [token, loaded, loadPermissions]);

  if (!token) return <Navigate to="/login" replace />;
  if (!loaded) return null;
  return <Outlet />;
}
