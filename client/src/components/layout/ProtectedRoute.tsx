import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import type { User } from '../../store/authStore';

interface Props {
  children: React.ReactNode;
  roles?: User['role'][];
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user } = useAuthStore();

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
