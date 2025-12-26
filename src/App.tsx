import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Hosts from './pages/Hosts'
import HostDetail from './pages/HostDetail'
import UserAccess from './pages/UserAccess'
import Login from './pages/Login'
import Register from './pages/Register'
import { auth } from './api/auth'

function App() {
  return (
    <Routes>
      <Route path="/login" element={
        auth.isAuthenticated() ? <Navigate to="/" replace /> : <Login />
      } />
      <Route path="/register" element={
        auth.isAuthenticated() ? <Navigate to="/" replace /> : <Register />
      } />
      <Route path="/" element={<Layout />}>
        <Route index element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="hosts" element={
          <ProtectedRoute>
            <Hosts />
          </ProtectedRoute>
        } />
        <Route path="hosts/:host_id" element={
          <ProtectedRoute>
            <HostDetail />
          </ProtectedRoute>
        } />
        <Route path="users" element={
          <ProtectedRoute>
            <UserAccess />
          </ProtectedRoute>
        } />
      </Route>
    </Routes>
  )
}

export default App

