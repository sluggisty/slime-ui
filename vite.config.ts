import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

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

export default defineConfig({
  plugins: [
    react(),
    cspPlugin()
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Optimize chunk splitting for better caching and loading
    rollupOptions: {
      output: {
        // Ensure consistent chunk naming for CSP
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',

        // Optimize chunk splitting
        manualChunks: (id) => {
          // Vendor chunk for React and core libraries
          if (id.includes('node_modules')) {
            // React ecosystem in one chunk
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor'
            }

            // UI libraries
            if (id.includes('lucide-react') || id.includes('@radix-ui') || id.includes('framer-motion')) {
              return 'ui-vendor'
            }

            // Utility libraries
            if (id.includes('lodash') || id.includes('date-fns') || id.includes('clsx')) {
              return 'utils-vendor'
            }

            // HTTP and API libraries
            if (id.includes('axios') || id.includes('ky') || id.includes('@tanstack/react-query')) {
              return 'api-vendor'
            }

            // Other node_modules in a catch-all vendor chunk
            return 'vendor'
          }

          // Feature-based code splitting for pages
          if (id.includes('/pages/')) {
            // Group related pages
            if (id.includes('/pages/Dashboard') || id.includes('/pages/Hosts') || id.includes('/pages/HostDetail')) {
              return 'monitoring-pages'
            }

            if (id.includes('/pages/Login') || id.includes('/pages/Register')) {
              return 'auth-pages'
            }

            if (id.includes('/pages/UserAccess')) {
              return 'admin-pages'
            }
          }

          // Component chunks for heavy components
          if (id.includes('/components/HealthDashboard') ||
              id.includes('/components/ErrorExample')) {
            return 'heavy-components'
          }

          // Utility chunks
          if (id.includes('/utils/') && (
            id.includes('errorHandler') ||
            id.includes('errorLogger') ||
            id.includes('healthCheck')
          )) {
            return 'error-monitoring'
          }

          if (id.includes('/utils/') && (
            id.includes('validation') ||
            id.includes('bundleAnalysis')
          )) {
            return 'validation-utils'
          }
        },

        // Optimize chunk size limits
        experimentalMinChunkSize: 1000, // 1KB minimum (very small for better splitting)

        // Generate source maps for debugging (only in development)
        sourcemap: process.env.NODE_ENV === 'development'
      },

      // External dependencies that shouldn't be bundled
      external: process.env.NODE_ENV === 'production' ? [] : []
    },

    // Optimize bundle size
    minify: 'esbuild',
    sourcemap: process.env.NODE_ENV === 'development',

    // Chunk size warnings
    chunkSizeWarningLimit: 1000, // Warn for chunks > 1000KB

    // CSS code splitting
    cssCodeSplit: true,

    // Asset optimization
    assetsInlineLimit: 4096, // Inline assets < 4KB

    // Target modern browsers for smaller bundles
    target: 'esnext',

    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/]
    }
  },

  // Optimize development server
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



