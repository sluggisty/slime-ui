import { useLocation, useNavigate } from 'react-router-dom'
import { RefreshCw, LogOut } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { auth } from '../api/auth'
import styles from './Header.module.css'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/hosts': 'Hosts',
}

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const getTitle = () => {
    if (location.pathname.startsWith('/hosts/')) return 'Host Details'
    return pageTitles[location.pathname] || 'Sluggisty'
  }
  
  const handleRefresh = () => {
    queryClient.invalidateQueries()
  }

  const handleLogout = () => {
    auth.removeApiKey()
    navigate('/login')
  }
  
  return (
    <header className={styles.header}>
      <div className={styles.titleSection}>
        <h1 className={styles.title}>{getTitle()}</h1>
        <span className={styles.breadcrumb}>{location.pathname}</span>
      </div>
      
      <div className={styles.actions}>
        <button 
          className={styles.iconButton}
          onClick={handleRefresh}
          title="Refresh data"
        >
          <RefreshCw size={18} />
        </button>
        <button 
          className={styles.iconButton}
          onClick={handleLogout}
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}

