import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { WorkoutLog, Exercise, Set } from '../types'
import { ExerciseForm } from '../components/ExerciseForm'

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

export function HomePage() {
  const [isAddingExercise, setIsAddingExercise] = useState(false)

  const today = getTodayDate()

  const todayLog = useLiveQuery(
    () => db.workoutLogs.where('date').equals(today).first(),
    [today]
  )

  const recentLogs = useLiveQuery(
    async () => {
      const logs = await db.workoutLogs
        .orderBy('date')
        .reverse()
        .limit(10)
        .toArray()
      return logs.filter(log => log.date !== today)
    },
    [today]
  )

  async function handleAddExercise(exercise: Exercise) {
    const now = Date.now()

    if (todayLog) {
      const updated: WorkoutLog = {
        ...todayLog,
        exercises: [...todayLog.exercises, exercise],
        updatedAt: now,
      }
      await db.workoutLogs.put(updated)
    } else {
      const newLog: WorkoutLog = {
        date: today,
        exercises: [exercise],
        createdAt: now,
        updatedAt: now,
      }
      await db.workoutLogs.add(newLog)
    }

    setIsAddingExercise(false)
  }

  function formatSets(sets: Set[]): string {
    return sets.map(s => `${s.weight}kg×${s.reps}`).join(', ')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-xl font-bold">Kintore</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-3">今日のトレーニング</h2>
          <div className="bg-white rounded-lg shadow p-4">
            {todayLog && todayLog.exercises.length > 0 ? (
              <ul className="space-y-3">
                {todayLog.exercises.map((ex) => (
                  <li key={ex.id} className="border-b pb-2 last:border-b-0">
                    <div className="font-medium">{ex.name}</div>
                    <div className="text-sm text-gray-600">{formatSets(ex.sets)}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">まだ記録がありません</p>
            )}

            {isAddingExercise ? (
              <ExerciseForm
                onSubmit={handleAddExercise}
                onCancel={() => setIsAddingExercise(false)}
              />
            ) : (
              <button
                onClick={() => setIsAddingExercise(true)}
                className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
              >
                種目を追加
              </button>
            )}

            {todayLog && (
              <Link
                to={`/log/${todayLog.id}`}
                className="mt-2 block text-center text-blue-600 hover:underline"
              >
                詳細を見る
              </Link>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">直近のトレーニング</h2>
          {recentLogs && recentLogs.length > 0 ? (
            <ul className="space-y-2">
              {recentLogs.map((log) => (
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
            <p className="text-gray-500">過去の記録はありません</p>
          )}
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex">
        <Link to="/" className="flex-1 py-3 text-center text-blue-600 font-medium">
          ホーム
        </Link>
        <Link to="/calendar" className="flex-1 py-3 text-center text-gray-600 hover:text-blue-600">
          カレンダー
        </Link>
        <Link to="/exercises" className="flex-1 py-3 text-center text-gray-600 hover:text-blue-600">
          種目
        </Link>
      </nav>
    </div>
  )
}
