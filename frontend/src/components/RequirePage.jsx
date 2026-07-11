import { Navigate, Outlet } from 'react-router-dom';
import { usePermissionsStore } from '../store/permissionsStore';

export function RequirePage({ pageKey }) {
  const pageKeys = usePermissionsStore((s) => s.pageKeys);
  if (!pageKeys.includes(pageKey)) return <Navigate to="/no-access" replace />;
  return <Outlet />;
}
