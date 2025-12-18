import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Server, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { api } from '../api/client'
import { Table, Badge } from '../components/Table'
import type { HostSummary } from '../types'
import styles from './Hosts.module.css'

export default function Hosts() {
  const navigate = useNavigate()
  
  const { data, isLoading } = useQuery({
    queryKey: ['hosts'],
    queryFn: api.getHosts,
  })
  
  const hosts = data?.hosts ?? []
  
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>All Hosts</h2>
          <p className={styles.subtitle}>
            {data?.total ?? 0} systems reporting to Snailbus
          </p>
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
        onRowClick={(host) => navigate(`/hosts/${host.hostname}`)}
        loading={isLoading}
        emptyMessage="No hosts have reported yet. Install snail-core on your systems to start collecting data."
      />
    </div>
  )
}

