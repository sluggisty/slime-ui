import React, { useState, useEffect } from 'react'
import { Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw, Server, Wifi, Database } from 'lucide-react'
import { healthMonitor, HealthStatus, HealthCheckResult } from '../utils/healthCheck'
import { logger } from '../utils/logger'
import { usePerformanceMonitoring, useInteractionTracking } from '../hooks/usePerformanceMonitoring'
import styles from './HealthDashboard.module.css'

/**
 * Health Dashboard Component
 *
 * Displays application health status, performance metrics, and monitoring data
 */
export const HealthDashboard: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const { measureAsync } = usePerformanceMonitoring()
  const { trackClick, trackEngagement } = useInteractionTracking()

  // Load initial health status
  useEffect(() => {
    loadHealthStatus()
  }, [])

  // Auto-refresh health status
  useEffect(() => {
    const interval = setInterval(loadHealthStatus, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadHealthStatus = async () => {
    setIsLoading(true)
    try {
      const status = await measureAsync('health_check_load', () => healthMonitor.checkHealth())
      setHealthStatus(status)
      setLastUpdated(new Date())
    } catch (error) {
      logger.error('Failed to load health status', error as Error, {
        action: 'health_dashboard_error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    trackClick('refresh_health_status', 'button')
    loadHealthStatus()
  }

  const handleViewDetails = (checkName: string) => {
    trackClick(`view_health_details_${checkName}`, 'button')
    // Could open a modal with detailed information
    logger.info('Health check details viewed', {
      action: 'health_details_view',
      checkName
    })
  }

  const getStatusIcon = (status: HealthCheckResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className={styles.statusIconPass} />
      case 'warn':
        return <AlertTriangle className={styles.statusIconWarn} />
      case 'fail':
        return <XCircle className={styles.statusIconFail} />
    }
  }

  const getStatusText = (status: HealthCheckResult['status']) => {
    switch (status) {
      case 'pass':
        return 'Healthy'
      case 'warn':
        return 'Warning'
      case 'fail':
        return 'Failed'
    }
  }

  const getOverallStatusColor = (status: HealthStatus['overall']) => {
    switch (status) {
      case 'healthy':
        return styles.statusHealthy
      case 'degraded':
        return styles.statusDegraded
      case 'unhealthy':
        return styles.statusUnhealthy
    }
  }

  const getCheckIcon = (name: string) => {
    if (name.includes('api') || name.includes('backend')) return <Server size={16} />
    if (name.includes('network') || name.includes('connectivity')) return <Wifi size={16} />
    if (name.includes('database') || name.includes('db')) return <Database size={16} />
    return <Activity size={16} />
  }

  if (!healthStatus) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <RefreshCw className={styles.loadingIcon} />
          <p>Loading health status...</p>
        </div>
      </div>
    )
  }

  const failedChecks = Object.values(healthStatus.checks).filter(check => check.status === 'fail').length
  const warningChecks = Object.values(healthStatus.checks).filter(check => check.status === 'warn').length

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <Activity size={24} />
          System Health
        </h2>
        <div className={styles.headerActions}>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className={styles.refreshButton}
          >
            <RefreshCw size={16} className={isLoading ? styles.refreshing : ''} />
            Refresh
          </button>
          {lastUpdated && (
            <span className={styles.lastUpdated}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Overall Status */}
      <div className={`${styles.overallStatus} ${getOverallStatusColor(healthStatus.overall)}`}>
        <div className={styles.statusIndicator}>
          {healthStatus.overall === 'healthy' && <CheckCircle size={32} />}
          {healthStatus.overall === 'degraded' && <AlertTriangle size={32} />}
          {healthStatus.overall === 'unhealthy' && <XCircle size={32} />}
        </div>
        <div className={styles.statusInfo}>
          <h3 className={styles.statusTitle}>
            {healthStatus.overall === 'healthy' && 'All Systems Operational'}
            {healthStatus.overall === 'degraded' && 'Some Issues Detected'}
            {healthStatus.overall === 'unhealthy' && 'System Issues Require Attention'}
          </h3>
          <p className={styles.statusDescription}>
            {Object.keys(healthStatus.checks).length} checks • {failedChecks} failed • {warningChecks} warnings
          </p>
        </div>
      </div>

      {/* Health Checks */}
      <div className={styles.checksGrid}>
        {Object.entries(healthStatus.checks).map(([name, check]) => (
          <div key={name} className={styles.checkCard}>
            <div className={styles.checkHeader}>
              <div className={styles.checkIcon}>
                {getCheckIcon(name)}
              </div>
              <div className={styles.checkInfo}>
                <h4 className={styles.checkName}>{name}</h4>
                <div className={styles.checkStatus}>
                  {getStatusIcon(check.status)}
                  <span className={styles.checkStatusText}>
                    {getStatusText(check.status)}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.checkDetails}>
              <div className={styles.checkMetric}>
                <span className={styles.metricLabel}>Duration:</span>
                <span className={styles.metricValue}>
                  {Math.round(check.duration)}ms
                </span>
              </div>
              <div className={styles.checkTimestamp}>
                {new Date(check.timestamp).toLocaleTimeString()}
              </div>
            </div>

            {check.message && (
              <div className={styles.checkMessage}>
                {check.message}
              </div>
            )}

            <button
              onClick={() => handleViewDetails(name)}
              className={styles.viewDetailsButton}
            >
              View Details
            </button>
          </div>
        ))}
      </div>

      {/* System Information */}
      <div className={styles.systemInfo}>
        <h3>System Information</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Version:</span>
            <span className={styles.infoValue}>{healthStatus.version}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Environment:</span>
            <span className={styles.infoValue}>{healthStatus.environment}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Last Check:</span>
            <span className={styles.infoValue}>
              {new Date(healthStatus.timestamp).toLocaleString()}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Uptime:</span>
            <span className={styles.infoValue}>
              {Math.round((Date.now() - performance.timing.navigationStart) / 1000 / 60)} minutes
            </span>
          </div>
        </div>
      </div>

      {/* Performance Summary */}
      <div className={styles.performanceSummary}>
        <h3>Performance Summary</h3>
        <div className={styles.performanceGrid}>
          <div className={styles.performanceItem}>
            <span className={styles.performanceLabel}>Average Response Time:</span>
            <span className={styles.performanceValue}>
              {Math.round(
                Object.values(healthStatus.checks).reduce((sum, check) => sum + check.duration, 0) /
                Object.keys(healthStatus.checks).length
              )}ms
            </span>
          </div>
          <div className={styles.performanceItem}>
            <span className={styles.performanceLabel}>Success Rate:</span>
            <span className={styles.performanceValue}>
              {Math.round(
                (Object.values(healthStatus.checks).filter(check => check.status === 'pass').length /
                 Object.keys(healthStatus.checks).length) * 100
              )}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HealthDashboard
