import React, { useEffect, useRef } from 'react'
import { logger } from '../utils/logger'

/**
 * Hook for monitoring React component performance
 */
export function useComponentPerformance(componentName: string) {
  const renderCountRef = useRef(0)
  const mountTimeRef = useRef<number>()
  const lastRenderTimeRef = useRef<number>()

  useEffect(() => {
    // Component mount
    mountTimeRef.current = performance.now()
    logger.info(`Component mounted: ${componentName}`, {
      component: componentName,
      action: 'component_mount'
    })

    return () => {
      // Component unmount
      if (mountTimeRef.current) {
        const lifetime = performance.now() - mountTimeRef.current
        logger.performance(`${componentName}_lifetime`, lifetime, {
          component: componentName,
          action: 'component_unmount',
          renderCount: renderCountRef.current
        })
      }
    }
  }, [componentName])

  useEffect(() => {
    // Track renders
    const now = performance.now()
    renderCountRef.current++

    if (lastRenderTimeRef.current) {
      const renderTime = now - lastRenderTimeRef.current
      logger.performance(`${componentName}_render`, renderTime, {
        component: componentName,
        action: 'component_render',
        renderCount: renderCountRef.current
      })
    }

    lastRenderTimeRef.current = now
  })

  // Return performance utilities
  return {
    logAction: (action: string, data?: any) => {
      logger.trackAction(action, { component: componentName }, data)
    },

    measureAsync: async function <T>(
      operationName: string,
      operation: () => Promise<T>
    ): Promise<T> {
      return logger.measureAsync(`${componentName}_${operationName}`, operation, {
        component: componentName
      })
    }
  }
}

/**
 * Hook for monitoring API call performance
 */
export function useApiPerformance() {
  return {
    measureApiCall: async function <T>(
      endpoint: string,
      method: string,
      operation: () => Promise<T>
    ): Promise<T> {
      return logger.measureAsync(`api_${method}_${endpoint}`, operation, {
        route: endpoint,
        action: 'api_call',
        category: 'api_performance'
      })
    },

    logApiError: (endpoint: string, method: string, error: Error, status?: number) => {
      logger.error(`API Error: ${method} ${endpoint}`, error, {
        route: endpoint,
        action: 'api_error',
        category: 'api_error',
        status
      })
    },

    logApiSuccess: (endpoint: string, method: string, duration: number, status: number) => {
      logger.performance(`api_${method}_${endpoint}`, duration, {
        route: endpoint,
        action: 'api_success',
        category: 'api_performance',
        status
      })
    }
  }
}

/**
 * Hook for monitoring user interactions
 */
export function useInteractionTracking() {
  return {
    trackClick: (elementId: string, elementType: string, data?: any) => {
      logger.trackAction('click', {
        action: 'user_click',
        elementId,
        elementType,
        category: 'user_interaction'
      }, data)
    },

    trackFormSubmission: (formId: string, success: boolean, data?: any) => {
      logger.trackAction('form_submit', {
        action: 'form_submission',
        formId,
        success,
        category: 'user_interaction'
      }, data)
    },

    trackNavigation: (from: string, to: string) => {
      logger.trackAction('navigation', {
        action: 'page_navigation',
        from,
        to,
        category: 'navigation'
      })
    },

    trackEngagement: (event: string, value?: number) => {
      logger.trackEngagement(event, value, {
        category: 'user_engagement'
      })
    }
  }
}

/**
 * Performance monitoring component that wraps children and monitors their performance
 */
export function PerformanceMonitor({
  children,
  componentName,
  enableRenderTracking = true,
  enableInteractionTracking = false
}: {
  children: React.ReactNode
  componentName: string
  enableRenderTracking?: boolean
  enableInteractionTracking?: boolean
}) {
  const { logAction } = useComponentPerformance(componentName)

  useEffect(() => {
    if (enableInteractionTracking) {
      // Track interactions within this component
      const handleClick = (event: Event) => {
        const target = event.target as HTMLElement
        if (target) {
          logAction('interaction', {
            element: target.tagName.toLowerCase(),
            id: target.id,
            className: target.className
          })
        }
      }

      // Add event listeners to children
      const componentElement = document.querySelector(`[data-component="${componentName}"]`)
      if (componentElement) {
        componentElement.addEventListener('click', handleClick)
        return () => componentElement.removeEventListener('click', handleClick)
      }
    }
  }, [componentName, enableInteractionTracking, logAction])

  if (enableRenderTracking) {
    useComponentPerformance(componentName)
  }

  return (
    <div data-component={componentName}>
      {children}
    </div>
  )
}
