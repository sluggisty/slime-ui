import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Hosts from './pages/Hosts'
import HostDetail from './pages/HostDetail'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="hosts" element={<Hosts />} />
        <Route path="hosts/:hostname" element={<HostDetail />} />
      </Route>
    </Routes>
  )
}

export default App

