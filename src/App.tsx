import { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { FeedbackProvider } from './components/FeedbackProvider'

const LogDetailPage = lazy(() => import('./pages/LogDetailPage').then((module) => ({ default: module.LogDetailPage })))
const ExerciseMasterPage = lazy(() => import('./pages/ExerciseMasterPage').then((module) => ({ default: module.ExerciseMasterPage })))
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })))
const GraphPage = lazy(() => import('./pages/GraphPage').then((module) => ({ default: module.GraphPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const ExportPage = lazy(() => import('./pages/ExportPage').then((module) => ({ default: module.ExportPage })))
const AISettingsPage = lazy(() => import('./pages/AISettingsPage').then((module) => ({ default: module.AISettingsPage })))
const PlanCreatePage = lazy(() => import('./pages/PlanCreatePage').then((module) => ({ default: module.PlanCreatePage })))
const ImportPage = lazy(() => import('./pages/ImportPage').then((module) => ({ default: module.ImportPage })))

function RouteFallback() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-screen-md rounded-lg bg-white p-4 text-sm text-gray-500 shadow">
        読み込み中...
      </div>
    </div>
  )
}

function App() {
  return (
    <FeedbackProvider>
      <HashRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/log/:id" element={<LogDetailPage />} />
            <Route path="/exercises" element={<ExerciseMasterPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/graph" element={<GraphPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/ai-settings" element={<AISettingsPage />} />
            <Route path="/plan-create" element={<PlanCreatePage />} />
            <Route path="/import" element={<ImportPage />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </FeedbackProvider>
  )
}

export default App
