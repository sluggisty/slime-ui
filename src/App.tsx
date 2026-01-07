import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import { ErrorProvider, ErrorNotifications } from './contexts/ErrorContext'
import { PageLoading } from './components/Loading'
import { errorHandler } from './utils/errorHandler'
import { logger } from './utils/logger'
import { healthMonitor } from './utils/healthCheck'
import { auth } from './api/auth'

// Lazy load page components for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Hosts = lazy(() => import('./pages/Hosts'))
const HostDetail = lazy(() => import('./pages/HostDetail'))
const UserAccess = lazy(() => import('./pages/UserAccess'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))

// Lazy load heavy components that might be used conditionally
export const HealthDashboard = lazy(() => import('./components/HealthDashboard'))
export const ErrorExample = lazy(() => import('./components/ErrorExample'))

function App() {
  // Initialize global error handler, logger, and health monitor
  React.useEffect(() => {
    errorHandler.initialize()
    logger.initialize()
    healthMonitor.initialize()

    return () => {
      errorHandler.destroy()
      logger.destroy()
      healthMonitor.destroy()
    }
  }, [])

  // Global error handler
  const handleGlobalError = async (error: Error, errorInfo: React.ErrorInfo, context?: any) => {
    // Use the centralized error handler
    await errorHandler.handleError(error, {
      componentStack: errorInfo?.componentStack,
      ...context
    }, 'react')
  }

  // Route-level error handler
  const handleRouteError = async (error: Error, errorInfo: React.ErrorInfo, context?: any) => {
    // Use the centralized error handler
    await errorHandler.handleError(error, {
      componentStack: errorInfo?.componentStack,
      ...context
    }, 'react')
  }

  return (
    <ErrorProvider>
      <ErrorNotifications />
      <ErrorBoundary
        level="global"
        onError={handleGlobalError}
        enableRetry={true}
        maxRetries={3}
        fallback={undefined} // Use default ErrorFallback
      >
        <Suspense fallback={<PageLoading message="Loading application..." />}>
          <Routes>
        {/* Auth routes - separate error boundary for auth flow */}
        <Route path="/login" element={
          <ErrorBoundary
            level="route"
            onError={handleRouteError}
            context={{ route: '/login', timestamp: Date.now() }}
          >
            <Suspense fallback={<PageLoading message="Loading login..." />}>
              {auth.isAuthenticated() ? <Navigate to="/" replace /> : <Login />}
            </Suspense>
          </ErrorBoundary>
        } />
        <Route path="/register" element={
          <ErrorBoundary
            level="route"
            onError={handleRouteError}
            context={{ route: '/register', timestamp: Date.now() }}
          >
            <Suspense fallback={<PageLoading message="Loading registration..." />}>
              {auth.isAuthenticated() ? <Navigate to="/" replace /> : <Register />}
            </Suspense>
          </ErrorBoundary>
        } />

        {/* Protected routes with layout */}
        <Route path="/" element={
          <ErrorBoundary
            level="route"
            onError={handleRouteError}
            context={{ route: 'layout', timestamp: Date.now() }}
          >
            <Layout />
          </ErrorBoundary>
        }>
          <Route index element={
            <ErrorBoundary
              level="route"
              onError={handleRouteError}
              context={{ route: 'dashboard', timestamp: Date.now() }}
              enableRetry={true}
            >
              <Suspense fallback={<PageLoading message="Loading dashboard..." />}>
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              </Suspense>
            </ErrorBoundary>
          } />
          <Route path="hosts" element={
            <ErrorBoundary
              level="route"
              onError={handleRouteError}
              context={{ route: 'hosts', timestamp: Date.now() }}
              enableRetry={true}
            >
              <Suspense fallback={<PageLoading message="Loading hosts..." />}>
                <ProtectedRoute>
                  <Hosts />
                </ProtectedRoute>
              </Suspense>
            </ErrorBoundary>
          } />
          <Route path="hosts/:host_id" element={
            <ErrorBoundary
              level="route"
              onError={handleRouteError}
              context={{ route: 'host-detail', timestamp: Date.now() }}
              enableRetry={true}
            >
              <Suspense fallback={<PageLoading message="Loading host details..." />}>
                <ProtectedRoute>
                  <HostDetail />
                </ProtectedRoute>
              </Suspense>
            </ErrorBoundary>
          } />
          <Route path="users" element={
            <ErrorBoundary
              level="route"
              onError={handleRouteError}
              context={{ route: 'users', timestamp: Date.now() }}
              enableRetry={true}
            >
              <Suspense fallback={<PageLoading message="Loading user access..." />}>
                <ProtectedRoute>
                  <UserAccess />
                </ProtectedRoute>
              </Suspense>
            </ErrorBoundary>
          } />
        </Route>
      </Routes>
        </Suspense>
    </ErrorBoundary>
    </ErrorProvider>
  )
}

export default App

