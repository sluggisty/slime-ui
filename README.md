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

## License

MIT
