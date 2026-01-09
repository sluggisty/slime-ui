import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// Compression Plugin for production builds
function compressionPlugin(): Plugin {
  return {
    name: 'compression-plugin',
    generateBundle(options, bundle) {
      // This plugin would typically compress assets during build
      // For Vite, compression is usually handled by the server
      // But we can add compression hints to HTML
      Object.keys(bundle).forEach((fileName) => {
        const chunk = bundle[fileName]
        if (chunk.type === 'asset' && fileName.endsWith('.html')) {
          // Add preload hints for critical resources
          const html = chunk.source as string
          const modifiedHtml = addPreloadHints(html)
          chunk.source = modifiedHtml
        }
      })
    }
  }
}

// CSP Plugin for production builds
function cspPlugin(): Plugin {
  return {
    name: 'csp-plugin',
    transformIndexHtml(html) {
      // Only add CSP in production builds
      if (process.env.NODE_ENV !== 'production') {
        return html
      }

      // Generate a random nonce for this build
      const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

      // CSP directives for production
      const apiUrl = process.env.VITE_API_BASE_URL || 'http://localhost:8080'
      const cspDirectives = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        `connect-src 'self' ${apiUrl}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests"
      ]

      const cspHeader = cspDirectives.join('; ')

      // Add CSP meta tag and nonce to the HTML
      const modifiedHtml = html
        .replace(
          '<title>',
          `<meta http-equiv="Content-Security-Policy" content="${cspHeader}">\n    <title>`
        )
        .replace(
          '<script type="module" src="/src/main.tsx"></script>',
          `<script type="module" src="/src/main.tsx" nonce="${nonce}"></script>`
        )

      return modifiedHtml
    }
  }
}

// Add preload hints for critical resources
function addPreloadHints(html: string): string {
  // Add preload hints for critical CSS and JS
  const preloadHints = `
    <!-- Preload critical resources -->
    <link rel="preload" href="/assets/react-core-[hash].js" as="script" crossorigin>
    <link rel="preload" href="/assets/app-[hash].js" as="script" crossorigin>
    <link rel="preload" href="/assets/main-[hash].css" as="style">
    <link rel="dns-prefetch" href="//fonts.googleapis.com">
  `

  return html.replace(
    '<title>',
    `${preloadHints}\n    <title>`
  )
}

export default defineConfig({
  plugins: [
    react(),
    cspPlugin(),
    compressionPlugin()
  ],

  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
    // Enable HMR for better development experience
    hmr: {
      overlay: true
    }
  },

  build: {
    // Production optimizations
    minify: 'esbuild', // 'esbuild' | 'terser' - esbuild is faster
    sourcemap: process.env.NODE_ENV === 'development' ? 'inline' : 'hidden', // Hidden source maps for production error tracking

    // Target modern browsers for smaller bundles
    target: 'es2020', // Modern JS features for smaller output

    // CSS optimization
    cssCodeSplit: true, // Split CSS into separate chunks
    cssMinify: true, // Minify CSS

    // Asset optimization
    assetsInlineLimit: 4096, // Inline assets smaller than 4KB (base64)
    assetsDir: 'assets', // Output directory for assets

    // Bundle size limits and warnings
    chunkSizeWarningLimit: 600, // Warn for chunks > 600KB (increased for better UX)

    // Report compressed size
    reportCompressedSize: true,

    // Write options
    write: true,
    emptyOutDir: true,

    // Tree shaking and dead code elimination
    rollupOptions: {
      // External dependencies (none for client-side app)
      external: [],

      output: {
        // Content hashing for optimal caching
        entryFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop()?.replace(/\.[^/.]+$/, '')
            : 'entry'
          return `assets/${facadeModuleId}-[hash].js`
        },

        chunkFileNames: (chunkInfo) => {
          // Use manual chunk names when available, otherwise hash-based
          const name = chunkInfo.name || 'chunk'
          return `assets/${name}-[hash].js`
        },

        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || []
          const ext = info[info.length - 1]

          // Different naming strategies for different asset types
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name || '')) {
            return `assets/images/[name]-[hash][extname]`
          }

          if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name || '')) {
            return `assets/fonts/[name]-[hash][extname]`
          }

          if (ext === 'css') {
            return `assets/css/[name]-[hash][extname]`
          }

          return `assets/[name]-[hash][extname]`
        },

        // Optimize chunk splitting for production
        manualChunks: (id) => {
          // Core React libraries (most stable, cacheable)
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-core'
            }

            // React Query for data fetching
            if (id.includes('@tanstack/react-query')) {
              return 'react-query'
            }

            // UI libraries (frequently updated)
            if (id.includes('lucide-react') || id.includes('framer-motion')) {
              return 'ui-libs'
            }

            // Utility libraries (stable, reusable)
            if (id.includes('date-fns') || id.includes('clsx') || id.includes('lodash')) {
              return 'utils'
            }

            // HTTP clients and API utilities
            if (id.includes('axios') || id.includes('ky') || id.includes('ky-universal')) {
              return 'http-client'
            }

            // Other vendor libraries (catch-all)
            return 'vendor'
          }

          // Application code splitting
          if (id.includes('/src/')) {
            // Page components (route-based splitting)
            if (id.includes('/pages/')) {
              if (id.includes('Dashboard') || id.includes('Hosts') || id.includes('HostDetail')) {
                return 'pages-monitoring'
              }
              if (id.includes('Login') || id.includes('Register')) {
                return 'pages-auth'
              }
              if (id.includes('UserAccess')) {
                return 'pages-admin'
              }
              return 'pages-other'
            }

            // Component libraries
            if (id.includes('/components/')) {
              if (id.includes('HealthDashboard') || id.includes('ErrorExample')) {
                return 'components-heavy'
              }
              if (id.includes('Loading') || id.includes('Modal') || id.includes('Card')) {
                return 'components-ui'
              }
              return 'components-other'
            }

            // Utility modules
            if (id.includes('/utils/')) {
              if (id.includes('error') || id.includes('logger') || id.includes('healthCheck')) {
                return 'utils-monitoring'
              }
              if (id.includes('validation') || id.includes('bundleAnalysis')) {
                return 'utils-validation'
              }
              return 'utils-other'
            }

            // API and data layer
            if (id.includes('/api/')) {
              return 'api-layer'
            }

            // Context and state management
            if (id.includes('/contexts/') || id.includes('/hooks/')) {
              return 'state-management'
            }
          }

          // Fallback for any other modules
          return 'app'
        },

        // Additional optimizations
        compact: true, // Remove whitespace and comments
        generatedCode: {
          preset: 'es2015', // Generate ES2015+ code
          symbols: false, // Don't generate symbol names
        },

        // Plugin-specific optimizations
        plugins: [
          // Add bundle visualizer in analyze mode
          ...(process.env.ANALYZE === 'true' ? [
            visualizer({
              filename: 'dist/bundle-analysis.html',
              open: false,
              gzipSize: true,
              brotliSize: true,
              template: 'treemap' // 'sunburst' | 'treemap' | 'network'
            })
          ] : [])
        ]
      },

      // Tree shaking optimizations
      treeshake: {
        moduleSideEffects: false, // Assume no side effects
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false
      },

      // Minification options
      minifyInternalExports: true
    },

    // Dependency pre-bundling optimizations
    optimizeDeps: {
      // Pre-bundle these for faster dev server
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
        'lucide-react',
        'date-fns'
      ],

      // Exclude large libraries that should be lazy-loaded
      exclude: [
        // Charts and heavy visualizations
        'chart.js',
        'd3',
        'three.js',

        // Large utility libraries
        'lodash-es',

        // Conditional dependencies
        'framer-motion'
      ]
    },

    // Module preloading
    modulePreload: {
      polyfill: false // Disable polyfill preloading for smaller bundles
    },

    // Watch options (for development)
    watch: process.env.NODE_ENV === 'development' ? {
      include: ['src/**'],
      exclude: ['node_modules/**', 'dist/**']
    } : undefined
  },

  // Dependency pre-bundling optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'lucide-react',
      'date-fns'
    ],
    exclude: [
      // Exclude large libraries that should be lazy loaded
      'chart.js',
      'd3',
      'three.js'
    ]
  },

  // Enable esbuild for faster builds
  esbuild: {
    // Remove console.log in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],

    // Target modern JS for smaller bundles
    target: 'es2020',

    // Minify identifiers in production
    minifyIdentifiers: process.env.NODE_ENV === 'production',

    // Remove whitespace in production
    minifyWhitespace: process.env.NODE_ENV === 'production'
  }
})