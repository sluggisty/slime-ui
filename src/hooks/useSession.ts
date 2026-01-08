import { useEffect, useCallback, useState } from 'react';
import { auth } from '../api/auth';

interface SessionInfo {
  isAuthenticated: boolean;
  tokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  sessionId?: string;
  lastActivity?: string;
  sessionExpiresAt?: string;
  isRefreshing?: boolean;
}

interface SessionState {
  isAuthenticated: boolean;
  isValidating: boolean;
  sessionInfo: SessionInfo | null;
  lastActivity: Date | null;
}

// Get initial session state
const getInitialSessionState = (): SessionState => {
  const sessionInfo = auth.getSessionInfo();
  return {
    isAuthenticated: auth.isAuthenticated(),
    isValidating: false,
    sessionInfo,
    lastActivity: sessionInfo?.lastActivity ? new Date(sessionInfo.lastActivity) : null,
  };
};

export function useSession() {
  const [sessionState, setSessionState] = useState<SessionState>(getInitialSessionState);

  const validateSession = useCallback(async () => {
    setSessionState(prev => ({ ...prev, isValidating: true }));

    try {
      const isValid = await auth.validateSession();
      const sessionInfo = auth.getSessionInfo();

      setSessionState({
        isAuthenticated: isValid,
        isValidating: false,
        sessionInfo,
        lastActivity: sessionInfo?.lastActivity ? new Date(sessionInfo.lastActivity) : null,
      });

      return isValid;
    } catch (error) {
      console.error('Session validation error:', error);
      setSessionState({
        isAuthenticated: false,
        isValidating: false,
        sessionInfo: null,
        lastActivity: null,
      });
      return false;
    }
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      await auth.refreshToken();
      await validateSession(); // Re-validate after refresh
    } catch (error) {
      console.error('Token refresh error:', error);
    }
  }, [validateSession]);

  useEffect(() => {
    // Listen for authentication events
    const handleSessionTimeout = (event: CustomEvent) => {
      console.log('Session timeout detected:', event.detail?.reason);
      setSessionState({
        isAuthenticated: false,
        isValidating: false,
        sessionInfo: null,
        lastActivity: null,
      });
    };

    const handleLogout = () => {
      console.log('Logout event detected');
      setSessionState({
        isAuthenticated: false,
        isValidating: false,
        sessionInfo: null,
        lastActivity: null,
      });
    };

    const handleAuthChange = () => {
      validateSession();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('sessionTimeout', handleSessionTimeout as EventListener);
      window.addEventListener('authLogout', handleLogout);
      window.addEventListener('authChange', handleAuthChange);

      // Periodic session validation (every 5 minutes if authenticated)
      let validationInterval: NodeJS.Timeout | null = null;
      if (sessionState.isAuthenticated) {
        validationInterval = setInterval(
          () => {
            validateSession();
          },
          5 * 60 * 1000
        );
      }

      return () => {
        window.removeEventListener('sessionTimeout', handleSessionTimeout as EventListener);
        window.removeEventListener('authLogout', handleLogout);
        window.removeEventListener('authChange', handleAuthChange);
        if (validationInterval) {
          clearInterval(validationInterval);
        }
      };
    }
  }, [validateSession, sessionState.isAuthenticated]);

  return {
    ...sessionState,
    validateSession,
    refreshToken,
    logout: auth.logout,
    getTokenExpiration: auth.getTokenExpiration,
    shouldRefreshToken: auth.shouldRefreshToken,
  };
}
