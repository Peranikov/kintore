import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { WorkoutLog, Exercise } from '../types'
import { ExerciseForm } from '../components/ExerciseForm'
import { BottomNav } from '../components/BottomNav'

function getMonthDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }
  return days
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function CalendarPage() {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isAddingExercise, setIsAddingExercise] = useState(false)
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const logs = useLiveQuery(
    async () => {
      const startDate = formatDate(year, month, 1)
      const endDate = formatDate(year, month + 1, 0)
      return await db.workoutLogs
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray()
    },
    [year, month]
  )

  const logDates = new Set(logs?.map(log => log.date) || [])

  function goToPrevMonth() {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  function goToNextMonth() {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  function goToToday() {
    setCurrentDate(new Date())
  }

  function handleDateClick(dateStr: string, log: WorkoutLog | undefined) {
    if (log) {
      navigate(`/log/${log.id}`)
    } else {
      setSelectedDate(dateStr)
      setIsAddingExercise(false)
    }
  }

  async function handleAddExercise(exercise: Exercise) {
    if (!selectedDate) return
    const now = Date.now()

    const existingLog = await db.workoutLogs.where('date').equals(selectedDate).first()

    if (existingLog) {
      const updated: WorkoutLog = {
        ...existingLog,
        exercises: [...existingLog.exercises, exercise],
        updatedAt: now,
      }
      await db.workoutLogs.put(updated)
    } else {
      const newLog: WorkoutLog = {
        date: selectedDate,
        exercises: [exercise],
        createdAt: now,
        updatedAt: now,
      }
      await db.workoutLogs.add(newLog)
    }

    setIsAddingExercise(false)
  }

  function closeModal() {
    setSelectedDate(null)
    setIsAddingExercise(false)
  }

  const selectedLog = selectedDate ? logs?.find(l => l.date === selectedDate) : null

  const days = getMonthDays(year, month)
  const today = new Date()
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-xl font-bold">カレンダー</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPrevMonth}
              className="p-2 hover:bg-gray-100 rounded"
            >
              &larr;
            </button>
            <div className="text-center">
              <span className="text-lg font-semibold">
                {year}年{month + 1}月
              </span>
              <button
                onClick={goToToday}
                className="ml-2 text-sm text-blue-600 hover:underline"
              >
                今日
              </button>
            </div>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-100 rounded"
            >
              &rarr;
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-sm mb-2">
            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
              <div
                key={d}
                className={`font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'}`}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="h-10" />
              }

              const dateStr = formatDate(year, month, day)
              const hasLog = logDates.has(dateStr)
              const isToday = dateStr === todayStr
              const dayOfWeek = (index) % 7

              const log = logs?.find(l => l.date === dateStr)

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDateClick(dateStr, log)}
                  className={`
                    h-10 flex flex-col items-center justify-center rounded relative
                    ${isToday ? 'bg-blue-100 font-bold' : ''}
                    ${hasLog ? 'hover:bg-green-100' : 'hover:bg-gray-50'}
                    ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''}
                  `}
                >
                  <span className="text-sm">{day}</span>
                  {hasLog && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 bg-green-500 rounded-full" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <section className="mt-6">
          <h2 className="text-lg font-semibold mb-3">
            {year}年{month + 1}月のトレーニング
          </h2>
          {logs && logs.length > 0 ? (
            <ul className="space-y-2">
              {logs
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((log) => (
                  <li key={log.id}>
                    <Link
                      to={`/log/${log.id}`}
                      className="block bg-white rounded-lg shadow p-4 hover:bg-gray-50"
                    >
                      <div className="font-medium">{log.date}</div>
                      <div className="text-sm text-gray-600">
                        {log.exercises.map(e => e.name).join(', ')}
                      </div>
                    </Link>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-gray-500">この月のトレーニング記録はありません</p>
          )}
        </section>
      </main>

      {selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">{selectedDate}</h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                &times;
              </button>
            </div>

            <div className="p-4">
              {selectedLog && selectedLog.exercises.length > 0 ? (
                <div className="mb-4">
                  <h3 className="font-medium mb-2">記録済みの種目</h3>
                  <ul className="space-y-2">
                    {selectedLog.exercises.map((ex) => (
                      <li key={ex.id} className="text-sm text-gray-600">
                        {ex.name}: {ex.sets.map(s => `${s.weight}kg×${s.reps}`).join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-gray-500 mb-4">この日の記録はありません</p>
              )}

              {isAddingExercise ? (
                <ExerciseForm
                  onSubmit={handleAddExercise}
                  onCancel={() => setIsAddingExercise(false)}
                />
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => setIsAddingExercise(true)}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    種目を追加
                  </button>
                  {selectedLog && (
                    <Link
                      to={`/log/${selectedLog.id}`}
                      className="block w-full text-center bg-gray-200 py-2 rounded-lg hover:bg-gray-300"
                    >
                      詳細を見る
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav current="calendar" />
    </div>
  )
}
