import React, { lazy, Suspense, ComponentType } from 'react';
import { ComponentLoading } from '../Loading';

// Lazy load icon components for better code splitting
export const LazyServer = lazy(() =>
  import('lucide-react').then(module => ({ default: module.Server }))
);

export const LazyAlertTriangle = lazy(() =>
  import('lucide-react').then(module => ({ default: module.AlertTriangle }))
);

export const LazyActivity = lazy(() =>
  import('lucide-react').then(module => ({ default: module.Activity }))
);

export const LazyCheckCircle = lazy(() =>
  import('lucide-react').then(module => ({ default: module.CheckCircle }))
);

export const LazyXCircle = lazy(() =>
  import('lucide-react').then(module => ({ default: module.XCircle }))
);

export const LazyRefreshCw = lazy(() =>
  import('lucide-react').then(module => ({ default: module.RefreshCw }))
);

export const LazyClock = lazy(() =>
  import('lucide-react').then(module => ({ default: module.Clock }))
);

export const LazyUser = lazy(() =>
  import('lucide-react').then(module => ({ default: module.User }))
);

export const LazyUsers = lazy(() =>
  import('lucide-react').then(module => ({ default: module.Users }))
);

export const LazyShield = lazy(() =>
  import('lucide-react').then(module => ({ default: module.Shield }))
);

export const LazyDatabase = lazy(() =>
  import('lucide-react').then(module => ({ default: module.Database }))
);

export const LazyWifi = lazy(() =>
  import('lucide-react').then(module => ({ default: module.Wifi }))
);

// Higher-order component to wrap lazy-loaded icons
function withIconSuspense<T extends object>(LazyIcon: React.LazyExoticComponent<ComponentType<T>>) {
  return (props: T) => (
    <Suspense fallback={<ComponentLoading />}>
      <LazyIcon {...props} />
    </Suspense>
  );
}

// Export wrapped components
export const ServerIcon = withIconSuspense(LazyServer);
export const AlertTriangleIcon = withIconSuspense(LazyAlertTriangle);
export const ActivityIcon = withIconSuspense(LazyActivity);
export const CheckCircleIcon = withIconSuspense(LazyCheckCircle);
export const XCircleIcon = withIconSuspense(LazyXCircle);
export const RefreshCwIcon = withIconSuspense(LazyRefreshCw);
export const ClockIcon = withIconSuspense(LazyClock);
export const UserIcon = withIconSuspense(LazyUser);
export const UsersIcon = withIconSuspense(LazyUsers);
export const ShieldIcon = withIconSuspense(LazyShield);
export const DatabaseIcon = withIconSuspense(LazyDatabase);
export const WifiIcon = withIconSuspense(LazyWifi);

// Bundle of commonly used icons for pages that need many icons
export const DashboardIcons = lazy(() =>
  import('lucide-react').then(module => ({
    default: {
      Server: module.Server,
      AlertTriangle: module.AlertTriangle,
      Clock: module.Clock,
      Activity: module.Activity,
    },
  }))
);

export const HostIcons = lazy(() =>
  import('lucide-react').then(module => ({
    default: {
      Server: module.Server,
      Clock: module.Clock,
      Trash2: module.Trash2,
    },
  }))
);

export const UserIcons = lazy(() =>
  import('lucide-react').then(module => ({
    default: {
      Users: module.Users,
      Plus: module.Plus,
      Edit2: module.Edit2,
      Trash2: module.Trash2,
      Shield: module.Shield,
      UserCheck: module.UserCheck,
      Eye: module.Eye,
      AlertCircle: module.AlertCircle,
    },
  }))
);

// Preload function for critical icons
export const preloadCriticalIcons = () => {
  // Preload icons that are likely to be used immediately
  import('lucide-react').then(module => {
    // Keep references to prevent tree shaking
    const { Server, AlertTriangle, Activity, CheckCircle } = module;
    return { Server, AlertTriangle, Activity, CheckCircle };
  });
};
