import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { WorkoutLog, Exercise, Set } from '../types'
import { ExerciseForm } from '../components/ExerciseForm'

export function LogDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null)
  const [isAddingExercise, setIsAddingExercise] = useState(false)
  const [memo, setMemo] = useState('')
  const [memoInitialized, setMemoInitialized] = useState(false)

  const log = useLiveQuery(
    async () => {
      if (!id) return null
      const found = await db.workoutLogs.get(Number(id))
      return found || null
    },
    [id]
  )

  if (log && !memoInitialized) {
    setMemo(log.memo || '')
    setMemoInitialized(true)
  }

  async function handleDeleteLog() {
    if (!log?.id || !confirm('このログを削除しますか？')) return
    await db.workoutLogs.delete(log.id)
    navigate('/')
  }

  async function handleDeleteExercise(index: number) {
    if (!log?.id || !confirm('この種目を削除しますか？')) return
    const updated: WorkoutLog = {
      ...log,
      exercises: log.exercises.filter((_, i) => i !== index),
      updatedAt: Date.now(),
    }
    await db.workoutLogs.put(updated)
  }

  async function handleUpdateExercise(index: number, exercise: Exercise) {
    if (!log?.id) return
    const exercises = [...log.exercises]
    exercises[index] = exercise
    const updated: WorkoutLog = {
      ...log,
      exercises,
      updatedAt: Date.now(),
    }
    await db.workoutLogs.put(updated)
    setEditingExerciseIndex(null)
  }

  async function handleAddExercise(exercise: Exercise) {
    if (!log?.id) return
    const updated: WorkoutLog = {
      ...log,
      exercises: [...log.exercises, exercise],
      updatedAt: Date.now(),
    }
    await db.workoutLogs.put(updated)
    setIsAddingExercise(false)
  }

  async function handleSaveMemo() {
    if (!log?.id) return
    const updated: WorkoutLog = {
      ...log,
      memo,
      updatedAt: Date.now(),
    }
    await db.workoutLogs.put(updated)
    setIsEditing(false)
  }

  function formatSets(sets: Set[]): string {
    return sets.map(s => `${s.weight}kg×${s.reps}`).join(', ')
  }

  if (!log) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <p>ログが見つかりません</p>
        <Link to="/" className="text-blue-600 hover:underline">ホームに戻る</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-blue-600 text-white p-4 flex items-center justify-between">
        <Link to="/" className="text-white hover:opacity-80">&larr; 戻る</Link>
        <h1 className="text-xl font-bold">{log.date}</h1>
        <button
          onClick={handleDeleteLog}
          className="text-red-200 hover:text-red-100"
        >
          削除
        </button>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-3">種目</h2>
          <div className="bg-white rounded-lg shadow">
            {log.exercises.length > 0 ? (
              <ul className="divide-y">
                {log.exercises.map((ex, index) => (
                  <li key={ex.id} className="p-4">
                    {editingExerciseIndex === index ? (
                      <ExerciseForm
                        initialExercise={ex}
                        onSubmit={(updated) => handleUpdateExercise(index, updated)}
                        onCancel={() => setEditingExerciseIndex(null)}
                      />
                    ) : (
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{ex.name}</div>
                          <div className="text-sm text-gray-600">{formatSets(ex.sets)}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingExerciseIndex(index)}
                            className="text-blue-600 text-sm hover:underline"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteExercise(index)}
                            className="text-red-600 text-sm hover:underline"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-gray-500">種目がありません</p>
            )}
          </div>

          {isAddingExercise ? (
            <div className="mt-4 bg-white rounded-lg shadow p-4">
              <ExerciseForm
                onSubmit={handleAddExercise}
                onCancel={() => setIsAddingExercise(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => setIsAddingExercise(true)}
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
            >
              種目を追加
            </button>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">メモ</h2>
          <div className="bg-white rounded-lg shadow p-4">
            {isEditing ? (
              <>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full border rounded p-2 h-24"
                  placeholder="メモを入力..."
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSaveMemo}
                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setMemo(log.memo || '')
                      setIsEditing(false)
                    }}
                    className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300"
                  >
                    キャンセル
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {log.memo || 'メモなし'}
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="mt-2 text-blue-600 text-sm hover:underline"
                >
                  編集
                </button>
              </>
            )}
          </div>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex">
        <Link to="/" className="flex-1 py-3 text-center text-gray-600 hover:text-blue-600">
          ホーム
        </Link>
        <Link to="/exercises" className="flex-1 py-3 text-center text-gray-600 hover:text-blue-600">
          種目マスタ
        </Link>
      </nav>
    </div>
  )
}
