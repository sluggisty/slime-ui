import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import { ErrorProvider, ErrorNotifications } from './contexts/ErrorContext'
import { errorHandler } from './utils/errorHandler'
import Dashboard from './pages/Dashboard'
import Hosts from './pages/Hosts'
import HostDetail from './pages/HostDetail'
import UserAccess from './pages/UserAccess'
import Login from './pages/Login'
import Register from './pages/Register'
import { auth } from './api/auth'

function App() {
  // Initialize global error handler
  React.useEffect(() => {
    errorHandler.initialize()
    return () => errorHandler.destroy()
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
      <Routes>
        {/* Auth routes - separate error boundary for auth flow */}
        <Route path="/login" element={
        <ErrorBoundary
          level="route"
          onError={handleRouteError}
          context={{ route: '/login', timestamp: Date.now() }}
        >
            {auth.isAuthenticated() ? <Navigate to="/" replace /> : <Login />}
          </ErrorBoundary>
        } />
        <Route path="/register" element={
        <ErrorBoundary
          level="route"
          onError={handleRouteError}
          context={{ route: '/register', timestamp: Date.now() }}
        >
            {auth.isAuthenticated() ? <Navigate to="/" replace /> : <Register />}
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
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            </ErrorBoundary>
          } />
          <Route path="hosts" element={
            <ErrorBoundary
              level="route"
              onError={handleRouteError}
              context={{ route: 'hosts', timestamp: Date.now() }}
              enableRetry={true}
            >
              <ProtectedRoute>
                <Hosts />
              </ProtectedRoute>
            </ErrorBoundary>
          } />
          <Route path="hosts/:host_id" element={
            <ErrorBoundary
              level="route"
              onError={handleRouteError}
              context={{ route: 'host-detail', timestamp: Date.now() }}
              enableRetry={true}
            >
              <ProtectedRoute>
                <HostDetail />
              </ProtectedRoute>
            </ErrorBoundary>
          } />
          <Route path="users" element={
            <ErrorBoundary
              level="route"
              onError={handleRouteError}
              context={{ route: 'users', timestamp: Date.now() }}
              enableRetry={true}
            >
              <ProtectedRoute>
                <UserAccess />
              </ProtectedRoute>
            </ErrorBoundary>
          } />
        </Route>
      </Routes>
    </ErrorBoundary>
    </ErrorProvider>
  )
}

export default App

