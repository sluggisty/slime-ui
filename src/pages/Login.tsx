import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { LogIn, User, Lock, AlertCircle } from 'lucide-react'
import { authApi, auth } from '../api/auth'
import type { LoginRequest } from '../types'
import styles from './Login.module.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Check for success message from registration
  const successMessage = location.state?.message

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const request: LoginRequest = { username, password }
      const response = await authApi.login(request)
      
      // Store API key
      auth.setApiKey(response.token)
      
      // Redirect to dashboard
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <LogIn size={32} />
          </div>
          <h1>Welcome to Sluggisty</h1>
          <p>Sign in to access your system insights</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {successMessage && (
            <div className={styles.success}>
              <span>{successMessage}</span>
            </div>
          )}
          {error && (
            <div className={styles.error}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.inputGroup}>
            <label htmlFor="username">
              <User size={16} />
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">
              <Lock size={16} />
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading || !username || !password}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className={styles.footer}>
            <span>Don't have an account?</span>
            <Link to="/register" className={styles.link}>
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}


