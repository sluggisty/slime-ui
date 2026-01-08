import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Server, AlertTriangle, Clock, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../api/client';
import { StatCard } from '../components/Card';
import { Badge } from '../components/Table';
import type { HostSummary } from '../types';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: hostsData, isLoading: hostsLoading } = useQuery({
    queryKey: ['hosts'],
    queryFn: api.getHosts,
  });

  const totalHosts = hostsData?.total ?? 0;
  const hosts = useMemo(() => hostsData?.hosts ?? [], [hostsData?.hosts]);

  // Calculate active hosts (seen in last hour)
  // Calculate hourAgo once using useMemo to avoid calling Date.now() during render
  // eslint-disable-next-line react-hooks/purity
  const hourAgo = useMemo(() => new Date(Date.now() - 60 * 60 * 1000), []);
  const activeHosts = useMemo(() => {
    return hosts.filter(h => {
      const lastSeen = new Date(h.last_seen);
      return lastSeen > hourAgo;
    }).length;
  }, [hosts, hourAgo]);

  return (
    <div className={styles.dashboard}>
      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <StatCard
          title='Total Hosts'
          value={totalHosts}
          subtitle='Systems monitored'
          icon={<Server size={20} />}
          color='accent'
        />
        <StatCard
          title='Active Hosts'
          value={activeHosts}
          subtitle='Seen in last hour'
          icon={<Activity size={20} />}
          color={activeHosts > 0 ? 'success' : 'warning'}
        />
        <StatCard
          title='Stale Hosts'
          value={totalHosts - activeHosts}
          subtitle='Not seen recently'
          icon={<AlertTriangle size={20} />}
          color={totalHosts - activeHosts > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* Main Content */}
      <div className={styles.mainGrid}>
        {/* All Hosts */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Recent Hosts</h2>
            <button className={styles.viewAllBtn} onClick={() => navigate('/hosts')}>
              View All
            </button>
          </div>
          <div className={styles.hostsList}>
            {hostsLoading ? (
              <div className={styles.loading}>Loading...</div>
            ) : hosts.length === 0 ? (
              <div className={styles.empty}>
                <Server size={32} />
                <p>No hosts reporting yet</p>
                <span>Run snail-core on your systems to start collecting data</span>
              </div>
            ) : (
              hosts
                .slice(0, 8)
                .map(host => (
                  <HostCard
                    key={host.host_id}
                    host={host}
                    hourAgo={hourAgo}
                    onClick={() => navigate(`/hosts/${host.host_id}`)}
                  />
                ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function HostCard({
  host,
  onClick,
  hourAgo,
}: {
  host: HostSummary;
  onClick: () => void;
  hourAgo: Date;
}) {
  const lastSeen = new Date(host.last_seen);
  const isActive = lastSeen > hourAgo;

  return (
    <div className={styles.hostCard} onClick={onClick}>
      <div className={styles.hostIcon}>
        <Server size={20} />
      </div>
      <div className={styles.hostInfo}>
        <span className={styles.hostName}>{host.hostname}</span>
        <span className={styles.hostMeta}>
          <Clock size={12} />
          {formatDistanceToNow(lastSeen, { addSuffix: true })}
        </span>
      </div>
      <Badge variant={isActive ? 'success' : 'warning'}>{isActive ? 'Active' : 'Stale'}</Badge>
      <Activity size={16} className={`${styles.hostStatus} ${isActive ? styles.active : ''}`} />
    </div>
  );
}
