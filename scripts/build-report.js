#!/usr/bin/env node

/**
 * Build Size Reporting Script for CI/CD
 *
 * Analyzes build output and generates reports for CI/CD pipelines
 * Provides size comparisons, budget checks, and deployment insights
 */

const fs = require('fs')
const path = require('path')

// Build size budgets (in KB)
const BUDGETS = {
  total: 2048,      // 2MB total
  initial: 512,     // 512KB initial bundle
  vendor: 1024,     // 1MB vendor libraries
  largestChunk: 600 // 600KB largest chunk
}

// ANSI color codes for CI/CD output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

// GitHub Actions log commands
const logCommands = {
  error: (message) => `::error::${message}`,
  warning: (message) => `::warning::${message}`,
  notice: (message) => `::notice::${message}`,
  group: (name) => `::group::${name}`,
  endGroup: () => '::endgroup::'
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function analyzeBuild() {
  const distDir = path.join(__dirname, '..', 'dist')
  const assetsDir = path.join(distDir, 'assets')

  if (!fs.existsSync(assetsDir)) {
    const error = '❌ No dist/assets directory found. Run build first.'
    console.error(logCommands.error(error))
    process.exit(1)
  }

  // Read all asset files
  const files = fs.readdirSync(assetsDir)
  const assets = []

  files.forEach(file => {
    const filePath = path.join(assetsDir, file)
    const stats = fs.statSync(filePath)

    if (stats.isFile()) {
      const ext = path.extname(file)
      const size = stats.size
      const sizeGzip = estimateGzipSize(size, ext)

      assets.push({
        name: file,
        path: filePath,
        size,
        sizeGzip,
        type: getAssetType(ext),
        isChunk: file.includes('-') && (ext === '.js' || ext === '.css'),
        isEntry: file.includes('main-') || file.includes('index-'),
        isVendor: file.includes('vendor') || file.includes('react-') || file.includes('ui-')
      })
    }
  })

  // Separate chunks and assets
  const chunks = assets.filter(asset => asset.isChunk)
  const staticAssets = assets.filter(asset => !asset.isChunk)

  // Calculate metrics
  const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0)
  const totalSizeGzip = assets.reduce((sum, asset) => sum + asset.sizeGzip, 0)
  const initialChunk = chunks.find(chunk => chunk.isEntry)
  const vendorChunks = chunks.filter(chunk => chunk.isVendor)
  const largestChunk = chunks.reduce((max, chunk) =>
    chunk.size > max.size ? chunk : max, chunks[0]
  )

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    build: {
      totalSize,
      totalSizeGzip,
      chunks: chunks.length,
      staticAssets: staticAssets.length,
      initialSize: initialChunk?.size || 0,
      vendorSize: vendorChunks.reduce((sum, chunk) => sum + chunk.size, 0),
      largestChunkSize: largestChunk?.size || 0
    },
    chunks: chunks.map(chunk => ({
      name: chunk.name,
      size: chunk.size,
      sizeGzip: chunk.sizeGzip,
      type: chunk.type
    })),
    budgets: checkBudgets({
      total: totalSize,
      initial: initialChunk?.size || 0,
      vendor: vendorChunks.reduce((sum, chunk) => sum + chunk.size, 0),
      largestChunk: largestChunk?.size || 0
    }),
    recommendations: generateRecommendations(chunks, totalSize)
  }

  // Output for CI/CD
  outputCICDReport(report)

  // Save detailed report
  const reportPath = path.join(distDir, 'build-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(`${colors.green}✅ Build report saved to: ${reportPath}${colors.reset}`)

  // Exit with error if budgets exceeded
  const budgetExceeded = report.budgets.some(budget => !budget.passed)
  if (budgetExceeded) {
    console.error(logCommands.error('Build size budgets exceeded'))
    process.exit(1)
  }
}

function getAssetType(ext) {
  switch (ext) {
    case '.js': return 'JavaScript'
    case '.css': return 'CSS'
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.gif':
    case '.svg':
    case '.webp': return 'Image'
    case '.woff':
    case '.woff2':
    case '.ttf':
    case '.eot': return 'Font'
    case '.json': return 'Data'
    default: return 'Other'
  }
}

function estimateGzipSize(size, ext) {
  // Rough estimation of gzip compression ratios
  const ratios = {
    '.js': 0.3,    // JavaScript compresses well
    '.css': 0.4,   // CSS compresses well
    '.html': 0.5,  // HTML compresses moderately
    '.json': 0.6,  // JSON compresses moderately
    '.png': 0.95,  // PNG images don't compress much
    '.jpg': 0.98,  // JPEG images don't compress much
    '.svg': 0.2,   // SVG compresses very well
    '.woff': 0.8,  // Fonts compress moderately
    '.woff2': 0.9  // WOFF2 is already compressed
  }

  const ratio = ratios[ext] || 0.7 // Default 70% compression
  return Math.round(size * ratio)
}

function checkBudgets(sizes) {
  return [
    {
      name: 'Total Bundle Size',
      size: sizes.total,
      budget: BUDGETS.total * 1024,
      passed: sizes.total <= BUDGETS.total * 1024
    },
    {
      name: 'Initial Bundle Size',
      size: sizes.initial,
      budget: BUDGETS.initial * 1024,
      passed: sizes.initial <= BUDGETS.initial * 1024
    },
    {
      name: 'Vendor Libraries Size',
      size: sizes.vendor,
      budget: BUDGETS.vendor * 1024,
      passed: sizes.vendor <= BUDGETS.vendor * 1024
    },
    {
      name: 'Largest Chunk Size',
      size: sizes.largestChunk,
      budget: BUDGETS.largestChunk * 1024,
      passed: sizes.largestChunk <= BUDGETS.largestChunk * 1024
    }
  ]
}

function generateRecommendations(chunks, totalSize) {
  const recommendations = []

  // Check for large chunks
  const largeChunks = chunks.filter(chunk => chunk.size > 500 * 1024)
  largeChunks.forEach(chunk => {
    recommendations.push(
      `Large chunk "${chunk.name}" (${formatBytes(chunk.size)}). Consider code splitting or lazy loading.`
    )
  })

  // Check for too many small chunks
  const smallChunks = chunks.filter(chunk => chunk.size < 5 * 1024)
  if (smallChunks.length > 5) {
    recommendations.push(
      `${smallChunks.length} small chunks detected. Consider consolidating to reduce HTTP overhead.`
    )
  }

  // Check for missing compression
  const uncompressedChunks = chunks.filter(chunk => chunk.sizeGzip > chunk.size * 0.8)
  if (uncompressedChunks.length > 0) {
    recommendations.push(
      `${uncompressedChunks.length} chunks have poor compression. Ensure gzip/brotli compression is enabled.`
    )
  }

  return recommendations
}

function outputCICDReport(report) {
  const { build, budgets, recommendations } = report

  // Group output for GitHub Actions
  console.log(logCommands.group('📊 Build Size Report'))

  console.log(`📦 **Total Size**: ${formatBytes(build.totalSize)} (${formatBytes(build.totalSizeGzip)} gzipped)`)
  console.log(`🏠 **Initial Bundle**: ${formatBytes(build.initialSize)}`)
  console.log(`📚 **Vendor Libraries**: ${formatBytes(build.vendorSize)}`)
  console.log(`📄 **Chunks**: ${build.chunks}`)
  console.log(`🖼️ **Static Assets**: ${build.staticAssets}`)
  console.log(`🏆 **Largest Chunk**: ${formatBytes(build.largestChunkSize)}`)

  console.log(logCommands.endGroup())

  // Budget checks
  console.log(logCommands.group('💰 Budget Checks'))

  budgets.forEach(budget => {
    const status = budget.passed ? '✅' : '❌'
    const color = budget.passed ? colors.green : colors.red
    const percentage = ((budget.size / budget.budget) * 100).toFixed(1)

    console.log(`${status} ${budget.name}: ${formatBytes(budget.size)} / ${formatBytes(budget.budget)} (${percentage}%)`)

    if (!budget.passed) {
      console.log(logCommands.error(`${budget.name} budget exceeded`))
    }
  })

  console.log(logCommands.endGroup())

  // Recommendations
  if (recommendations.length > 0) {
    console.log(logCommands.group('💡 Recommendations'))

    recommendations.forEach(rec => {
      console.log(logCommands.warning(rec))
    })

    console.log(logCommands.endGroup())
  }

  // Set outputs for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const output = [
      `total_size=${build.totalSize}`,
      `initial_size=${build.initialSize}`,
      `vendor_size=${build.vendorSize}`,
      `chunks_count=${build.chunks}`,
      `budgets_passed=${budgets.every(b => b.passed)}`
    ].join('\n')

    fs.appendFileSync(process.env.GITHUB_OUTPUT, output)
  }
}

// Compare with previous build (if available)
function compareWithPreviousBuild(currentReport) {
  const distDir = path.join(__dirname, '..', 'dist')
  const previousReportPath = path.join(distDir, 'build-report.previous.json')

  if (!fs.existsSync(previousReportPath)) {
    return null
  }

  try {
    const previousReport = JSON.parse(fs.readFileSync(previousReportPath, 'utf8'))

    return {
      totalSizeChange: currentReport.build.totalSize - previousReport.build.totalSize,
      initialSizeChange: currentReport.build.initialSize - previousReport.build.initialSize,
      chunksChange: currentReport.build.chunks - previousReport.build.chunks
    }
  } catch {
    return null
  }
}

// Save current report as previous for next build
function saveForComparison(report) {
  const distDir = path.join(__dirname, '..', 'dist')
  const reportPath = path.join(distDir, 'build-report.previous.json')

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
}

// Run analysis if called directly
if (require.main === module) {
  analyzeBuild()
}

module.exports = { analyzeBuild, formatBytes, BUDGETS }
