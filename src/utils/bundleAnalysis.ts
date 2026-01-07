/**
 * Bundle Analysis Utilities
 *
 * Helps analyze bundle size and identify code splitting opportunities
 */

import { logger } from './logger'

export interface BundleChunk {
  name: string
  size: number
  sizeGzip: number
  modules: string[]
  isEntry: boolean
  isDynamic: boolean
}

export interface BundleAnalysis {
  totalSize: number
  totalSizeGzip: number
  chunks: BundleChunk[]
  recommendations: string[]
  largestModules: Array<{
    name: string
    size: number
    chunk: string
  }>
}

/**
 * Analyze webpack bundle stats to identify code splitting opportunities
 */
export function analyzeBundle(bundleStats: any): BundleAnalysis {
  const analysis: BundleAnalysis = {
    totalSize: 0,
    totalSizeGzip: 0,
    chunks: [],
    recommendations: [],
    largestModules: []
  }

  try {
    // Parse webpack bundle stats
    if (bundleStats && bundleStats.chunks) {
      bundleStats.chunks.forEach((chunk: any) => {
        const chunkInfo: BundleChunk = {
          name: chunk.names?.[0] || chunk.id?.toString() || 'unknown',
          size: chunk.size || 0,
          sizeGzip: chunk.sizeGzip || chunk.size || 0,
          modules: chunk.modules?.map((m: any) => m.name || m.identifier) || [],
          isEntry: chunk.entry || false,
          isDynamic: chunk.isDynamic || false
        }

        analysis.chunks.push(chunkInfo)
        analysis.totalSize += chunkInfo.size
        analysis.totalSizeGzip += chunkInfo.sizeGzip
      })
    }

    // Analyze chunks for recommendations
    analysis.recommendations = generateRecommendations(analysis)

    // Find largest modules
    analysis.largestModules = findLargestModules(analysis)

    logger.info('Bundle analysis completed', {
      action: 'bundle_analysis',
      totalSize: analysis.totalSize,
      totalSizeGzip: analysis.totalSizeGzip,
      chunkCount: analysis.chunks.length,
      recommendationsCount: analysis.recommendations.length
    }, {
      chunks: analysis.chunks.map(c => ({ name: c.name, size: c.size })),
      recommendations: analysis.recommendations
    })

  } catch (error) {
    logger.error('Bundle analysis failed', error as Error, {
      action: 'bundle_analysis_error'
    })
  }

  return analysis
}

/**
 * Generate recommendations for code splitting improvements
 */
function generateRecommendations(analysis: BundleAnalysis): string[] {
  const recommendations: string[] = []

  // Check for large entry chunks
  const entryChunks = analysis.chunks.filter(c => c.isEntry)
  entryChunks.forEach(chunk => {
    if (chunk.size > 500 * 1024) { // > 500KB
      recommendations.push(
        `Entry chunk "${chunk.name}" is ${formatBytes(chunk.size)}. ` +
        'Consider lazy loading non-critical components.'
      )
    }
  })

  // Check for large vendor chunks
  const vendorChunks = analysis.chunks.filter(c =>
    c.name.includes('vendor') || c.name.includes('node_modules')
  )
  vendorChunks.forEach(chunk => {
    if (chunk.size > 1000 * 1024) { // > 1MB
      recommendations.push(
        `Vendor chunk "${chunk.name}" is ${formatBytes(chunk.size)}. ` +
        'Consider splitting large third-party libraries.'
      )
    }
  })

  // Check for unused dynamic imports
  const dynamicChunks = analysis.chunks.filter(c => c.isDynamic)
  if (dynamicChunks.length === 0) {
    recommendations.push(
      'No dynamic imports detected. Consider implementing route-based code splitting.'
    )
  }

  // Check for large individual modules
  analysis.chunks.forEach(chunk => {
    chunk.modules.forEach(module => {
      const moduleSize = estimateModuleSize(module)
      if (moduleSize > 100 * 1024) { // > 100KB
        recommendations.push(
          `Large module "${module}" (${formatBytes(moduleSize)}) in chunk "${chunk.name}". ` +
          'Consider lazy loading or code splitting.'
        )
      }
    })
  })

  // General recommendations
  if (analysis.totalSize > 2000 * 1024) { // > 2MB
    recommendations.push(
      `Total bundle size (${formatBytes(analysis.totalSize)}) is large. ` +
      'Implement aggressive code splitting and consider using a CDN for assets.'
    )
  }

  if (analysis.chunks.length > 10) {
    recommendations.push(
      `High number of chunks (${analysis.chunks.length}). ` +
      'Consider consolidating small chunks or implementing better chunk naming.'
    )
  }

  return recommendations
}

/**
 * Find the largest modules across all chunks
 */
function findLargestModules(analysis: BundleAnalysis): Array<{
  name: string
  size: number
  chunk: string
}> {
  const modules: Array<{
    name: string
    size: number
    chunk: string
  }> = []

  analysis.chunks.forEach(chunk => {
    chunk.modules.forEach(module => {
      const size = estimateModuleSize(module)
      modules.push({
        name: module,
        size,
        chunk: chunk.name
      })
    })
  })

  // Sort by size descending and take top 10
  return modules
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)
}

/**
 * Estimate module size from module identifier
 */
function estimateModuleSize(moduleName: string): number {
  // This is a rough estimation based on common patterns
  // In a real implementation, you'd use actual module sizes from webpack stats

  if (moduleName.includes('node_modules')) {
    // Estimate based on common library sizes
    if (moduleName.includes('react')) return 150 * 1024 // ~150KB
    if (moduleName.includes('lodash')) return 500 * 1024 // ~500KB
    if (moduleName.includes('moment')) return 300 * 1024 // ~300KB
    if (moduleName.includes('chart.js') || moduleName.includes('d3')) return 400 * 1024 // ~400KB
    if (moduleName.includes('lucide-react')) return 200 * 1024 // ~200KB
    return 50 * 1024 // Default node_modules estimate
  }

  // Estimate based on file extensions
  if (moduleName.endsWith('.css')) return 20 * 1024 // ~20KB average CSS
  if (moduleName.endsWith('.svg') || moduleName.includes('icon')) return 5 * 1024 // ~5KB icons
  if (moduleName.includes('chart') || moduleName.includes('graph')) return 100 * 1024 // ~100KB charts

  return 10 * 1024 // Default 10KB for JS modules
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Generate a bundle analysis report
 */
export function generateBundleReport(analysis: BundleAnalysis): string {
  let report = '# Bundle Analysis Report\n\n'

  report += `## Summary\n`
  report += `- **Total Size**: ${formatBytes(analysis.totalSize)}\n`
  report += `- **Gzipped Size**: ${formatBytes(analysis.totalSizeGzip)}\n`
  report += `- **Chunks**: ${analysis.chunks.length}\n\n`

  report += `## Chunks\n\n`
  analysis.chunks.forEach(chunk => {
    report += `### ${chunk.name}\n`
    report += `- **Size**: ${formatBytes(chunk.size)}\n`
    report += `- **Gzipped**: ${formatBytes(chunk.sizeGzip)}\n`
    report += `- **Type**: ${chunk.isEntry ? 'Entry' : chunk.isDynamic ? 'Dynamic' : 'Regular'}\n`
    report += `- **Modules**: ${chunk.modules.length}\n\n`
  })

  if (analysis.recommendations.length > 0) {
    report += `## Recommendations\n\n`
    analysis.recommendations.forEach((rec, index) => {
      report += `${index + 1}. ${rec}\n\n`
    })
  }

  if (analysis.largestModules.length > 0) {
    report += `## Largest Modules\n\n`
    analysis.largestModules.forEach((module, index) => {
      report += `${index + 1}. **${module.name}** - ${formatBytes(module.size)} (${module.chunk})\n`
    })
    report += '\n'
  }

  return report
}

/**
 * Performance monitoring for bundle loading
 */
export class BundlePerformanceMonitor {
  private loadStartTimes: Map<string, number> = new Map()

  /**
   * Start monitoring bundle load time
   */
  startBundleLoad(bundleName: string): void {
    this.loadStartTimes.set(bundleName, performance.now())
    logger.debug(`Started loading bundle: ${bundleName}`, {
      action: 'bundle_load_start',
      bundleName
    })
  }

  /**
   * End monitoring bundle load time
   */
  endBundleLoad(bundleName: string): void {
    const startTime = this.loadStartTimes.get(bundleName)
    if (startTime) {
      const duration = performance.now() - startTime
      logger.performance(`bundle_load_${bundleName}`, duration, {
        action: 'bundle_load_complete',
        bundleName
      })

      this.loadStartTimes.delete(bundleName)

      // Warn about slow bundle loads
      if (duration > 1000) { // > 1 second
        logger.warn(`Slow bundle load: ${bundleName}`, {
          action: 'slow_bundle_load',
          bundleName,
          duration
        })
      }
    }
  }

  /**
   * Monitor lazy component loading
   */
  monitorLazyLoad<T>(
    componentName: string,
    importFn: () => Promise<T>
  ): Promise<T> {
    this.startBundleLoad(componentName)

    return importFn().finally(() => {
      this.endBundleLoad(componentName)
    })
  }
}

// Global instance
export const bundleMonitor = new BundlePerformanceMonitor()

// Utility function for monitored lazy loading
export function monitoredLazy<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  componentName: string
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    bundleMonitor.monitorLazyLoad(componentName, importFn)
  )
}
