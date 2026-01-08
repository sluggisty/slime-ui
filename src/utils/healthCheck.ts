/**
 * Health Check Monitoring System
 *
 * Monitors application health, connectivity, and system status
 */

import { logger } from './logger';

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  checks: {
    [key: string]: HealthCheckResult;
  };
  version: string;
  environment: string;
}

export interface HealthCheckResult {
  status: 'pass' | 'fail' | 'warn';
  timestamp: number;
  duration: number;
  message?: string;
  details?: any;
  error?: Error;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // milliseconds
  timeout: number; // milliseconds
  endpoints: HealthCheckEndpoint[];
  enableSelfMonitoring: boolean;
}

export interface HealthCheckEndpoint {
  name: string;
  url: string;
  method?: 'GET' | 'POST' | 'HEAD';
  headers?: Record<string, string>;
  expectedStatus?: number;
  timeout?: number;
  critical?: boolean; // If true, failure marks overall health as unhealthy
}

class HealthMonitor {
  private config: HealthCheckConfig;
  private checkTimer?: NodeJS.Timeout;
  private lastStatus?: HealthStatus;
  private consecutiveFailures = 0;
  private maxConsecutiveFailures = 3;

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = {
      enabled: true,
      interval: 60000, // 1 minute
      timeout: 10000, // 10 seconds
      endpoints: [],
      enableSelfMonitoring: true,
      ...config,
    };
  }

  /**
   * Initialize health monitoring
   */
  initialize(): void {
    if (!this.config.enabled) return;

    logger.info('Health monitoring initialized', {
      action: 'health_monitor_init',
      interval: this.config.interval,
      endpointCount: this.config.endpoints.length,
    });

    // Add default health checks
    this.addDefaultChecks();

    // Start monitoring
    this.startMonitoring();
  }

  /**
   * Destroy health monitoring
   */
  destroy(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }
    logger.info('Health monitoring stopped');
  }

  /**
   * Get current health status
   */
  getStatus(): HealthStatus | undefined {
    return this.lastStatus;
  }

  /**
   * Check health synchronously
   */
  async checkHealth(): Promise<HealthStatus> {
    const checks: { [key: string]: HealthCheckResult } = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Run all health checks
    const checkPromises = this.config.endpoints.map(endpoint => this.performHealthCheck(endpoint));

    const results = await Promise.allSettled(checkPromises);

    results.forEach((result, index) => {
      const endpoint = this.config.endpoints[index];
      const checkResult =
        result.status === 'fulfilled'
          ? result.value
          : this.createFailedResult(endpoint.name, result.reason);

      checks[endpoint.name] = checkResult;

      // Determine overall status
      if (checkResult.status === 'fail' && endpoint.critical) {
        overallStatus = 'unhealthy';
      } else if (checkResult.status === 'fail' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      } else if (checkResult.status === 'warn' && overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    });

    const status: HealthStatus = {
      overall: overallStatus,
      timestamp: Date.now(),
      checks,
      version: import.meta.env.VITE_APP_VERSION || '1.0.0',
      environment: import.meta.env.PROD ? 'production' : 'development',
    };

    this.lastStatus = status;

    // Log health status
    this.logHealthStatus(status);

    // Handle consecutive failures
    if (overallStatus === 'unhealthy') {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        logger.error('Multiple consecutive health check failures', undefined, {
          action: 'health_check_failure',
          consecutiveFailures: this.consecutiveFailures,
          status,
        });
      }
    } else {
      this.consecutiveFailures = 0;
    }

    return status;
  }

  /**
   * Add a health check endpoint
   */
  addEndpoint(endpoint: HealthCheckEndpoint): void {
    this.config.endpoints.push(endpoint);
    logger.info('Health check endpoint added', {
      action: 'health_endpoint_added',
      endpoint: endpoint.name,
      url: endpoint.url,
    });
  }

  /**
   * Remove a health check endpoint
   */
  removeEndpoint(name: string): void {
    const index = this.config.endpoints.findIndex(ep => ep.name === name);
    if (index > -1) {
      this.config.endpoints.splice(index, 1);
      logger.info('Health check endpoint removed', {
        action: 'health_endpoint_removed',
        endpoint: name,
      });
    }
  }

  /**
   * Update health check configuration
   */
  updateConfig(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart monitoring if interval changed
    if (this.checkTimer && config.interval) {
      clearInterval(this.checkTimer);
      this.startMonitoring();
    }

    logger.info('Health check configuration updated', {
      action: 'health_config_updated',
      config: this.config,
    });
  }

  /**
   * Perform a single health check
   */
  private async performHealthCheck(endpoint: HealthCheckEndpoint): Promise<HealthCheckResult> {
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        endpoint.timeout || this.config.timeout
      );

      const response = await fetch(endpoint.url, {
        method: endpoint.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SlimeUI-HealthCheck/1.0',
          ...endpoint.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = performance.now() - startTime;

      const expectedStatus = endpoint.expectedStatus || 200;

      if (response.status === expectedStatus) {
        return {
          status: 'pass',
          timestamp: Date.now(),
          duration,
          message: `Health check passed (${response.status})`,
        };
      } else if (response.status >= 500) {
        return {
          status: 'fail',
          timestamp: Date.now(),
          duration,
          message: `Server error: ${response.status} ${response.statusText}`,
          details: { status: response.status, statusText: response.statusText },
        };
      } else {
        return {
          status: 'warn',
          timestamp: Date.now(),
          duration,
          message: `Unexpected status: ${response.status}`,
          details: { status: response.status, expectedStatus },
        };
      }
    } catch (error) {
      const duration = performance.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        return {
          status: 'fail',
          timestamp: Date.now(),
          duration,
          message: 'Health check timeout',
          error: error as Error,
        };
      }

      return {
        status: 'fail',
        timestamp: Date.now(),
        duration,
        message: `Health check failed: ${(error as Error).message}`,
        error: error as Error,
      };
    }
  }

  /**
   * Create a failed health check result
   */
  private createFailedResult(name: string, error: any): HealthCheckResult {
    return {
      status: 'fail',
      timestamp: Date.now(),
      duration: 0,
      message: `Health check failed: ${error?.message || 'Unknown error'}`,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  /**
   * Add default health checks
   */
  private addDefaultChecks(): void {
    if (this.config.enableSelfMonitoring) {
      // Self health check
      this.addEndpoint({
        name: 'self',
        url: `${window.location.origin}/health`,
        method: 'GET',
        expectedStatus: 200,
        critical: false,
        timeout: 5000,
      });
    }

    // API health check (if API base URL is available)
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    if (apiBaseUrl) {
      this.addEndpoint({
        name: 'api',
        url: `${apiBaseUrl}/health`,
        method: 'GET',
        expectedStatus: 200,
        critical: true,
        timeout: 5000,
      });
    }
  }

  /**
   * Start periodic health monitoring
   */
  private startMonitoring(): void {
    if (this.config.interval > 0) {
      this.checkTimer = setInterval(async () => {
        try {
          await this.checkHealth();
        } catch (error) {
          logger.error('Health check monitoring failed', error as Error, {
            action: 'health_monitor_error',
          });
        }
      }, this.config.interval);
    }
  }

  /**
   * Log health status
   */
  private logHealthStatus(status: HealthStatus): void {
    const logData = {
      overall: status.overall,
      checkCount: Object.keys(status.checks).length,
      failedChecks: Object.values(status.checks).filter(check => check.status === 'fail').length,
      warnedChecks: Object.values(status.checks).filter(check => check.status === 'warn').length,
    };

    if (status.overall === 'healthy') {
      logger.info(
        'Health check completed',
        {
          action: 'health_check',
          status: 'healthy',
        },
        logData
      );
    } else if (status.overall === 'degraded') {
      logger.warn(
        'Health check completed with warnings',
        {
          action: 'health_check',
          status: 'degraded',
        },
        logData
      );
    } else {
      logger.error(
        'Health check failed',
        undefined,
        {
          action: 'health_check',
          status: 'unhealthy',
        },
        logData
      );
    }
  }
}

// Global health monitor instance
export const healthMonitor = new HealthMonitor();

// Convenience functions
export const checkHealth = () => healthMonitor.checkHealth();
export const getHealthStatus = () => healthMonitor.getStatus();

export default healthMonitor;
