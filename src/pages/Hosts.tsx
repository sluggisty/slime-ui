import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Server, Clock, Filter } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { api } from '../api/client'
import { Table, Badge } from '../components/Table'
import type { HostSummary } from '../types'
import styles from './Hosts.module.css'

export default function Hosts() {
  const navigate = useNavigate()
  const [selectedDistro, setSelectedDistro] = useState<string>('all')
  
  const { data, isLoading } = useQuery({
    queryKey: ['hosts'],
    queryFn: api.getHosts,
  })
  
  const allHosts = data?.hosts ?? []
  
  // Get unique distributions for filter dropdown
  const distributions = useMemo(() => {
    const distros = new Set<string>()
    allHosts.forEach(host => {
      if (host.os_name) {
        distros.add(host.os_name)
      }
    })
    return Array.from(distros).sort()
  }, [allHosts])
  
  // Filter hosts by selected distribution
  const hosts = useMemo(() => {
    if (selectedDistro === 'all') {
      return allHosts
    }
    return allHosts.filter(host => host.os_name === selectedDistro)
  }, [allHosts, selectedDistro])
  
  // Format OS display string
  const formatOS = (host: HostSummary) => {
    if (!host.os_name) {
      return <span className={styles.unknownOS}>Unknown</span>
    }
    const version = host.os_version ? ` ${host.os_version}` : ''
    return `${host.os_name}${version}`
  }
  
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>All Hosts</h2>
          <p className={styles.subtitle}>
            {selectedDistro === 'all' 
              ? `${data?.total ?? 0} systems reporting to Snailbus`
              : `${hosts.length} of ${data?.total ?? 0} systems (${selectedDistro})`
            }
          </p>
        </div>
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <Filter size={16} />
            <label htmlFor="distro-filter" className={styles.filterLabel}>
              Distribution:
            </label>
            <select
              id="distro-filter"
              value={selectedDistro}
              onChange={(e) => setSelectedDistro(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Distributions</option>
              {distributions.map(distro => (
                <option key={distro} value={distro}>
                  {distro}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      <Table
        columns={[
          {
            key: 'hostname',
            header: 'Hostname',
            render: (host: HostSummary) => (
              <div className={styles.hostCell}>
                <div className={styles.hostIcon}>
                  <Server size={18} />
                </div>
                <span className={styles.hostname}>{host.hostname}</span>
              </div>
            ),
          },
          {
            key: 'os',
            header: 'Distribution',
            render: (host: HostSummary) => (
              <div className={styles.osCell}>
                {formatOS(host)}
              </div>
            ),
          },
          {
            key: 'last_seen',
            header: 'Last Updated',
            render: (host: HostSummary) => (
              <div className={styles.lastSeen}>
                <Clock size={14} />
                <span>
                  {formatDistanceToNow(new Date(host.last_seen), { addSuffix: true })}
                </span>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (host: HostSummary) => {
              const lastSeen = new Date(host.last_seen)
              const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
              const isActive = lastSeen > hourAgo
              return (
                <Badge variant={isActive ? 'success' : 'warning'}>
                  {isActive ? 'Active' : 'Stale'}
                </Badge>
              )
            },
          },
        ]}
        data={hosts}
        onRowClick={(host) => navigate(`/hosts/${host.host_id}`)}
        loading={isLoading}
        emptyMessage={
          selectedDistro === 'all'
            ? "No hosts have reported yet. Install snail-core on your systems to start collecting data."
            : `No hosts found with distribution "${selectedDistro}".`
        }
      />
    </div>
  )
}

