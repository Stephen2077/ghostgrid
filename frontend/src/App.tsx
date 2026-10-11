import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { CityPage } from './city/CityPage'

// The dashboard (and recharts) loads on demand so the city's first load stays small.
const DashboardLayout = lazy(() => import('./console/ConsoleLayout').then((m) => ({ default: m.DashboardLayout })))
const OverviewPage = lazy(() => import('./console/pages/OverviewPage').then((m) => ({ default: m.OverviewPage })))
const AgentsPage = lazy(() => import('./console/pages/AgentsPage').then((m) => ({ default: m.AgentsPage })))
const AgentDetailPage = lazy(() => import('./console/pages/AgentDetailPage').then((m) => ({ default: m.AgentDetailPage })))
const RequestLogsPage = lazy(() => import('./console/pages/RequestLogsPage').then((m) => ({ default: m.RequestLogsPage })))
const ApiKeysPage = lazy(() => import('./console/pages/ApiKeysPage').then((m) => ({ default: m.ApiKeysPage })))

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
      <Suspense fallback={<div className="h-full bg-gg-void" />}>
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
      </Suspense>
    </BrowserRouter>
  )
}
