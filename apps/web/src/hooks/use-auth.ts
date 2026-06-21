/**
 * Stub hook — returns mock authenticated admin user.
 * TODO: Replace with Redux store selector in next phase.
 * The real implementation will:
 * 1. Read user and tokens from Redux auth slice
 * 2. Return isAuthenticated based on token existence and expiry
 * 3. Expose login() and logout() actions
 */
import { UserRole, type SafeUser } from '@oses/types';

interface UseAuthReturn {
  user: SafeUser;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const MOCK_USER: SafeUser = {
  id: 'usr_mock_admin_001',
  email: 'admin@oses.pk',
  role: UserRole.ADMIN,
  fullName: 'System Administrator',
  createdAt: new Date().toISOString(),
};

export function useAuth(): UseAuthReturn {
  return {
    user: MOCK_USER,
    isAuthenticated: true,
    isLoading: false,
  };
}
