import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { WorkoutLog, ExerciseMaster } from '../types'
import { BottomNav } from '../components/BottomNav'

function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getMonthStart(date: Date): string {
  return formatDateString(new Date(date.getFullYear(), date.getMonth(), 1))
}

function getMonthsAgo(months: number): string {
  const date = new Date()
  date.setMonth(date.getMonth() - months)
  return formatDateString(new Date(date.getFullYear(), date.getMonth(), 1))
}

function generateExportText(
  logs: WorkoutLog[],
  startDate: string,
  endDate: string,
  exerciseMasters: ExerciseMaster[]
): string {
  if (logs.length === 0) return ''

  function isBodyweightExercise(name: string): boolean {
    const master = exerciseMasters.find((m) => m.name === name)
    return master?.isBodyweight || false
  }

  const lines: string[] = []
  lines.push(`# トレーニング記録 ${startDate} 〜 ${endDate}`)
  lines.push('')

  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date))

  sortedLogs.forEach((log, index) => {
    lines.push(`## ${log.date}`)
    lines.push('')

    log.exercises.forEach((ex) => {
      const bodyweight = isBodyweightExercise(ex.name)
      lines.push(`### ${ex.name}`)
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
      lines.push('#### メモ')
      lines.push(log.memo)
      lines.push('')
    }

    if (index < sortedLogs.length - 1) {
      lines.push('---')
      lines.push('')
    }
  })

  return lines.join('\n')
}

export function ExportPage() {
  const today = formatDateString(new Date())
  const [startDate, setStartDate] = useState(getMonthStart(new Date()))
  const [endDate, setEndDate] = useState(today)

  const logs = useLiveQuery(
    async () => {
      return await db.workoutLogs
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray()
    },
    [startDate, endDate]
  )

  const exerciseMasters = useLiveQuery(
    () => db.exerciseMasters.toArray(),
    []
  )

  const exportText = useMemo(() => {
    if (!logs || logs.length === 0 || !exerciseMasters) return ''
    return generateExportText(logs, startDate, endDate, exerciseMasters)
  }, [logs, startDate, endDate, exerciseMasters])

  function handleQuickSelect(months: number) {
    if (months === 0) {
      setStartDate(getMonthStart(new Date()))
    } else {
      setStartDate(getMonthsAgo(months))
    }
    setEndDate(today)
  }

  async function handleCopy() {
    if (!exportText) return

    if (navigator.share) {
      try {
        await navigator.share({
          title: `トレーニング記録 ${startDate} 〜 ${endDate}`,
          text: exportText,
        })
      } catch {
        copyToClipboard()
      }
    } else {
      copyToClipboard()
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(exportText).then(() => {
      alert('クリップボードにコピーしました')
    })
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-blue-600 text-white p-4 flex items-center">
        <Link to="/settings" className="text-white hover:opacity-80 mr-3">&larr;</Link>
        <h1 className="text-xl font-bold">エクスポート</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <label className="block text-sm font-medium mb-2">期間を選択</label>
          <div className="flex gap-2 mb-3">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 border rounded px-3 py-2"
            />
            <span className="flex items-center text-gray-500">〜</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 border rounded px-3 py-2"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleQuickSelect(0)}
              className="flex-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
            >
              今月
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(3)}
              className="flex-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
            >
              3ヶ月
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(6)}
              className="flex-1 px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
            >
              6ヶ月
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium">プレビュー</label>
            <span className="text-sm text-gray-500">
              {logs ? `${logs.length}件` : '0件'}
            </span>
          </div>
          {exportText ? (
            <textarea
              value={exportText}
              readOnly
              className="w-full h-64 border rounded p-3 text-sm font-mono bg-gray-50 resize-none"
            />
          ) : (
            <div className="h-64 border rounded p-3 flex items-center justify-center text-gray-500">
              選択期間にトレーニング記録がありません
            </div>
          )}
        </div>

        <button
          onClick={handleCopy}
          disabled={!exportText}
          className={`w-full py-3 rounded-lg font-medium ${
            exportText
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          コピーする
        </button>
      </main>

      <BottomNav current="settings" />
    </div>
  )
}
