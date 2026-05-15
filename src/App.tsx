import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { AssessmentModule } from './components/org/AssessmentModule'
import { CommitteeModule } from './components/org/CommitteeModule'
import PolicyDetail from './components/org/PolicyDetail'
import { PolicyModule } from './components/org/PolicyModule'
import { PublicityModule } from './components/org/PublicityModule'
import { ResponsibilityModule } from './components/org/ResponsibilityModule'
import TrainingDetail from './components/org/TrainingDetail'
import { TrainingModule } from './components/org/TrainingModule'
import { CDDModule } from './components/ops/CDDModule'
import { LargeTransactionModule } from './components/ops/LargeTransactionModule'
import { OtherOpsModule } from './components/ops/OtherOpsModule'
import { RiskModule } from './components/ops/RiskModule'
import { STRModule } from './components/ops/STRModule'
import { RectificationModule } from './components/special/RectificationModule'
import { ReportModule } from './components/special/ReportModule'
import type { AMLModule } from './types'
import Dashboard from './pages/Dashboard'

const MODULE_PATH_MAP: Record<AMLModule, string> = {
  dashboard: '/dashboard',
  policy: '/org/library',
  policyFavorites: '/org/library?view=favorites',
  policyProcess: '/org/library',
  policyKnowledge: '/org/library',
  responsibility: '/org/responsibility',
  committee: '/org/committee',
  training: '/org/training',
  publicity: '/org/publicity',
  assessment: '/org/assessment',
  cdd: '/ops/cdd',
  risk: '/ops/risk',
  str: '/ops/str',
  largeTransaction: '/ops/large-transaction',
  otherOps: '/ops/other',
  report: '/special/report',
  rectification: '/special/rectification',
}

function getActiveModuleByPath(pathname: string, search: string): AMLModule {
  if (pathname.startsWith('/library')) return 'policy'
  if (pathname.startsWith('/org/library')) {
    const view = new URLSearchParams(search).get('view')
    if (view === 'favorites') return 'policyFavorites'
    return 'policy'
  }
  if (pathname.startsWith('/org/policy')) return 'policy'
  if (pathname.startsWith('/training')) return 'training'

  const matched = (Object.entries(MODULE_PATH_MAP) as Array<[AMLModule, string]>).find(([module, path]) => {
    if (module === 'policy') return pathname.startsWith('/org/library') || pathname.startsWith('/org/policy')
    return path === pathname
  })
  return matched?.[0] ?? 'dashboard'
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeModule = getActiveModuleByPath(location.pathname, location.search)

  return (
    <Layout
      activeModule={activeModule}
      onSelectModule={(module) => {
        navigate(MODULE_PATH_MAP[module])
      }}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/org/library" element={<PolicyModule />} />
        <Route path="/org/library/:policyId" element={<PolicyDetail />} />
        <Route path="/library/:policyId" element={<PolicyDetail />} />
        <Route path="/library" element={<Navigate to="/org/library" replace />} />
        <Route path="/org/policy" element={<Navigate to="/org/library" replace />} />
        <Route path="/org/policy/policies" element={<Navigate to="/org/library" replace />} />
        <Route path="/org/policy/processes" element={<Navigate to="/org/library" replace />} />
        <Route path="/org/policy/:policyId" element={<Navigate to="/org/library/:policyId" replace />} />
        <Route path="/org/responsibility" element={<ResponsibilityModule />} />
        <Route path="/org/committee" element={<CommitteeModule />} />
        <Route path="/org/training" element={<TrainingModule />} />
        <Route path="/org/training/:id" element={<TrainingDetail />} />
        <Route path="/training" element={<Navigate to="/org/training" replace />} />
        <Route path="/training/:id" element={<TrainingDetail />} />
        <Route path="/org/publicity" element={<PublicityModule />} />
        <Route path="/org/assessment" element={<AssessmentModule />} />

        <Route path="/ops/cdd" element={<CDDModule />} />
        <Route path="/ops/risk" element={<RiskModule />} />
        <Route path="/ops/str" element={<STRModule />} />
        <Route path="/ops/large-transaction" element={<LargeTransactionModule />} />
        <Route path="/ops/other" element={<OtherOpsModule />} />

        <Route path="/special/report" element={<ReportModule />} />
        <Route path="/special/rectification" element={<RectificationModule />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
