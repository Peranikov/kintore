import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { WorkoutLog, Exercise, Set, DeloadSuggestion } from '../types'
import { ExerciseForm } from '../components/ExerciseForm'
import { BottomNav } from '../components/BottomNav'
import { ProgressIndicator } from '../components/ProgressIndicator'
import { calculateProgress } from '../utils/progressCalculations'
import { generateDeloadSuggestion } from '../utils/periodization'

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

  const exerciseMasters = useLiveQuery(
    () => db.exerciseMasters.toArray(),
    []
  )

  const allLogs = useLiveQuery(
    () => db.workoutLogs.toArray(),
    []
  )

  // ディロード提案を計算
  const deloadSuggestion = useMemo((): DeloadSuggestion | null => {
    if (!allLogs || !exerciseMasters) return null
    return generateDeloadSuggestion(allLogs, exerciseMasters)
  }, [allLogs, exerciseMasters])

  // 今日の種目の前回記録を取得
  const previousRecords = useMemo(() => {
    if (!todayLog || !allLogs) return {}

    const records: Record<string, Set[]> = {}
    const sortedLogs = [...allLogs].sort((a, b) => b.date.localeCompare(a.date))

    for (const exercise of todayLog.exercises) {
      // 今日より前のログから同じ種目を探す
      for (const otherLog of sortedLogs) {
        if (otherLog.date >= today) continue
        const found = otherLog.exercises.find(ex => ex.name === exercise.name)
        if (found) {
          records[exercise.name] = found.sets
          break
        }
      }
    }

    return records
  }, [todayLog, allLogs, today])

  function isBodyweightExercise(name: string): boolean {
    const master = exerciseMasters?.find((m) => m.name === name)
    return master?.isBodyweight || false
  }

  function isCardioExercise(name: string): boolean {
    const master = exerciseMasters?.find((m) => m.name === name)
    return master?.isCardio || false
  }

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

  function formatSets(sets: Set[], isBodyweight: boolean, isCardio: boolean): string {
    if (isCardio) {
      const s = sets[0]
      if (!s) return ''
      const parts = [`${s.duration}分`]
      if (s.distance) parts.push(`${s.distance}km`)
      return parts.join(' / ')
    }
    if (isBodyweight) {
      return sets.map(s => `${s.reps}回`).join(', ')
    }
    return sets.map(s => `${s.weight}kg×${s.reps}`).join(', ')
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-blue-600 text-white p-4">
        <div className="flex items-end justify-between">
          <h1 className="text-xl font-bold">Kintore</h1>
          <span className="text-xs opacity-60">{__COMMIT_HASH__}</span>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {deloadSuggestion && (
          <Link
            to="/plan-create"
            className="mb-4 block bg-amber-50 border border-amber-200 rounded-lg p-4 hover:bg-amber-100"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-amber-800">
                  {deloadSuggestion.reason === 'consecutive_weeks'
                    ? 'ディロード週の検討を'
                    : 'パフォーマンス低下を検出'}
                </div>
                <div className="text-sm text-amber-700 mt-1">
                  {deloadSuggestion.message}
                </div>
                <div className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <span>AIプランでディロードメニューを作成</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        )}

        <Link
          to="/plan-create"
          className="mb-6 block w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 flex items-center justify-center gap-2 font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AIでプランを作成
        </Link>

        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-3">今日のトレーニング</h2>
          <div className="bg-white rounded-lg shadow p-4">
            {todayLog && todayLog.exercises.length > 0 ? (
              <ul className="space-y-3">
                {todayLog.exercises.map((ex) => (
                  <li key={ex.id} className="border-b pb-2 last:border-b-0">
                    <div className="font-medium">{ex.name}</div>
                    <div className="text-sm text-gray-600">{formatSets(ex.sets, isBodyweightExercise(ex.name), isCardioExercise(ex.name))}</div>
                    {previousRecords[ex.name] && (
                      <div className="mt-1">
                        <ProgressIndicator
                          comparison={calculateProgress(
                            ex.sets,
                            previousRecords[ex.name],
                            isBodyweightExercise(ex.name),
                            isCardioExercise(ex.name)
                          )}
                          compact
                        />
                      </div>
                    )}
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
                className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
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

      <BottomNav current="home" />
    </div>
  )
}
