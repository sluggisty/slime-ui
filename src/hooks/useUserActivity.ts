import { useEffect, useCallback } from 'react'
import { logger } from '../utils/logger'

/**
 * Hook for tracking user activity and engagement
 */
export function useUserActivity() {
  // Track page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      logger.trackEngagement(
        document.hidden ? 'page_hidden' : 'page_visible'
      )
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Track scroll depth
  useEffect(() => {
    let maxScrollDepth = 0

    const handleScroll = () => {
      const scrollTop = window.scrollY
      const documentHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrollDepth = Math.round((scrollTop / documentHeight) * 100)

      if (scrollDepth > maxScrollDepth && scrollDepth > 0) {
        maxScrollDepth = scrollDepth

        // Track scroll milestones
        if (scrollDepth >= 25 && scrollDepth % 25 === 0) {
          logger.trackEngagement('scroll_depth', scrollDepth, {
            action: 'scroll_milestone'
          })
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Track time spent on page
  useEffect(() => {
    const startTime = Date.now()
    let timeSpent = 0

    const interval = setInterval(() => {
      timeSpent = Math.floor((Date.now() - startTime) / 1000)

      // Track engagement milestones
      if (timeSpent > 0 && timeSpent % 30 === 0) { // Every 30 seconds
        logger.trackEngagement('time_spent', timeSpent, {
          action: 'time_milestone'
        })
      }
    }, 1000)

    const handleBeforeUnload = () => {
      logger.trackEngagement('page_exit', timeSpent, {
        action: 'page_exit'
      })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      logger.trackEngagement('component_unmount', timeSpent, {
        action: 'component_cleanup'
      })
    }
  }, [])

  // Return activity tracking functions
  const trackAction = useCallback((action: string, data?: any) => {
    logger.trackAction(action, { action }, data)
  }, [])

  const trackClick = useCallback((element: string, elementType?: string) => {
    logger.trackAction('click', {
      action: 'user_click',
      element,
      elementType
    })
  }, [])

  const trackFormInteraction = useCallback((formId: string, field?: string, action: 'focus' | 'blur' | 'change' = 'change') => {
    logger.trackAction(`form_${action}`, {
      action: 'form_interaction',
      formId,
      field,
      interactionType: action
    })
  }, [])

  const trackSearch = useCallback((query: string, resultsCount?: number) => {
    logger.trackAction('search', {
      action: 'search_query',
      query: query.substring(0, 100), // Truncate for privacy
      resultsCount
    })
  }, [])

  const trackError = useCallback((errorType: string, errorMessage?: string) => {
    logger.trackAction('error_encountered', {
      action: 'user_error',
      errorType,
      errorMessage: errorMessage?.substring(0, 200) // Truncate for privacy
    })
  }, [])

  return {
    trackAction,
    trackClick,
    trackFormInteraction,
    trackSearch,
    trackError
  }
}

/**
 * Hook for tracking navigation and route changes
 */
export function useNavigationTracking() {
  const trackPageView = useCallback((path: string, previousPath?: string) => {
    logger.trackPageView(path, {
      action: 'page_view',
      previousPath,
      timestamp: Date.now()
    })
  }, [])

  const trackNavigation = useCallback((from: string, to: string, method: 'link' | 'redirect' | 'back' | 'forward' = 'link') => {
    logger.trackAction('navigation', {
      action: 'page_navigation',
      from,
      to,
      method
    })
  }, [])

  return {
    trackPageView,
    trackNavigation
  }
}

/**
 * Hook for tracking user engagement metrics
 */
export function useEngagementTracking() {
  const trackFeatureUsage = useCallback((feature: string, action: string, data?: any) => {
    logger.trackEngagement(`feature_${feature}_${action}`, undefined, {
      feature,
      action,
      ...data
    })
  }, [])

  const trackPerformance = useCallback((metric: string, value: number, context?: any) => {
    logger.performance(metric, value, {
      action: 'performance_metric',
      metric,
      ...context
    })
  }, [])

  const trackConversion = useCallback((event: string, value?: number, metadata?: any) => {
    logger.trackEngagement(`conversion_${event}`, value, {
      action: 'conversion',
      event,
      ...metadata
    })
  }, [])

  return {
    trackFeatureUsage,
    trackPerformance,
    trackConversion
  }
}
