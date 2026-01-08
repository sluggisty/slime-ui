import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Server, Activity, Users } from 'lucide-react';
import { authApi, auth } from '../api/auth';
import styles from './Sidebar.module.css';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/hosts', icon: Server, label: 'Hosts' },
];

export default function Sidebar() {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getMe,
    enabled: auth.isAuthenticated(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const isAdmin = currentUser?.role === 'admin';

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <img src='/slime-ui-icon.png' alt='Sluggisty' />
        </div>
        <div className={styles.logoText}>
          <span className={styles.logoName}>Sluggisty</span>
          <span className={styles.logoTagline}>System Insights</span>
        </div>
      </div>

      <nav className={styles.nav}>
        <div className={styles.navSection}>
          <span className={styles.navSectionTitle}>Overview</span>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              end={item.path === '/'}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        {isAdmin && (
          <div className={styles.navSection}>
            <span className={styles.navSectionTitle}>Administration</span>
            <NavLink
              to='/users'
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
            >
              <Users size={20} />
              <span>User Access</span>
            </NavLink>
          </div>
        )}
      </nav>

      <div className={styles.footer}>
        <div className={styles.status}>
          <Activity size={14} className={styles.statusIcon} />
          <span>Connected</span>
        </div>
        <div className={styles.version}>v0.1.0</div>
      </div>
    </aside>
  );
}
