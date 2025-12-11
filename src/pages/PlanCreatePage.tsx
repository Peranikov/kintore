import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { generatePlan, getApiKey } from '../services/gemini'
import type { GeneratedPlan } from '../services/gemini'
import type { WorkoutLog, Exercise } from '../types'

type Status = 'input' | 'loading' | 'preview' | 'error'

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

export function PlanCreatePage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('input')
  const [memo, setMemo] = useState('')
  const [plan, setPlan] = useState<GeneratedPlan | null>(null)
  const [error, setError] = useState('')

  const today = getTodayDate()

  const todayLog = useLiveQuery(
    () => db.workoutLogs.where('date').equals(today).first(),
    [today]
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

  // プラン生成
  const handleGenerate = useCallback(async () => {
    setStatus('loading')
    setError('')
    setPlan(null)

    try {
      const generatedPlan = await generatePlan(memo)
      setPlan(generatedPlan)
      setStatus('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }, [memo])

  // プランを採用してログに登録
  const handleAdopt = useCallback(async () => {
    if (!plan) return

    const now = Date.now()

    // Exercise型に変換
    const exercises: Exercise[] = plan.exercises.map((ex, index) => ({
      id: `${now}-${index}`,
      name: ex.name,
      sets: ex.sets.map(s => ({
        weight: s.weight,
        reps: s.reps,
      })),
    }))

    if (todayLog) {
      // 既存のログに追加
      const updated: WorkoutLog = {
        ...todayLog,
        exercises: [...todayLog.exercises, ...exercises],
        updatedAt: now,
      }
      await db.workoutLogs.put(updated)
      navigate(`/log/${todayLog.id}`)
    } else {
      // 新規ログ作成
      const newLog: WorkoutLog = {
        date: today,
        exercises,
        memo: plan.advice,
        createdAt: now,
        updatedAt: now,
      }
      const id = await db.workoutLogs.add(newLog)
      navigate(`/log/${id}`)
    }
  }, [plan, todayLog, today, navigate])

  // 再生成
  const handleRegenerate = useCallback(() => {
    setStatus('input')
    setPlan(null)
    setError('')
  }, [])

  // 自重種目かどうか判定
  const isBodyweight = useCallback((name: string): boolean => {
    const master = exerciseMasters?.find(m => m.name === name)
    return master?.isBodyweight || false
  }, [exerciseMasters])

  // APIキーが未設定の場合
  if (apiKeyExists === false) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-screen-md mx-auto px-4 py-4 flex items-center">
            <Link to="/" className="mr-4 text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-gray-800">AIプラン作成</h1>
          </div>
        </header>

        <main className="max-w-screen-md mx-auto px-4 py-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-lg font-bold text-yellow-800 mb-2">APIキーが設定されていません</h2>
            <p className="text-sm text-yellow-700 mb-4">
              AIプランを作成するには、Gemini APIキーの設定が必要です。
            </p>
            <Link
              to="/ai-settings"
              className="inline-block bg-yellow-600 text-white px-6 py-2 rounded-lg font-medium"
            >
              AI設定へ
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-md mx-auto px-4 py-4 flex items-center">
          <Link to="/" className="mr-4 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-800">AIプラン作成</h1>
        </div>
      </header>

      <main className="max-w-screen-md mx-auto px-4 py-6 space-y-6">
        {/* 入力画面 */}
        {(status === 'input' || status === 'loading') && (
          <>
            <section className="bg-white rounded-lg shadow p-4">
              <h2 className="font-bold text-gray-700 mb-3">今日の状態・リクエスト</h2>
              <p className="text-sm text-gray-500 mb-3">
                今日の体調、トレーニングに使える時間、重点的に鍛えたい部位などを入力してください（任意）
              </p>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm"
                placeholder={`例:
今日は時間がないので30分で終わるメニュー希望
肩が少し痛いので肩を使う種目は避けたい
胸を重点的に鍛えたい`}
                disabled={status === 'loading'}
              />
            </section>

            <button
              onClick={handleGenerate}
              disabled={status === 'loading'}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {status === 'loading' ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  プラン生成中...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  プランを作成
                </>
              )}
            </button>
          </>
        )}

        {/* プレビュー画面 */}
        {status === 'preview' && plan && (
          <>
            <section className="bg-white rounded-lg shadow p-4">
              <h2 className="font-bold text-gray-700 mb-3">生成されたプラン</h2>

              {plan.advice && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <strong>AIからのアドバイス:</strong> {plan.advice}
                </div>
              )}

              <ul className="space-y-3">
                {plan.exercises.map((ex, index) => (
                  <li key={index} className="border-b pb-3 last:border-b-0 last:pb-0">
                    <div className="font-medium text-gray-800">{ex.name}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {ex.sets.map((s, i) => {
                        const isBw = isBodyweight(ex.name)
                        return (
                          <span key={i}>
                            {i > 0 && ', '}
                            {isBw || s.weight === 0 ? `${s.reps}回` : `${s.weight}kg×${s.reps}回`}
                          </span>
                        )
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <div className="flex gap-3">
              <button
                onClick={handleRegenerate}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium"
              >
                再生成
              </button>
              <button
                onClick={handleAdopt}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium"
              >
                採用する
              </button>
            </div>

            <p className="text-sm text-gray-500 text-center">
              「採用する」をタップすると、今日のログに追加されます
            </p>
          </>
        )}

        {/* エラー画面 */}
        {status === 'error' && (
          <>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h2 className="font-bold text-red-700 mb-2">エラーが発生しました</h2>
              <p className="text-sm text-red-600">{error}</p>
            </div>

            <button
              onClick={handleRegenerate}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-medium"
            >
              やり直す
            </button>
          </>
        )}
      </main>
    </div>
  )
}
