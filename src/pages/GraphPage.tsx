import { useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { db } from '../db'
import { BottomNav } from '../components/BottomNav'
import { generateProgressEvaluation, getApiKey } from '../services/gemini'

interface ChartData {
  date: string
  maxWeight: number
  totalVolume: number
  estimated1RM: number
  maxReps: number
  totalReps: number
}

interface ExerciseChartData {
  name: string
  lastDate: string
  data: ChartData[]
  isBodyweight: boolean
}

function calculate1RM(weight: number, reps: number): number {
  if (reps === 0) return 0
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

export function GraphPage() {
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])
  const exerciseMasters = useLiveQuery(() => db.exerciseMasters.toArray(), [])

  const [evaluation, setEvaluation] = useState<string | null>(null)
  const [evaluationLoading, setEvaluationLoading] = useState(false)
  const [evaluationError, setEvaluationError] = useState<string | null>(null)

  const apiKeyExists = useLiveQuery(
    async () => {
      const key = await getApiKey()
      return !!key
    },
    []
  )

  const handleGenerateEvaluation = useCallback(async () => {
    setEvaluationLoading(true)
    setEvaluationError(null)
    setEvaluation(null)

    try {
      const result = await generateProgressEvaluation()
      setEvaluation(result)
    } catch (e) {
      setEvaluationError(e instanceof Error ? e.message : String(e))
    } finally {
      setEvaluationLoading(false)
    }
  }, [])

  const threeMonthsAgo = useMemo(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 3)
    return date.toISOString().split('T')[0]
  }, [])

  const exerciseCharts = useMemo<ExerciseChartData[]>(() => {
    if (!logs || !exerciseMasters) return []

    function isBodyweightExercise(name: string): boolean {
      const master = exerciseMasters?.find((m) => m.name === name)
      return master?.isBodyweight || false
    }

    const exerciseDataMap = new Map<string, Map<string, { maxWeight: number; totalVolume: number; estimated1RM: number; maxReps: number; totalReps: number }>>()

    logs.forEach((log) => {
      log.exercises.forEach((ex) => {
        if (!exerciseDataMap.has(ex.name)) {
          exerciseDataMap.set(ex.name, new Map())
        }
        const dateMap = exerciseDataMap.get(ex.name)!

        const maxWeight = Math.max(...ex.sets.map((s) => s.weight))
        const totalVolume = ex.sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
        const max1RM = Math.max(...ex.sets.map((s) => calculate1RM(s.weight, s.reps)))
        const maxReps = Math.max(...ex.sets.map((s) => s.reps))
        const totalReps = ex.sets.reduce((sum, s) => sum + s.reps, 0)

        const existing = dateMap.get(log.date)
        if (existing) {
          dateMap.set(log.date, {
            maxWeight: Math.max(existing.maxWeight, maxWeight),
            totalVolume: existing.totalVolume + totalVolume,
            estimated1RM: Math.max(existing.estimated1RM, max1RM),
            maxReps: Math.max(existing.maxReps, maxReps),
            totalReps: existing.totalReps + totalReps,
          })
        } else {
          dateMap.set(log.date, { maxWeight, totalVolume, estimated1RM: max1RM, maxReps, totalReps })
        }
      })
    })

    const result: ExerciseChartData[] = []

    exerciseDataMap.forEach((dateMap, name) => {
      const allData = Array.from(dateMap.entries())
        .map(([date, data]) => ({
          date,
          maxWeight: data.maxWeight,
          totalVolume: data.totalVolume,
          estimated1RM: data.estimated1RM,
          maxReps: data.maxReps,
          totalReps: data.totalReps,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      const filteredData = allData.filter((d) => d.date >= threeMonthsAgo)

      if (filteredData.length > 0) {
        const lastDate = filteredData[filteredData.length - 1].date
        result.push({
          name,
          lastDate,
          data: filteredData,
          isBodyweight: isBodyweightExercise(name),
        })
      }
    })

    return result.sort((a, b) => b.lastDate.localeCompare(a.lastDate))
  }, [logs, threeMonthsAgo, exerciseMasters])

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-xl font-bold">グラフ</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {/* AI総合評価セクション */}
        {exerciseCharts.length > 0 && (
          <section className="mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                AI総合評価
              </h2>
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
                  <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                    {evaluation}
                  </p>
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
                      分析中...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      進捗を分析する
                    </>
                  )}
                </button>
              )}
            </div>
          </section>
        )}

        {exerciseCharts.length > 0 ? (
          <div className="space-y-6">
            {exerciseCharts.map((exercise) => (
              <div key={exercise.name} className="bg-white rounded-lg shadow p-4">
                <h2 className="text-base font-semibold mb-3">
                  {exercise.name}
                  {exercise.isBodyweight && (
                    <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">自重</span>
                  )}
                </h2>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    {exercise.isBodyweight ? (
                      <LineChart data={exercise.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => {
                            const [, m, d] = value.split('-')
                            return `${Number(m)}/${Number(d)}`
                          }}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => `${value}`}
                          width={40}
                          unit="回"
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => `${value}`}
                          width={35}
                          unit="回"
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => {
                            if (name === 'maxReps') return [`${value}回`, '最大回数']
                            if (name === 'totalReps') return [`${value}回`, '合計回数']
                            return [value, name]
                          }}
                          labelFormatter={(label) => label}
                        />
                        <Legend
                          formatter={(value) => {
                            if (value === 'maxReps') return '最大回数'
                            if (value === 'totalReps') return '合計回数'
                            return value
                          }}
                          wrapperStyle={{ fontSize: '12px' }}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="maxReps"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ fill: '#2563eb', r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="totalReps"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ fill: '#10b981', r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    ) : (
                      <LineChart data={exercise.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => {
                            const [, m, d] = value.split('-')
                            return `${Number(m)}/${Number(d)}`
                          }}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => `${value}`}
                          width={40}
                          unit="kg"
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                          width={35}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => {
                            if (name === 'maxWeight') return [`${value}kg`, '最大重量']
                            if (name === 'totalVolume') return [`${value.toLocaleString()}kg`, '総ボリューム']
                            if (name === 'estimated1RM') return [`${value}kg`, '推定1RM']
                            return [value, name]
                          }}
                          labelFormatter={(label) => label}
                        />
                        <Legend
                          formatter={(value) => {
                            if (value === 'maxWeight') return '最大重量'
                            if (value === 'totalVolume') return '総ボリューム'
                            if (value === 'estimated1RM') return '推定1RM'
                            return value
                          }}
                          wrapperStyle={{ fontSize: '12px' }}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="maxWeight"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ fill: '#2563eb', r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="totalVolume"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ fill: '#10b981', r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="estimated1RM"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ fill: '#f59e0b', r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 pt-3 border-t space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">最新: {exercise.data[exercise.data.length - 1].date}</span>
                    <span className="text-gray-600">記録数: {exercise.data.length}回</span>
                  </div>
                  {exercise.isBodyweight ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600">最大回数</span>
                        <span className="font-medium">{exercise.data[exercise.data.length - 1].maxReps}回</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-600">合計回数</span>
                        <span className="font-medium">{exercise.data[exercise.data.length - 1].totalReps}回</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600">最大重量</span>
                        <span className="font-medium">{exercise.data[exercise.data.length - 1].maxWeight}kg</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-amber-600">推定1RM</span>
                        <span className="font-medium">{exercise.data[exercise.data.length - 1].estimated1RM}kg</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-600">総ボリューム</span>
                        <span className="font-medium">{exercise.data[exercise.data.length - 1].totalVolume.toLocaleString()}kg</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-500 text-center">
              直近3ヶ月のトレーニング記録がありません
            </p>
          </div>
        )}
      </main>

      <BottomNav current="graph" />
    </div>
  )
}
