import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  ArrowLeft, Server, Cpu, Network, Package, 
  Settings, Shield, Clock, AlertTriangle,
  ChevronDown, ChevronRight, HardDrive
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { api } from '../api/client'
import { Card } from '../components/Card'
import { Badge } from '../components/Table'
import styles from './HostDetail.module.css'

function DataItem({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className={styles.dataItem}>
      <span className={styles.dataLabel}>{label}</span>
      <span className={styles.dataValue}>{String(value)}</span>
    </div>
  )
}

function CollapsibleSection({ 
  title, 
  icon, 
  children 
}: { 
  title: string
  icon: React.ReactNode
  children: React.ReactNode 
}) {
  const [isOpen, setIsOpen] = useState(true)
  
  return (
    <Card className={styles.section}>
      <div className={styles.sectionHeader} onClick={() => setIsOpen(!isOpen)}>
        <div className={styles.sectionTitle}>
          {icon}
          <h3>{title}</h3>
        </div>
        {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </div>
      {isOpen && <div className={styles.sectionContent}>{children}</div>}
    </Card>
  )
}

export default function HostDetail() {
  const { host_id } = useParams<{ host_id: string }>()
  const navigate = useNavigate()
  
  const { data: report, isLoading, error } = useQuery({
    queryKey: ['host', host_id],
    queryFn: () => api.getHost(host_id!),
    enabled: !!host_id,
  })
  
  if (isLoading) {
    return <div className={styles.loading}>Loading host data...</div>
  }
  
  if (error || !report) {
    return <div className={styles.error}>Host not found</div>
  }
  
  const { meta, data, errors } = report
  
  // Parse JSON data
  let parsedData: any = {}
  try {
    if (typeof data === 'string') {
      parsedData = JSON.parse(data)
    } else {
      parsedData = data
    }
  } catch (e) {
    console.error('Failed to parse data:', e)
  }
  
  const system = parsedData?.system
  const hardware = parsedData?.hardware
  const network = parsedData?.network
  const packages = parsedData?.packages
  const services = parsedData?.services
  const filesystem = parsedData?.filesystem
  const security = parsedData?.security
  
  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate('/hosts')}>
        <ArrowLeft size={18} />
        <span>Back to Hosts</span>
      </button>
      
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <Server size={28} />
        </div>
        <div className={styles.headerInfo}>
          <h1>{meta.hostname}</h1>
          <div className={styles.headerMeta}>
            <Badge variant={errors?.length ? 'warning' : 'success'}>
              {errors?.length ? `${errors.length} Errors` : 'OK'}
            </Badge>
            <span className={styles.timestamp}>
              <Clock size={14} />
              Last updated {formatDistanceToNow(new Date(report.received_at), { addSuffix: true })}
            </span>
            <span className={styles.collectionTime}>
              Collected {format(new Date(meta.timestamp), 'MMM d, yyyy HH:mm')}
            </span>
          </div>
        </div>
      </div>
      
      {/* Errors Section */}
      {errors && errors.length > 0 && (
        <Card className={styles.errorsCard}>
          <h3><AlertTriangle size={18} /> Collection Errors</h3>
          <ul className={styles.errorsList}>
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </Card>
      )}
      
      <div className={styles.grid}>
        {/* System Info */}
        {system && (
          <CollapsibleSection title="System" icon={<Server size={18} />}>
            <div className={styles.dataGrid}>
              <DataItem label="OS" value={system.os?.name} />
              <DataItem label="Version" value={system.os?.version} />
              <DataItem label="Architecture" value={system.os?.architecture} />
              <DataItem label="Kernel" value={system.kernel?.release} />
              <DataItem label="Hostname" value={system.hostname?.hostname} />
              <DataItem label="FQDN" value={system.hostname?.fqdn} />
              <DataItem label="Uptime" value={system.uptime?.human_readable} />
              <DataItem 
                label="Virtualization" 
                value={system.virtualization?.is_virtual ? system.virtualization.type : 'Physical'} 
              />
            </div>
          </CollapsibleSection>
        )}
        
        {/* Hardware */}
        {hardware && (
          <CollapsibleSection title="Hardware" icon={<Cpu size={18} />}>
            <div className={styles.dataGrid}>
              <DataItem label="CPU Model" value={hardware.cpu?.model} />
              <DataItem label="Physical Cores" value={hardware.cpu?.physical_cores} />
              <DataItem label="Logical Cores" value={hardware.cpu?.logical_cores} />
              <DataItem label="Memory Total" value={hardware.memory?.total_human} />
              <DataItem label="Memory Used" value={hardware.memory?.percent_used ? `${hardware.memory.percent_used.toFixed(1)}%` : undefined} />
              {hardware.cpu?.load_average && (
                <>
                  <DataItem label="Load (1min)" value={hardware.cpu.load_average['1min']?.toFixed(2)} />
                  <DataItem label="Load (5min)" value={hardware.cpu.load_average['5min']?.toFixed(2)} />
                  <DataItem label="Load (15min)" value={hardware.cpu.load_average['15min']?.toFixed(2)} />
                </>
              )}
            </div>
          </CollapsibleSection>
        )}
        
        {/* Network */}
        {network && network.interfaces && network.interfaces.length > 0 && (
          <CollapsibleSection title="Network" icon={<Network size={18} />}>
            <div className={styles.interfacesList}>
              {network.interfaces.map((iface: any, i: number) => (
                <div key={i} className={styles.interface}>
                  <div className={styles.interfaceHeader}>
                    <span className={styles.interfaceName}>{iface.name}</span>
                    <Badge variant={iface.is_up ? 'success' : 'error'}>
                      {iface.is_up ? 'UP' : 'DOWN'}
                    </Badge>
                  </div>
                  {iface.mac && <DataItem label="MAC" value={iface.mac} />}
                  {iface.addresses && iface.addresses.length > 0 && (
                    <div className={styles.addresses}>
                      {iface.addresses.map((addr: any, j: number) => (
                        <DataItem key={j} label={addr.type} value={addr.address} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {network.dns?.nameservers && network.dns.nameservers.length > 0 && (
              <div className={styles.dns}>
                <h4>DNS Servers</h4>
                <ul>
                  {network.dns.nameservers.map((ns: string, i: number) => (
                    <li key={i}>{ns}</li>
                  ))}
                </ul>
              </div>
            )}
          </CollapsibleSection>
        )}
        
        {/* Packages */}
        {packages && (
          <CollapsibleSection title="Packages" icon={<Package size={18} />}>
            <div className={styles.dataGrid}>
              <DataItem label="Total Packages" value={packages.summary?.total_count} />
              <DataItem label="Upgradeable" value={packages.upgradeable?.count} />
              <DataItem label="Security Updates" value={packages.upgradeable?.security_count} />
            </div>
          </CollapsibleSection>
        )}
        
        {/* Services */}
        {services && (
          <CollapsibleSection title="Services" icon={<Settings size={18} />}>
            {services.running_services && services.running_services.length > 0 && (
              <div>
                <h4>Running Services ({services.running_services.length})</h4>
                <ul className={styles.serviceList}>
                  {services.running_services.slice(0, 20).map((svc: any, i: number) => (
                    <li key={i}>{svc.name}</li>
                  ))}
                </ul>
              </div>
            )}
            {services.failed_units && services.failed_units.length > 0 && (
              <div className={styles.failedServices}>
                <h4>Failed Units ({services.failed_units.length})</h4>
                <ul className={styles.serviceList}>
                  {services.failed_units.map((unit: any, i: number) => (
                    <li key={i} className={styles.failed}>{unit.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </CollapsibleSection>
        )}
        
        {/* Filesystem */}
        {filesystem && filesystem.mounts && filesystem.mounts.length > 0 && (
          <CollapsibleSection title="Filesystem" icon={<HardDrive size={18} />}>
            <div className={styles.mountsList}>
              {filesystem.mounts.map((mount: any, i: number) => (
                <div key={i} className={styles.mount}>
                  <div className={styles.mountHeader}>
                    <span className={styles.mountDevice}>{mount.device}</span>
                    {mount.percent_used !== undefined && (
                      <Badge variant={mount.percent_used > 90 ? 'error' : mount.percent_used > 80 ? 'warning' : 'success'}>
                        {mount.percent_used.toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                  <DataItem label="Mountpoint" value={mount.mountpoint} />
                  <DataItem label="Type" value={mount.fstype} />
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
        
        {/* Security */}
        {security && (
          <CollapsibleSection title="Security" icon={<Shield size={18} />}>
            <div className={styles.dataGrid}>
              <DataItem 
                label="SELinux" 
                value={security.selinux?.enabled ? `${security.selinux.mode || 'enabled'}` : 'Disabled'} 
              />
              <DataItem 
                label="FIPS" 
                value={security.fips?.enabled ? 'Enabled' : 'Disabled'} 
              />
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  )
}

