#!/usr/bin/env node

/**
 * Bundle Analysis Script
 *
 * Analyzes the built bundle and generates recommendations for code splitting
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function analyzeBundle() {
  console.log(`${colors.cyan}${colors.bright}🔍 Analyzing bundle...${colors.reset}\n`);

  const distDir = path.join(__dirname, '..', 'dist');
  const assetsDir = path.join(distDir, 'assets');

  if (!fs.existsSync(assetsDir)) {
    console.log(
      `${colors.red}❌ No dist/assets directory found. Run 'npm run build' first.${colors.reset}`
    );
    return;
  }

  // Read all asset files
  const files = fs.readdirSync(assetsDir);
  const assets = [];

  files.forEach(file => {
    const filePath = path.join(assetsDir, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile()) {
      const ext = path.extname(file);
      const size = stats.size;
      const sizeGzip = estimateGzipSize(size, ext);

      assets.push({
        name: file,
        path: filePath,
        size,
        sizeGzip,
        type: getAssetType(ext),
        isChunk: file.includes('-') && (ext === '.js' || ext === '.css'),
      });
    }
  });

  // Separate chunks and assets
  const chunks = assets.filter(asset => asset.isChunk);
  const staticAssets = assets.filter(asset => !asset.isChunk);

  // Calculate totals
  const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);
  const totalSizeGzip = assets.reduce((sum, asset) => sum + asset.sizeGzip, 0);

  // Display summary
  console.log(`${colors.blue}${colors.bright}📊 Bundle Analysis Summary${colors.reset}`);
  console.log('='.repeat(50));
  console.log(`Total Files: ${assets.length}`);
  console.log(`Total Size: ${formatBytes(totalSize)}`);
  console.log(`Gzipped Size: ${formatBytes(totalSizeGzip)}`);
  console.log(`Chunks: ${chunks.length}`);
  console.log(`Static Assets: ${staticAssets.length}`);
  console.log('');

  // Analyze chunks
  if (chunks.length > 0) {
    console.log(`${colors.green}${colors.bright}📦 Code Chunks${colors.reset}`);
    console.log('-'.repeat(30));

    chunks
      .sort((a, b) => b.size - a.size)
      .forEach((chunk, index) => {
        const color = getChunkColor(chunk.size);
        const percentage = ((chunk.size / totalSize) * 100).toFixed(1);

        console.log(`${color}${index + 1}. ${chunk.name}${colors.reset}`);
        console.log(`   Size: ${formatBytes(chunk.size)} (${percentage}%)`);
        console.log(`   Gzipped: ${formatBytes(chunk.sizeGzip)}`);
        console.log(`   Type: ${chunk.type}`);
        console.log('');
      });
  }

  // Generate recommendations
  const recommendations = generateRecommendations(chunks, totalSize);

  if (recommendations.length > 0) {
    console.log(`${colors.yellow}${colors.bright}💡 Recommendations${colors.reset}`);
    console.log('-'.repeat(30));

    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    console.log('');
  }

  // Save detailed report
  const report = generateDetailedReport(assets, chunks, staticAssets, recommendations);
  const reportPath = path.join(distDir, 'bundle-analysis.json');

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`${colors.green}✅ Detailed report saved to: ${reportPath}${colors.reset}`);
}

function getAssetType(ext) {
  switch (ext) {
    case '.js':
      return 'JavaScript';
    case '.css':
      return 'CSS';
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.gif':
    case '.svg':
    case '.webp':
      return 'Image';
    case '.woff':
    case '.woff2':
    case '.ttf':
    case '.eot':
      return 'Font';
    case '.json':
      return 'Data';
    default:
      return 'Other';
  }
}

function estimateGzipSize(size, ext) {
  // Rough estimation of gzip compression ratios
  const ratios = {
    '.js': 0.3, // JavaScript compresses well
    '.css': 0.4, // CSS compresses well
    '.html': 0.5, // HTML compresses moderately
    '.json': 0.6, // JSON compresses moderately
    '.png': 0.95, // PNG images don't compress much
    '.jpg': 0.98, // JPEG images don't compress much
    '.svg': 0.2, // SVG compresses very well
    '.woff': 0.8, // Fonts compress moderately
    '.woff2': 0.9, // WOFF2 is already compressed
  };

  const ratio = ratios[ext] || 0.7; // Default 70% compression
  return Math.round(size * ratio);
}

function getChunkColor(size) {
  if (size > 1000000) return colors.red; // > 1MB - concerning
  if (size > 500000) return colors.yellow; // > 500KB - warning
  if (size > 100000) return colors.blue; // > 100KB - normal
  return colors.green; // < 100KB - good
}

function generateRecommendations(chunks, totalSize) {
  const recommendations = [];

  // Check total bundle size
  if (totalSize > 2000000) {
    // > 2MB
    recommendations.push(
      `Total bundle size (${formatBytes(totalSize)}) is large. Consider implementing more aggressive code splitting.`
    );
  }

  // Check for large chunks
  const largeChunks = chunks.filter(chunk => chunk.size > 500000); // > 500KB
  largeChunks.forEach(chunk => {
    if (chunk.name.includes('vendor')) {
      recommendations.push(
        `Large vendor chunk "${chunk.name}" (${formatBytes(chunk.size)}). Consider splitting large third-party libraries.`
      );
    } else if (chunk.name.includes('pages')) {
      recommendations.push(
        `Large pages chunk "${chunk.name}" (${formatBytes(chunk.size)}). Consider route-based code splitting.`
      );
    } else {
      recommendations.push(
        `Large chunk "${chunk.name}" (${formatBytes(chunk.size)}). Consider lazy loading or further splitting.`
      );
    }
  });

  // Check for too many small chunks
  const smallChunks = chunks.filter(chunk => chunk.size < 10000); // < 10KB
  if (smallChunks.length > 5) {
    recommendations.push(
      `${smallChunks.length} small chunks detected. Consider consolidating to reduce HTTP overhead.`
    );
  }

  // Check for missing code splitting
  const hasDynamicImports = chunks.some(
    chunk => chunk.name.includes('lazy') || chunk.name.includes('async')
  );
  if (!hasDynamicImports && chunks.length < 3) {
    recommendations.push(
      'No dynamic imports detected. Consider implementing route-based code splitting for better performance.'
    );
  }

  // Check for inefficient chunking
  const jsChunks = chunks.filter(chunk => chunk.type === 'JavaScript');
  if (jsChunks.length > 10) {
    recommendations.push(
      `High number of JavaScript chunks (${jsChunks.length}). Consider optimizing chunk splitting strategy.`
    );
  }

  return recommendations;
}

function generateDetailedReport(assets, chunks, staticAssets, recommendations) {
  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: assets.length,
      totalSize: assets.reduce((sum, asset) => sum + asset.size, 0),
      totalSizeGzip: assets.reduce((sum, asset) => sum + asset.sizeGzip, 0),
      chunks: chunks.length,
      staticAssets: staticAssets.length,
    },
    chunks: chunks.map(chunk => ({
      name: chunk.name,
      size: chunk.size,
      sizeGzip: chunk.sizeGzip,
      type: chunk.type,
    })),
    staticAssets: staticAssets.map(asset => ({
      name: asset.name,
      size: asset.size,
      sizeGzip: asset.sizeGzip,
      type: asset.type,
    })),
    recommendations,
    metadata: {
      nodeVersion: process.version,
      platform: process.platform,
      buildTime: new Date().toISOString(),
    },
  };
}

// Run analysis if called directly
if (require.main === module) {
  analyzeBundle();
}

module.exports = { analyzeBundle, formatBytes };
