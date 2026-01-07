import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Server, Clock, Filter, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { api } from '../api/client'
import { Table, Badge } from '../components/Table'
import { Modal } from '../components/Modal'
import { SafeValue, TruncatedText } from '../components/SafeText'
import type { HostSummary } from '../types'
import styles from './Hosts.module.css'

export default function Hosts() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedDistro, setSelectedDistro] = useState<string>('all')
  const [selectedMajorVersion, setSelectedMajorVersion] = useState<string>('all')
  const [selectedMinorVersion, setSelectedMinorVersion] = useState<string>('all')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [hostToDelete, setHostToDelete] = useState<HostSummary | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const { data, isLoading } = useQuery({
    queryKey: ['hosts'],
    queryFn: api.getHosts,
  })
  
  // Get unique distributions for filter dropdown
  const distributions = useMemo(() => {
    const allHosts = data?.hosts ?? []
    const distros = new Set<string>()
    allHosts.forEach(host => {
      if (host.os_name) {
        distros.add(host.os_name)
      }
    })
    return Array.from(distros).sort()
  }, [data?.hosts])
  
  // Get unique major versions for selected distribution
  const majorVersions = useMemo(() => {
    const allHosts = data?.hosts ?? []
    if (selectedDistro === 'all') return []
    const versions = new Set<string>()
    allHosts.forEach(host => {
      if (host.os_name === selectedDistro && host.os_version_major) {
        versions.add(host.os_version_major)
      }
    })
    return Array.from(versions).sort((a, b) => {
      // Sort numerically if possible, otherwise alphabetically
      const numA = parseInt(a, 10)
      const numB = parseInt(b, 10)
      if (!isNaN(numA) && !isNaN(numB)) {
        return numB - numA // Descending order (newer first)
      }
      return b.localeCompare(a)
    })
  }, [data?.hosts, selectedDistro])
  
  // Get unique minor versions for selected distribution and major version
  const minorVersions = useMemo(() => {
    const allHosts = data?.hosts ?? []
    if (selectedDistro === 'all' || selectedMajorVersion === 'all') return []
    const versions = new Set<string>()
    allHosts.forEach(host => {
      if (
        host.os_name === selectedDistro &&
        host.os_version_major === selectedMajorVersion &&
        host.os_version_minor
      ) {
        versions.add(host.os_version_minor)
      }
    })
    return Array.from(versions).sort((a, b) => {
      // Sort numerically if possible, otherwise alphabetically
      const numA = parseInt(a, 10)
      const numB = parseInt(b, 10)
      if (!isNaN(numA) && !isNaN(numB)) {
        return numB - numA // Descending order (newer first)
      }
      return b.localeCompare(a)
    })
  }, [data?.hosts, selectedDistro, selectedMajorVersion])
  
  // Reset version filters when distribution changes
  const handleDistroChange = (value: string) => {
    setSelectedDistro(value)
    setSelectedMajorVersion('all')
    setSelectedMinorVersion('all')
  }
  
  // Reset minor version filter when major version changes
  const handleMajorVersionChange = (value: string) => {
    setSelectedMajorVersion(value)
    setSelectedMinorVersion('all')
  }
  
  // Filter hosts by selected criteria
  const hosts = useMemo(() => {
    const allHosts = data?.hosts ?? []
    let filtered = allHosts
    
    if (selectedDistro !== 'all') {
      filtered = filtered.filter(host => host.os_name === selectedDistro)
    }
    
    if (selectedMajorVersion !== 'all') {
      filtered = filtered.filter(host => host.os_version_major === selectedMajorVersion)
    }
    
    if (selectedMinorVersion !== 'all') {
      filtered = filtered.filter(host => host.os_version_minor === selectedMinorVersion)
    }
    
    return filtered
  }, [data?.hosts, selectedDistro, selectedMajorVersion, selectedMinorVersion])
  
  // Handle delete button click
  const handleDeleteClick = (e: React.MouseEvent, host: HostSummary) => {
    e.stopPropagation() // Prevent row click navigation
    setHostToDelete(host)
    setDeleteModalOpen(true)
  }

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!hostToDelete) return
    
    setIsDeleting(true)
    try {
      await api.deleteHost(hostToDelete.host_id)
      // Invalidate and refetch hosts list
      await queryClient.invalidateQueries({ queryKey: ['hosts'] })
      setDeleteModalOpen(false)
      setHostToDelete(null)
    } catch (error) {
      console.error('Failed to delete host:', error)
      alert('Failed to delete host. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Format OS display string with version components
  const formatOS = (host: HostSummary) => {
    if (!host.os_name) {
      return <span className={styles.unknownOS}>Unknown</span>
    }
    
    // Build version string from components if available
    let versionStr = ''
    if (host.os_version_major) {
      versionStr = host.os_version_major
      if (host.os_version_minor) {
        versionStr += `.${host.os_version_minor}`
        if (host.os_version_patch) {
          versionStr += `.${host.os_version_patch}`
        }
      }
    } else if (host.os_version) {
      // Fallback to full version string if components not available
      versionStr = host.os_version
    }
    
    return (
      <div className={styles.osCell}>
        <span className={styles.osName}>{host.os_name}</span>
        {versionStr && <span className={styles.osVersion}>{versionStr}</span>}
      </div>
    )
  }
  
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>All Hosts</h2>
          <p className={styles.subtitle}>
            {selectedDistro === 'all' 
              ? `${data?.total ?? 0} systems reporting to Snailbus`
              : `${hosts.length} of ${data?.total ?? 0} systems${selectedMajorVersion !== 'all' ? ` (${selectedDistro} ${selectedMajorVersion}${selectedMinorVersion !== 'all' ? `.${selectedMinorVersion}` : ''})` : ` (${selectedDistro})`}`
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
              onChange={(e) => handleDistroChange(e.target.value)}
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
          
          {selectedDistro !== 'all' && majorVersions.length > 0 && (
            <div className={styles.filterGroup}>
              <label htmlFor="major-version-filter" className={styles.filterLabel}>
                Major Version:
              </label>
              <select
                id="major-version-filter"
                value={selectedMajorVersion}
                onChange={(e) => handleMajorVersionChange(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Major Versions</option>
                {majorVersions.map(version => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {selectedDistro !== 'all' && selectedMajorVersion !== 'all' && minorVersions.length > 0 && (
            <div className={styles.filterGroup}>
              <label htmlFor="minor-version-filter" className={styles.filterLabel}>
                Minor Version:
              </label>
              <select
                id="minor-version-filter"
                value={selectedMinorVersion}
                onChange={(e) => setSelectedMinorVersion(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Minor Versions</option>
                {minorVersions.map(version => (
                  <option key={version} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            </div>
          )}
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
                <SafeValue value={host.hostname} className={styles.hostname} />
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
          {
            key: 'actions',
            header: 'Actions',
            render: (host: HostSummary) => (
              <button
                className={styles.deleteButton}
                onClick={(e) => handleDeleteClick(e, host)}
                title="Delete host"
              >
                <Trash2 size={16} />
              </button>
            ),
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          if (!isDeleting) {
            setDeleteModalOpen(false)
            setHostToDelete(null)
          }
        }}
        title="Delete Host"
        footer={
          <>
            <button
              className={styles.modalCancelButton}
              onClick={() => {
                setDeleteModalOpen(false)
                setHostToDelete(null)
              }}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              className={styles.modalDeleteButton}
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </>
        }
      >
        <p>
          Are you sure you want to delete <strong><SafeValue value={hostToDelete?.hostname} /></strong>?
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 'var(--space-sm)' }}>
          This action cannot be undone. All data for this host will be permanently removed.
        </p>
      </Modal>
    </div>
  )
}

