import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { WorkoutLog, Exercise, Set } from '../types'
import { ExerciseForm } from '../components/ExerciseForm'
import { BottomNav } from '../components/BottomNav'

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

  const exerciseMasters = useLiveQuery(
    () => db.exerciseMasters.toArray(),
    []
  )

  function isBodyweightExercise(name: string): boolean {
    const master = exerciseMasters?.find((m) => m.name === name)
    return master?.isBodyweight || false
  }

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

  function formatSets(sets: Set[], isBodyweight: boolean): string {
    if (isBodyweight) {
      return sets.map(s => `${s.reps}回`).join(', ')
    }
    return sets.map(s => `${s.weight}kg×${s.reps}`).join(', ')
  }

  function generateExportText(): string {
    if (!log) return ''

    const lines: string[] = []
    lines.push(`# トレーニング記録 ${log.date}`)
    lines.push('')

    log.exercises.forEach((ex) => {
      const bodyweight = isBodyweightExercise(ex.name)
      lines.push(`## ${ex.name}`)
      ex.sets.forEach((set, i) => {
        if (bodyweight) {
          lines.push(`- ${i + 1}セット目: ${set.reps}回`)
        } else {
          lines.push(`- ${i + 1}セット目: ${set.weight}kg × ${set.reps}回`)
        }
      })
      lines.push('')
    })

    if (log.memo) {
      lines.push('## メモ')
      lines.push(log.memo)
    }

    return lines.join('\n')
  }

  async function handleExport() {
    const text = generateExportText()

    if (navigator.share) {
      try {
        await navigator.share({
          title: `トレーニング記録 ${log?.date}`,
          text,
        })
      } catch {
        copyToClipboard(text)
      }
    } else {
      copyToClipboard(text)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      alert('クリップボードにコピーしました')
    })
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
                          <div className="text-sm text-gray-600">{formatSets(ex.sets, isBodyweightExercise(ex.name))}</div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditingExerciseIndex(index)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                            title="編集"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteExercise(index)}
                            className="p-1 text-red-400 hover:text-red-600"
                            title="削除"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
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
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              種目を追加
            </button>
          )}
        </section>

        <section className="mb-6">
          <button
            onClick={handleExport}
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
          >
            テキストをコピー
          </button>
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

      <BottomNav current="home" />
    </div>
  )
}
