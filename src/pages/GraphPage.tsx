import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { db } from '../db'
import { BottomNav } from '../components/BottomNav'

interface ChartData {
  date: string
  maxWeight: number
  totalVolume: number
}

interface ExerciseChartData {
  name: string
  lastDate: string
  data: ChartData[]
}

export function GraphPage() {
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), [])

  const threeMonthsAgo = useMemo(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 3)
    return date.toISOString().split('T')[0]
  }, [])

  const exerciseCharts = useMemo<ExerciseChartData[]>(() => {
    if (!logs) return []

    const exerciseDataMap = new Map<string, Map<string, { maxWeight: number; totalVolume: number }>>()

    logs.forEach((log) => {
      log.exercises.forEach((ex) => {
        if (!exerciseDataMap.has(ex.name)) {
          exerciseDataMap.set(ex.name, new Map())
        }
        const dateMap = exerciseDataMap.get(ex.name)!

        const maxWeight = Math.max(...ex.sets.map((s) => s.weight))
        const totalVolume = ex.sets.reduce((sum, s) => sum + s.weight * s.reps, 0)

        const existing = dateMap.get(log.date)
        if (existing) {
          dateMap.set(log.date, {
            maxWeight: Math.max(existing.maxWeight, maxWeight),
            totalVolume: existing.totalVolume + totalVolume,
          })
        } else {
          dateMap.set(log.date, { maxWeight, totalVolume })
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
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      const filteredData = allData.filter((d) => d.date >= threeMonthsAgo)

      if (filteredData.length > 0) {
        const lastDate = filteredData[filteredData.length - 1].date
        result.push({
          name,
          lastDate,
          data: filteredData,
        })
      }
    })

    return result.sort((a, b) => b.lastDate.localeCompare(a.lastDate))
  }, [logs, threeMonthsAgo])

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-xl font-bold">グラフ</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        {exerciseCharts.length > 0 ? (
          <div className="space-y-6">
            {exerciseCharts.map((exercise) => (
              <div key={exercise.name} className="bg-white rounded-lg shadow p-4">
                <h2 className="text-base font-semibold mb-3">{exercise.name}</h2>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
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
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => `${value}`}
                        width={35}
                        unit="kg"
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value}kg`, '最大重量']}
                        labelFormatter={(label) => label}
                      />
                      <Line
                        type="monotone"
                        dataKey="maxWeight"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={{ fill: '#2563eb', r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>最新: {exercise.data[exercise.data.length - 1].date}</span>
                    <span className="font-medium text-gray-900">
                      {exercise.data[exercise.data.length - 1].maxWeight}kg
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 mt-1">
                    <span>記録数</span>
                    <span>{exercise.data.length}回</span>
                  </div>
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
