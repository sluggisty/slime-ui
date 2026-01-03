# Content Security Policy (CSP) Configuration

This document describes the Content Security Policy implementation for the Slime UI application.

## Overview

Content Security Policy (CSP) is a security standard that helps prevent cross-site scripting (XSS), clickjacking, and other code injection attacks by specifying which sources of content are allowed to be loaded and executed.

## Implementation

### Build-Time CSP Injection

CSP headers are automatically injected into the production build using a Vite plugin (`vite.config.ts`). The plugin:

1. **Generates a random nonce** for each build to allow specific scripts
2. **Adds CSP meta tag** to the HTML head in production builds
3. **Applies nonce to script tags** to allow execution
4. **Configures appropriate directives** for the application's needs

### CSP Directives

The following CSP directives are applied in production:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random-nonce}' https://fonts.googleapis.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' {API_BASE_URL};
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests
```

### Directive Explanations

| Directive | Allowed Sources | Purpose |
|-----------|----------------|---------|
| `default-src 'self'` | Same origin only | Fallback for other directives |
| `script-src` | Self + Google Fonts + nonce | Allow scripts from same origin and Google Fonts API |
| `style-src` | Self + inline styles + Google Fonts | Allow styles from same origin and Google services |
| `font-src` | Self + Google Fonts | Allow fonts from Google Fonts |
| `img-src` | Self + data URIs + HTTPS | Allow images from same origin and secure sources |
| `connect-src` | Self + API server | Allow API connections to backend |
| `object-src 'none'` | None | Block all plugins/embed/object elements |
| `base-uri 'self'` | Same origin | Restrict base URL changes |
| `form-action 'self'` | Same origin | Restrict form submissions |
| `frame-ancestors 'none'` | None | Prevent embedding in frames |
| `upgrade-insecure-requests` | - | Force HTTPS upgrades |

## Development vs Production

### Development Mode
- **No CSP restrictions** to allow development tools and hot reloading
- Scripts can be loaded from localhost with eval permissions
- More permissive for development workflow

### Production Mode
- **Strict CSP enforcement** with nonce-based script execution
- Only allows explicitly permitted sources
- Blocks inline scripts and styles (except for fonts)

## Security Benefits

1. **XSS Prevention**: Blocks inline scripts and restricts script sources
2. **Data Exfiltration Prevention**: Limits connect-src to trusted domains
3. **Clickjacking Prevention**: frame-ancestors 'none' blocks iframe embedding
4. **Protocol Downgrade Prevention**: upgrade-insecure-requests forces HTTPS

## Configuration

### Environment Variables

The CSP configuration automatically adapts to your environment:

- `VITE_API_BASE_URL`: Automatically included in `connect-src` directive
- `NODE_ENV`: Determines whether to apply strict CSP (production only)

### Customization

To modify CSP directives, update the `cspPlugin` function in `vite.config.ts`:

```typescript
// Example: Add additional allowed domains
const cspDirectives = [
  // ... existing directives
  `script-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com https://cdn.example.com`,
  // ... more directives
]
```

## Testing CSP

### Manual Testing

1. **Build for production**: `npm run build -- --mode production`
2. **Serve the built files**: Use a local server to serve `dist/`
3. **Check browser console**: Look for CSP violation reports
4. **Test functionality**: Ensure all features work with CSP restrictions

### CSP Violation Reports

Configure a report URI to receive CSP violation reports:

```javascript
// Add to CSP directives
"report-uri /csp-report-endpoint"
```

## Troubleshooting

### Common Issues

1. **Fonts not loading**: Ensure `font-src` includes Google Fonts domains
2. **API calls blocked**: Verify `connect-src` includes your API domain
3. **Styles broken**: Check that `style-src` allows necessary sources
4. **Scripts blocked**: Ensure scripts use the injected nonce

### Debug Mode

For debugging CSP issues, temporarily modify the CSP plugin to log violations:

```typescript
// Add report-uri to CSP directives
const cspDirectives = [
  // ... existing directives
  "report-uri /csp-violation-report"
]
```

## Server-Side Headers

For server deployments (nginx, Apache, etc.), ensure CSP headers are also set at the server level as a backup to the meta tag approach.

Example nginx configuration:
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://fonts.googleapis.com; ..." always;
```

## Compliance

This CSP configuration follows OWASP CSP best practices:

- Uses nonce-based CSP for dynamic content
- Implements defense-in-depth with multiple security headers
- Restricts sources to minimum required
- Includes upgrade-insecure-requests for HTTPS enforcement

## References

- [OWASP Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [MDN CSP Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
