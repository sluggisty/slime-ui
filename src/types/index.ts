export interface ReportMeta {
  host_id: string  // Persistent UUID identifier
  hostname: string
  collection_id: string
  timestamp: string
  snail_version: string
}

export interface Report {
  id: string
  received_at: string
  meta: ReportMeta
  data: ReportData
  errors?: string[]
}

export interface HostSummary {
  host_id: string  // Persistent UUID
  hostname: string // Current hostname (may change)
  os_name?: string  // Linux distribution name (e.g., "Fedora", "Debian")
  os_version?: string // OS version (full version string, e.g., "42", "12.2", "22.04")
  os_version_major?: string // Major version number
  os_version_minor?: string // Minor version number
  os_version_patch?: string // Patch version number
  last_seen: string
}

export interface ReportData {
  system?: SystemData
  hardware?: HardwareData
  network?: NetworkData
  packages?: PackagesData
  services?: ServicesData
  filesystem?: FilesystemData
  security?: SecurityData
  logs?: LogsData
}

export interface SystemData {
  os?: {
    name?: string
    id?: string
    version?: string
    architecture?: string
  }
  kernel?: {
    release?: string
    version?: string
  }
  hostname?: {
    hostname?: string
    fqdn?: string
  }
  uptime?: {
    days?: number
    hours?: number
    minutes?: number
    human_readable?: string
  }
  virtualization?: {
    type?: string
    is_virtual?: boolean
  }
}

export interface HardwareData {
  cpu?: {
    model?: string
    physical_cores?: number
    logical_cores?: number
    load_average?: {
      '1min'?: number
      '5min'?: number
      '15min'?: number
    }
  }
  memory?: {
    total?: number
    total_human?: string
    used?: number
    available?: number
    percent_used?: number
  }
  disks?: {
    partitions?: Array<{
      device?: string
      mountpoint?: string
      fstype?: string
      total_human?: string
      percent_used?: number
    }>
  }
}

export interface NetworkData {
  interfaces?: Array<{
    name?: string
    mac?: string
    is_up?: boolean
    addresses?: Array<{
      type?: string
      address?: string
    }>
  }>
  dns?: {
    nameservers?: string[]
  }
}

export interface PackagesData {
  summary?: {
    total_count?: number
  }
  upgradeable?: {
    count?: number
    security_count?: number
  }
}

export interface ServicesData {
  running_services?: Array<{
    name?: string
    description?: string
  }>
  failed_units?: Array<{
    name?: string
    description?: string
  }>
}

export interface FilesystemData {
  mounts?: Array<{
    device?: string
    mountpoint?: string
    fstype?: string
    percent_used?: number
  }>
}

export interface SecurityData {
  selinux?: {
    enabled?: boolean
    mode?: string
  }
  fips?: {
    enabled?: boolean
  }
}

export interface LogsData {
  kernel_errors?: Array<{
    timestamp?: string
    message?: string
  }>
  service_failures?: Array<{
    unit?: string
    message?: string
  }>
}

export interface HostsResponse {
  hosts: HostSummary[]
  total: number
}

export interface HealthResponse {
  status: string
  service: string
  database: string
}

// Auth types
export interface User {
  id: string
  username: string
  email: string
  is_active: boolean
  is_admin: boolean
  org_id: string
  role: 'admin' | 'editor' | 'viewer'
  created_at: string
  updated_at: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  org_name: string
}

export interface LoginResponse {
  user: User
  token: string // API key
}

export interface APIKey {
  id: string
  user_id: string
  name: string
  last_used_at?: string
  expires_at?: string
  created_at: string
}

export interface CreateAPIKeyRequest {
  name: string
  expires_at?: string
}

export interface CreateAPIKeyResponse {
  id: string
  key: string // Plain key, shown only once
  name: string
  expires_at?: string
  created_at: string
}

export interface CreateUserRequest {
  username: string
  email: string
  password: string
  role: 'admin' | 'editor' | 'viewer'
}

export interface UpdateUserRoleRequest {
  role: 'admin' | 'editor' | 'viewer'
}

