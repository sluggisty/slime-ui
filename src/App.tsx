import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import { errorLogger } from './utils/errorLogger'
import Dashboard from './pages/Dashboard'
import Hosts from './pages/Hosts'
import HostDetail from './pages/HostDetail'
import UserAccess from './pages/UserAccess'
import Login from './pages/Login'
import Register from './pages/Register'
import { auth } from './api/auth'

function App() {
  // Global error handler
  const handleGlobalError = async (error: Error, errorInfo: React.ErrorInfo, context?: any) => {
    // Log error and send report
    await errorLogger.reportError(error, errorInfo, context)
  }

  // Route-level error handler
  const handleRouteError = async (error: Error, errorInfo: React.ErrorInfo, context?: any) => {
    // Log route-specific errors
    await errorLogger.reportError(error, errorInfo, context)
  }

  return (
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
  )
}

export default App

