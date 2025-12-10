import { HashRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { LogDetailPage } from './pages/LogDetailPage'
import { ExerciseMasterPage } from './pages/ExerciseMasterPage'
import { CalendarPage } from './pages/CalendarPage'
import { GraphPage } from './pages/GraphPage'
import { SettingsPage } from './pages/SettingsPage'
import { ExportPage } from './pages/ExportPage'
import { LLMTestPage } from './pages/LLMTestPage'

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
        <Route path="/llm-test" element={<LLMTestPage />} />
      </Routes>
    </HashRouter>
  )
}

export default App
