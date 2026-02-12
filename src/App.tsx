import { HashRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { LogDetailPage } from './pages/LogDetailPage'
import { ExerciseMasterPage } from './pages/ExerciseMasterPage'
import { CalendarPage } from './pages/CalendarPage'
import { GraphPage } from './pages/GraphPage'
import { SettingsPage } from './pages/SettingsPage'
import { ExportPage } from './pages/ExportPage'
import { GeminiTestPage } from './pages/GeminiTestPage'
import { AISettingsPage } from './pages/AISettingsPage'
import { PlanCreatePage } from './pages/PlanCreatePage'
import { ImportPage } from './pages/ImportPage'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/log/:id" element={<LogDetailPage />} />
        <Route path="/exercises" element={<ExerciseMasterPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/gemini-test" element={<GeminiTestPage />} />
        <Route path="/ai-settings" element={<AISettingsPage />} />
        <Route path="/plan-create" element={<PlanCreatePage />} />
        <Route path="/import" element={<ImportPage />} />
      </Routes>
    </HashRouter>
  )
}

export default App
