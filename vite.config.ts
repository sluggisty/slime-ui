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