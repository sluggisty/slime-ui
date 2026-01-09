import { useLocation, useNavigate } from 'react-router-dom';
import { RefreshCw, LogOut, User as UserIcon, Shield } from 'lucide-react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { auth, authApi } from '../api/auth';
import styles from './Header.module.css';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/hosts': 'Hosts',
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch current user information
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getMe,
    retry: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const getTitle = () => {
    if (location.pathname.startsWith('/hosts/')) return 'Host Details';
    return pageTitles[location.pathname] || 'Sluggisty';
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  const handleLogout = () => {
    auth.removeApiKey();
    queryClient.clear(); // Clear all cached queries
    navigate('/login');
  };

  return (
    <header className={styles.header}>
      <div className={styles.titleSection}>
        <h1 className={styles.title}>{getTitle()}</h1>
        <span className={styles.breadcrumb}>{location.pathname}</span>
      </div>

      <div className={styles.rightSection}>
        {/* User Info */}
        {user && (
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              <UserIcon size={16} />
            </div>
            <div className={styles.userDetails}>
              <div className={styles.userName}>
                {user.username}
                {user.is_admin && (
                  <span className={styles.adminBadge} title='Administrator'>
                    <Shield size={12} />
                  </span>
                )}
              </div>
              <div className={styles.userEmail}>{user.email}</div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.iconButton} onClick={handleRefresh} title='Refresh data'>
            <RefreshCw size={18} />
          </button>
          <button className={styles.iconButton} onClick={handleLogout} title='Logout'>
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
