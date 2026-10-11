import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { CityPage } from './city/CityPage'
import { DashboardLayout } from './console/ConsoleLayout'
import { AgentDetailPage } from './console/pages/AgentDetailPage'
import { AgentsPage } from './console/pages/AgentsPage'
import { ApiKeysPage } from './console/pages/ApiKeysPage'
import { OverviewPage } from './console/pages/OverviewPage'
import { RequestLogsPage } from './console/pages/RequestLogsPage'

// Old /console links (still used in some city panels) land on the matching dashboard page.
const CONSOLE_TO_DASHBOARD: Record<string, string> = { agents: 'agents', logs: 'activity', keys: 'keys' }

function ConsoleRedirect() {
  const [head = '', ...rest] = (useParams()['*'] ?? '').split('/')
  const section = CONSOLE_TO_DASHBOARD[head]
  const to = section ? ['/dashboard', section, ...rest].filter(Boolean).join('/') : '/dashboard'
  return <Navigate to={to} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CityPage />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="agents/:agentId" element={<AgentDetailPage />} />
          <Route path="activity" element={<RequestLogsPage />} />
          <Route path="keys" element={<ApiKeysPage />} />
        </Route>
        <Route path="/console/*" element={<ConsoleRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
