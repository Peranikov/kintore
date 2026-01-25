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
  const [currentPlan, setCurrentPlan] = useState<GeneratedPlan | null>(null)
  const [lastRecords, setLastRecords] = useState<Map<string, LastRecord>>(new Map())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
    const trimmedInput = input.trim()
    if (!trimmedInput || isLoading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedInput,
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // 過去のメッセージからコンテキストを構築
      const previousContext = messages
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join('\n')

      const fullMemo = previousContext
        ? `${previousContext}\n\n【追加の指示】\n${trimmedInput}`
        : trimmedInput

      const generatedPlan = await generatePlan(fullMemo)
      setCurrentPlan(generatedPlan)

      // 前回記録を取得
      const names = generatedPlan.exercises.map(ex => ex.name)
      const records = await fetchLastRecords(names)
      setLastRecords(records)

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: generatedPlan.advice || 'トレーニングプランを作成しました。',
        plan: generatedPlan,
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (e) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: e instanceof Error ? e.message : String(e),
        isError: true,
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, fetchLastRecords])

  // Enterキーで送信
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  // プランを採用
  const handleAdopt = useCallback(async () => {
    if (!currentPlan) return

    const now = Date.now()

    const exercises: Exercise[] = currentPlan.exercises.map((ex, index) => ({
      id: `${now}-${index}`,
      name: ex.name,
      sets: ex.sets.map(s => ({
        weight: s.weight,
        reps: s.reps,
      })),
    }))

    if (todayLog) {
      const updated: WorkoutLog = {
        ...todayLog,
        exercises: [...todayLog.exercises, ...exercises],
        updatedAt: now,
      }
      await db.workoutLogs.put(updated)
      navigate(`/log/${todayLog.id}`)
    } else {
      const newLog: WorkoutLog = {
        date: today,
        exercises,
        memo: currentPlan.advice,
        createdAt: now,
        updatedAt: now,
      }
      const id = await db.workoutLogs.add(newLog)
      navigate(`/log/${id}`)
    }
  }, [currentPlan, todayLog, today, navigate])

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
    <div className="h-screen flex flex-col bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm flex-shrink-0">
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
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-md mx-auto px-4 py-4 space-y-4">
          {/* 初期メッセージ */}
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-8 text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">今日のトレーニングプランを作成します</p>
              <p className="text-xs mt-2 text-gray-400">
                体調やリクエストを入力してください
              </p>
            </div>
          )}

          {/* メッセージ一覧 */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : message.isError
                    ? 'bg-red-100 text-red-700 rounded-bl-md'
                    : 'bg-white text-gray-800 shadow rounded-bl-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                {/* プラン表示 */}
                {message.plan && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <ul className="space-y-2">
                      {message.plan.exercises.map((ex, index) => {
                        const lastRecord = lastRecords.get(ex.name)
                        const isBw = isBodyweight(ex.name)
                        const isCd = isCardio(ex.name)

                        return (
                          <li key={index} className="text-sm">
                            <div className="font-medium">{ex.name}</div>
                            <div className="text-gray-600">
                              {ex.sets.map((s, i) => (
                                <span key={i}>
                                  {i > 0 && ', '}
                                  {isBw || s.weight === 0 ? `${s.reps}回` : `${s.weight}kg×${s.reps}回`}
                                </span>
                              ))}
                            </div>
                            {lastRecord && (
                              <div className="text-xs text-gray-400">
                                前回 ({lastRecord.date}): {formatSets(lastRecord.sets, isBw, isCd)}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* ローディング */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-800 shadow rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* プラン採用ボタン */}
      {currentPlan && !isLoading && (
        <div className="bg-white border-t px-4 py-3">
          <div className="max-w-screen-md mx-auto">
            <button
              onClick={handleAdopt}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              このプランを採用する
            </button>
          </div>
        </div>
      )}

      {/* 入力エリア */}
      <div className="bg-white border-t px-4 py-3 flex-shrink-0">
        <div className="max-w-screen-md mx-auto flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
            placeholder={messages.length === 0 ? "例: 胸を鍛えたい、30分で終わるメニュー" : "修正指示を入力..."}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-full disabled:bg-gray-300 disabled:cursor-not-allowed flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
