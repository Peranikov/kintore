import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { LogDetailPage } from './pages/LogDetailPage'
import { ExerciseMasterPage } from './pages/ExerciseMasterPage'
import { CalendarPage } from './pages/CalendarPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/log/:id" element={<LogDetailPage />} />
        <Route path="/exercises" element={<ExerciseMasterPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
