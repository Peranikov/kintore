import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

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
  const [currentDate, setCurrentDate] = useState(new Date())
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
                <Link
                  key={day}
                  to={log ? `/log/${log.id}` : '#'}
                  className={`
                    h-10 flex flex-col items-center justify-center rounded relative
                    ${isToday ? 'bg-blue-100 font-bold' : ''}
                    ${hasLog ? 'hover:bg-green-100' : 'hover:bg-gray-50'}
                    ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''}
                  `}
                  onClick={(e) => {
                    if (!log) e.preventDefault()
                  }}
                >
                  <span className="text-sm">{day}</span>
                  {hasLog && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 bg-green-500 rounded-full" />
                  )}
                </Link>
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

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex">
        <Link to="/" className="flex-1 py-3 text-center text-gray-600 hover:text-blue-600">
          ホーム
        </Link>
        <Link to="/calendar" className="flex-1 py-3 text-center text-blue-600 font-medium">
          カレンダー
        </Link>
        <Link to="/exercises" className="flex-1 py-3 text-center text-gray-600 hover:text-blue-600">
          種目
        </Link>
      </nav>
    </div>
  )
}
