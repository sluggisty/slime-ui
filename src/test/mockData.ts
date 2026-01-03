import type {
  HostSummary,
  Report,
  ReportData,
  SystemData,
  HardwareData,
  NetworkData,
  PackagesData,
  ServicesData,
  FilesystemData,
  SecurityData,
  LogsData,
  User,
  LoginResponse,
  HealthResponse,
  HostsResponse,
} from '../types'

// Helper to generate UUIDs for testing
const generateTestUUID = (prefix: string, index: number = 1): string => {
  return `${prefix}-${index.toString().padStart(8, '0')}-0000-0000-0000-000000000000`
}

// Host Summary factories
export const createMockHostSummary = (overrides?: Partial<HostSummary>): HostSummary => ({
  host_id: generateTestUUID('host', 1),
  hostname: 'test-host-1',
  os_name: 'Fedora',
  os_version: '42',
  os_version_major: '42',
  os_version_minor: '0',
  os_version_patch: '0',
  last_seen: new Date().toISOString(),
  ...overrides,
})

export const createMockHostsArray = (count: number): HostSummary[] => {
  return Array.from({ length: count }, (_, i) =>
    createMockHostSummary({
      host_id: generateTestUUID('host', i + 1),
      hostname: `test-host-${i + 1}`,
      os_name: i % 2 === 0 ? 'Fedora' : 'Debian',
      os_version: `${40 + i}`,
    })
  )
}

// System Data factories
export const createMockSystemData = (overrides?: Partial<SystemData>): SystemData => ({
  os: {
    name: 'Fedora',
    id: 'fedora',
    version: '42',
    architecture: 'x86_64',
  },
  kernel: {
    release: '6.17.11-200.fc42.x86_64',
    version: '#1 SMP PREEMPT_DYNAMIC',
  },
  hostname: {
    hostname: 'test-host-1',
    fqdn: 'test-host-1.example.com',
  },
  uptime: {
    days: 5,
    hours: 12,
    minutes: 30,
    human_readable: '5 days, 12 hours, 30 minutes',
  },
  virtualization: {
    type: 'kvm',
    is_virtual: true,
  },
  ...overrides,
})

// Hardware Data factories
export const createMockHardwareData = (overrides?: Partial<HardwareData>): HardwareData => ({
  cpu: {
    model: 'Intel Core i7-9700K',
    physical_cores: 8,
    logical_cores: 16,
    load_average: {
      '1min': 0.5,
      '5min': 0.6,
      '15min': 0.55,
    },
  },
  memory: {
    total: 17179869184, // 16GB in bytes
    total_human: '16.0 GiB',
    used: 8589934592, // 8GB
    available: 8589934592, // 8GB
    percent_used: 50.0,
  },
  disks: {
    partitions: [
      {
        device: '/dev/sda1',
        mountpoint: '/',
        fstype: 'ext4',
        total_human: '500.0 GiB',
        percent_used: 45.0,
      },
    ],
  },
  ...overrides,
})

// Network Data factories
export const createMockNetworkData = (overrides?: Partial<NetworkData>): NetworkData => ({
  interfaces: [
    {
      name: 'eth0',
      mac: '00:11:22:33:44:55',
      is_up: true,
      addresses: [
        {
          type: 'ipv4',
          address: '192.168.1.100',
        },
        {
          type: 'ipv6',
          address: '2001:db8::1',
        },
      ],
    },
  ],
  dns: {
    nameservers: ['8.8.8.8', '8.8.4.4'],
  },
  ...overrides,
})

// Packages Data factories
export const createMockPackagesData = (overrides?: Partial<PackagesData>): PackagesData => ({
  summary: {
    total_count: 1234,
  },
  upgradeable: {
    count: 15,
    security_count: 3,
  },
  ...overrides,
})

// Services Data factories
export const createMockServicesData = (overrides?: Partial<ServicesData>): ServicesData => ({
  running_services: [
    {
      name: 'sshd.service',
      description: 'OpenSSH server daemon',
    },
    {
      name: 'docker.service',
      description: 'Docker Application Container Engine',
    },
  ],
  failed_units: [],
  ...overrides,
})

// Filesystem Data factories
export const createMockFilesystemData = (overrides?: Partial<FilesystemData>): FilesystemData => ({
  mounts: [
    {
      device: '/dev/sda1',
      mountpoint: '/',
      fstype: 'ext4',
      percent_used: 45.0,
    },
  ],
  ...overrides,
})

// Security Data factories
export const createMockSecurityData = (overrides?: Partial<SecurityData>): SecurityData => ({
  selinux: {
    enabled: true,
    mode: 'enforcing',
  },
  fips: {
    enabled: false,
  },
  ...overrides,
})

// Logs Data factories
export const createMockLogsData = (overrides?: Partial<LogsData>): LogsData => ({
  kernel_errors: [],
  service_failures: [],
  ...overrides,
})

// Report Data factories
export const createMockReportData = (overrides?: Partial<ReportData>): ReportData => ({
  system: createMockSystemData(),
  hardware: createMockHardwareData(),
  network: createMockNetworkData(),
  packages: createMockPackagesData(),
  services: createMockServicesData(),
  filesystem: createMockFilesystemData(),
  security: createMockSecurityData(),
  logs: createMockLogsData(),
  ...overrides,
})

// Report factories
export const createMockReport = (overrides?: Partial<Report>): Report => {
  const hostId = overrides?.meta?.host_id || generateTestUUID('host', 1)
  const hostname = overrides?.meta?.hostname || 'test-host-1'
  const timestamp = new Date().toISOString()

  return {
    id: generateTestUUID('report', 1),
    received_at: timestamp,
    meta: {
      host_id: hostId,
      hostname: hostname,
      collection_id: generateTestUUID('collection', 1),
      timestamp: timestamp,
      snail_version: '1.0.0',
      ...overrides?.meta,
    },
    data: createMockReportData(overrides?.data),
    errors: overrides?.errors,
  }
}

// User factories
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: generateTestUUID('user', 1),
  username: 'test-user-1',
  email: 'test-user-1@example.com',
  is_active: true,
  is_admin: false,
  org_id: generateTestUUID('org', 1),
  role: 'viewer',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

// Auth response factories
export const createMockLoginResponse = (overrides?: Partial<LoginResponse>): LoginResponse => ({
  user: createMockUser(overrides?.user),
  token: 'test-api-key-token-12345',
  ...overrides,
})

// API Response factories
export const createMockHealthResponse = (overrides?: Partial<HealthResponse>): HealthResponse => ({
  status: 'ok',
  service: 'operational',
  database: 'connected',
  ...overrides,
})

export const createMockHostsResponse = (overrides?: Partial<HostsResponse>): HostsResponse => {
  const hosts = overrides?.hosts || createMockHostsArray(3)
  return {
    hosts,
    total: hosts.length,
    ...overrides,
  }
}




