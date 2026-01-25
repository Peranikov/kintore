import { useState, useCallback, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { generatePlan, getApiKey } from '../services/gemini'
import type { GeneratedPlan } from '../services/gemini'
import type { WorkoutLog, Exercise, Set } from '../types'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  plan?: GeneratedPlan
  isError?: boolean
  timestamp: number
}

interface LastRecord {
  date: string
  sets: Set[]
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

export function PlanCreatePage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [lastRecords, setLastRecords] = useState<Map<string, LastRecord>>(new Map())
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

  // 自動スクロール
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  // 前回記録を取得
  const fetchLastRecords = useCallback(async (exerciseNames: string[]): Promise<Map<string, LastRecord>> => {
    const logs = await db.workoutLogs.orderBy('date').reverse().toArray()
    const records = new Map<string, LastRecord>()

    for (const name of exerciseNames) {
      for (const log of logs) {
        const exercise = log.exercises.find(ex => ex.name === name)
        if (exercise) {
          records.set(name, { date: log.date, sets: exercise.sets })
          break
        }
      }
    }
    return records
  }, [])

  // メッセージ送信
  const handleSend = useCallback(async () => {
    if (isLoading) return

    const userMessage = input.trim()
    const messageId = `msg-${Date.now()}`

    // ユーザーメッセージを追加
    const newUserMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: userMessage || '今日のプランをお願いします',
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, newUserMessage])
    setInput('')
    setIsLoading(true)

    try {
      // 過去のメッセージからコンテキストを構築
      const previousMessages = [...messages, newUserMessage]
      const context = previousMessages
        .map(m => m.role === 'user' ? `ユーザー: ${m.content}` : `AI: ${m.content}`)
        .join('\n')

      const prompt = previousMessages.length > 1
        ? `${context}\n\n上記の会話を踏まえて、最新のリクエストに応じたプランを作成してください。`
        : userMessage

      const generatedPlan = await generatePlan(prompt)

      // 前回記録を取得
      const names = generatedPlan.exercises.map(ex => ex.name)
      const records = await fetchLastRecords(names)
      setLastRecords(records)

      // AIメッセージを追加
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: generatedPlan.advice || '以下のプランを提案します！',
        plan: generatedPlan,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, aiMessage])
    } catch (e) {
      // エラーメッセージを追加
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: e instanceof Error ? e.message : String(e),
        isError: true,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, fetchLastRecords])

  // プランを採用してログに登録
  const handleAdopt = useCallback(async (plan: GeneratedPlan) => {
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
  }, [todayLog, today, navigate])

  // 自重種目かどうか判定
  const isBodyweight = useCallback((name: string): boolean => {
    const master = exerciseMasters?.find(m => m.name === name)
    return master?.isBodyweight || false
  }, [exerciseMasters])

  // 有酸素種目かどうか判定
  const isCardio = useCallback((name: string): boolean => {
    const master = exerciseMasters?.find(m => m.name === name)
    return master?.isCardio || false
  }, [exerciseMasters])

  // セットを表示用にフォーマット
  const formatSets = useCallback((sets: Set[], isBw: boolean, isCd: boolean): string => {
    if (isCd) {
      const s = sets[0]
      if (!s) return ''
      if (s.distance) {
        return `${s.duration}分 / ${s.distance}km`
      }
      return `${s.duration}分`
    }

    return sets.map((s) => {
      if (isBw || s.weight === 0) {
        return `${s.reps}回`
      }
      return `${s.weight}kg×${s.reps}回`
    }).join(', ')
  }, [])

  // Enterキーで送信
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  // 最新のプランを持つメッセージのIDを取得
  const latestPlanMessageId = messages
    .filter(m => m.role === 'assistant' && m.plan && !m.isError)
    .slice(-1)[0]?.id

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
    <div className="min-h-screen bg-gray-100 flex flex-col">
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

      {/* メッセージエリア */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-screen-md mx-auto px-4 py-6 space-y-4">
          {/* 初期メッセージ */}
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-700 mb-2">AIトレーナーに相談</h2>
              <p className="text-sm text-gray-500 max-w-xs mx-auto">
                今日の体調やリクエストを伝えると、
                あなたに合ったトレーニングプランを提案します
              </p>
            </div>
          )}

          {/* メッセージ一覧 */}
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'user' ? (
                // ユーザーメッセージ
                <div className="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2">
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              ) : (
                // AIメッセージ
                <div className={`max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 ${
                  message.isError ? 'bg-red-50 border border-red-200' : 'bg-white shadow'
                }`}>
                  <p className={`text-sm whitespace-pre-wrap ${message.isError ? 'text-red-600' : 'text-gray-700'}`}>
                    {message.isError && <span className="font-bold">エラー: </span>}
                    {message.content}
                  </p>

                  {/* プランカード */}
                  {message.plan && (
                    <div className="mt-3 border-t pt-3">
                      <ul className="space-y-3">
                        {message.plan.exercises.map((ex, index) => {
                          const lastRecord = lastRecords.get(ex.name)
                          const isBw = isBodyweight(ex.name)
                          const isCd = isCardio(ex.name)

                          return (
                            <li key={index} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                              <div className="font-medium text-gray-800 text-sm">{ex.name}</div>
                              <div className="text-xs text-gray-600 mt-1">
                                {ex.sets.map((s, i) => (
                                  <span key={i}>
                                    {i > 0 && ', '}
                                    {isBw || s.weight === 0 ? `${s.reps}回` : `${s.weight}kg×${s.reps}回`}
                                  </span>
                                ))}
                              </div>
                              {lastRecord && (
                                <div className="text-xs text-gray-400 mt-1">
                                  前回 ({lastRecord.date}): {formatSets(lastRecord.sets, isBw, isCd)}
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>

                      {/* 採用ボタン（最新のプランのみ） */}
                      {message.id === latestPlanMessageId && (
                        <button
                          onClick={() => handleAdopt(message.plan!)}
                          className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg font-medium text-sm"
                        >
                          このプランを採用する
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* ローディング表示 */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white shadow rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* スクロール用アンカー */}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* 入力エリア */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="max-w-screen-md mx-auto px-4 py-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="今日の体調やリクエストを入力..."
              disabled={isLoading}
              className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
            />
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="bg-blue-600 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center disabled:bg-gray-300"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
