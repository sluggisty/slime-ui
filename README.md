# Slime UI
![Slime UI Logo](slime-ui.png)

A modern React dashboard for visualizing system information collected by snail-core and stored in snailbus.

## Features

- **Dashboard**: Overview of all hosts with key statistics
- **Hosts List**: View all systems reporting to snailbus
- **Host Details**: Detailed view of system information for each host
- **Real-time Updates**: Automatic data refresh
- **Modern UI**: Dark theme with slime-green accents

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Router** for navigation
- **TanStack Query** for data fetching and caching
- **Lucide React** for icons
- **date-fns** for date formatting
- **CSS Modules** for styling

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- snailbus API running on `http://localhost:8080`

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The UI will be available at `http://localhost:3000`

### Building for Production

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Configuration

The API endpoint is configured in `vite.config.ts`. By default, it proxies `/api` requests to `http://localhost:8080`. You can change this by modifying the proxy target:

```typescript
proxy: {
  '/api': {
    target: 'http://your-snailbus-server:8080',
    changeOrigin: true,
  },
}
```

## Project Structure

```
slime-ui/
├── src/
│   ├── api/           # API client
│   ├── components/    # Reusable components
│   ├── pages/         # Page components
│   ├── types/         # TypeScript types
│   ├── App.tsx        # Main app component
│   ├── main.tsx       # Entry point
│   └── index.css      # Global styles
├── public/            # Static assets
└── package.json       # Dependencies
```

## API Endpoints Used

- `GET /api/v1/health` - Health check
- `GET /api/v1/hosts` - List all hosts
- `GET /api/v1/hosts/:hostname` - Get host details
- `DELETE /api/v1/hosts/:hostname` - Delete a host

## Testing

### Unit and Integration Tests

Run unit and integration tests with Vitest:

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### End-to-End Tests

E2E tests use Playwright and require **both** the frontend dev server and the backend API to be running:

1. **Start the backend API server** (snailbus) on `http://localhost:8080`
2. **Run the E2E tests** (Playwright will automatically start the frontend dev server):

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI mode
npm run test:e2e:ui

# Run E2E tests in debug mode
npm run test:e2e:debug

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed

# View last test report
npm run test:e2e:report
```

**Important:** The backend API server must be running before running E2E tests. If you see `ECONNREFUSED` errors, ensure the snailbus API is running on port 8080.

## License

MIT
