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
    rollupOptions: {
      output: {
        // Ensure consistent chunk naming for CSP
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
})



