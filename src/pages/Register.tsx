import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { UserPlus, User, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react'
import { authApi, auth } from '../api/auth'
import type { RegisterRequest } from '../types'
import styles from './Register.module.css'

export default function Register() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setLoading(true)

    try {
      const request: RegisterRequest = { username, email, password }
      await authApi.register(request)
      
      // Registration successful - automatically log in
      setSuccess(true)
      
      // Try to log in with the new credentials
      try {
        const loginResponse = await authApi.login({ username, password })
        auth.setApiKey(loginResponse.token)
        
        // Redirect to dashboard
        navigate('/')
      } catch (loginErr) {
        // Registration succeeded but auto-login failed - redirect to login page
        navigate('/login', { state: { message: 'Registration successful! Please sign in.' } })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <UserPlus size={32} />
          </div>
          <h1>Create Account</h1>
          <p>Sign up to get started with Sluggisty</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className={styles.success}>
              <CheckCircle size={16} />
              <span>Account created successfully! Logging you in...</span>
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
              autoComplete="username"
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="email">
              <Mail size={16} />
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
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
              autoComplete="new-password"
              minLength={8}
            />
            <span className={styles.hint}>Must be at least 8 characters</span>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword">
              <Lock size={16} />
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
              minLength={8}
            />
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading || !username || !email || !password || !confirmPassword}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <div className={styles.footer}>
            <span>Already have an account?</span>
            <Link to="/login" className={styles.link}>
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

