import { useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Markdown from 'react-markdown'
import { db } from '../db'
import type { WorkoutLog, Exercise, Set } from '../types'
import { ExerciseForm } from '../components/ExerciseForm'
import { BottomNav } from '../components/BottomNav'
import { generateWorkoutEvaluation, getApiKey } from '../services/gemini'

export function LogDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null)
  const [isAddingExercise, setIsAddingExercise] = useState(false)
  const [memo, setMemo] = useState('')
  const [memoInitialized, setMemoInitialized] = useState(false)
  const [evaluation, setEvaluation] = useState<string | null>(null)
  const [evaluationGeneratedAt, setEvaluationGeneratedAt] = useState<number | null>(null)
  const [evaluationInitialized, setEvaluationInitialized] = useState(false)
  const [evaluationLoading, setEvaluationLoading] = useState(false)
  const [evaluationError, setEvaluationError] = useState<string | null>(null)

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

  const apiKeyExists = useLiveQuery(
    async () => {
      const key = await getApiKey()
      return !!key
    },
    []
  )

  function isBodyweightExercise(name: string): boolean {
    const master = exerciseMasters?.find((m) => m.name === name)
    return master?.isBodyweight || false
  }

  function isCardioExercise(name: string): boolean {
    const master = exerciseMasters?.find((m) => m.name === name)
    return master?.isCardio || false
  }

  if (log && !memoInitialized) {
    setMemo(log.memo || '')
    setMemoInitialized(true)
  }

  // 保存済み評価を読み込み
  if (log && !evaluationInitialized) {
    setEvaluation(log.evaluation || null)
    setEvaluationGeneratedAt(log.evaluationGeneratedAt || null)
    setEvaluationInitialized(true)
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

  async function handleMoveExercise(index: number, direction: 'up' | 'down') {
    if (!log?.id) return
    const exercises = [...log.exercises]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= exercises.length) return
    ;[exercises[index], exercises[targetIndex]] = [exercises[targetIndex], exercises[index]]
    const updated: WorkoutLog = {
      ...log,
      exercises,
      updatedAt: Date.now(),
    }
    await db.workoutLogs.put(updated)
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

  function generateExportText(): string {
    if (!log) return ''

    const lines: string[] = []
    lines.push(`# トレーニング記録 ${log.date}`)
    lines.push('')

    log.exercises.forEach((ex) => {
      const bodyweight = isBodyweightExercise(ex.name)
      const cardio = isCardioExercise(ex.name)
      lines.push(`## ${ex.name}`)
      if (cardio) {
        const s = ex.sets[0]
        if (s) {
          const parts = [`${s.duration}分`]
          if (s.distance) parts.push(`${s.distance}km`)
          lines.push(`- ${parts.join(' / ')}`)
        }
      } else {
        ex.sets.forEach((set, i) => {
          if (bodyweight) {
            lines.push(`- ${i + 1}セット目: ${set.reps}回`)
          } else {
            lines.push(`- ${i + 1}セット目: ${set.weight}kg × ${set.reps}回`)
          }
        })
      }
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

  // AI評価を生成して保存
  const handleGenerateEvaluation = useCallback(async () => {
    if (!log?.id) return

    setEvaluationLoading(true)
    setEvaluationError(null)

    try {
      const result = await generateWorkoutEvaluation(log)
      const now = Date.now()
      setEvaluation(result)
      setEvaluationGeneratedAt(now)

      // 評価をログに保存
      const updated: WorkoutLog = {
        ...log,
        evaluation: result,
        evaluationGeneratedAt: now,
        updatedAt: now,
      }
      await db.workoutLogs.put(updated)
    } catch (e) {
      setEvaluationError(e instanceof Error ? e.message : String(e))
    } finally {
      setEvaluationLoading(false)
    }
  }, [log])

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
          className="min-w-11 min-h-11 flex items-center justify-center text-red-200 hover:text-red-100"
          title="削除"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
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
                          <div className="text-sm text-gray-600">{formatSets(ex.sets, isBodyweightExercise(ex.name), isCardioExercise(ex.name))}</div>
                        </div>
                        <div className="flex">
                          <button
                            onClick={() => handleMoveExercise(index, 'up')}
                            disabled={index === 0}
                            className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-gray-400"
                            title="上へ移動"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleMoveExercise(index, 'down')}
                            disabled={index === log.exercises.length - 1}
                            className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-gray-400"
                            title="下へ移動"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setEditingExerciseIndex(index)}
                            className="min-w-11 min-h-11 flex items-center justify-center text-gray-400 hover:text-blue-600"
                            title="編集"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteExercise(index)}
                            className="min-w-11 min-h-11 flex items-center justify-center text-red-400 hover:text-red-600"
                            title="削除"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

        {/* AI評価セクション */}
        {log.exercises.length > 0 && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">AI評価</h2>
            <div className="bg-white rounded-lg shadow p-4">
              {!apiKeyExists ? (
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-3">
                    AI評価を利用するにはAPIキーの設定が必要です
                  </p>
                  <Link
                    to="/ai-settings"
                    className="text-blue-600 text-sm hover:underline"
                  >
                    AI設定へ
                  </Link>
                </div>
              ) : evaluation ? (
                <div>
                  {evaluationGeneratedAt && (
                    <p className="text-xs text-gray-400 mb-2">
                      {new Date(evaluationGeneratedAt).toLocaleString('ja-JP')} に生成
                    </p>
                  )}
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <Markdown>{evaluation}</Markdown>
                  </div>
                  <button
                    onClick={handleGenerateEvaluation}
                    disabled={evaluationLoading}
                    className="mt-3 text-blue-600 text-sm hover:underline"
                  >
                    再評価
                  </button>
                </div>
              ) : evaluationError ? (
                <div>
                  <p className="text-red-600 text-sm mb-3">{evaluationError}</p>
                  <button
                    onClick={handleGenerateEvaluation}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    再試行
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateEvaluation}
                  disabled={evaluationLoading}
                  className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
                >
                  {evaluationLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      評価中...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      AIで評価する
                    </>
                  )}
                </button>
              )}
            </div>
          </section>
        )}

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
