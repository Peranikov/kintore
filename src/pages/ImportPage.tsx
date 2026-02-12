import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db'
import { BottomNav } from '../components/BottomNav'
import { parseExportMarkdown, type ParseResult } from '../utils/importParser'
import type { WorkoutLog } from '../types'
import { EXERCISE_MUSCLE_MAP } from '../db/exerciseMuscleMap'

export function ImportPage() {
  const [text, setText] = useState('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [duplicateDates, setDuplicateDates] = useState<string[]>([])
  const [skipDuplicates, setSkipDuplicates] = useState(true)

  async function handleParse() {
    setParseError('')
    setParseResult(null)
    setDuplicateDates([])

    if (!text.trim()) {
      setParseError('テキストを入力してください')
      return
    }

    const result = parseExportMarkdown(text)
    if (result.logs.length === 0) {
      setParseError('トレーニング記録が見つかりませんでした。エクスポート形式のMarkdownを貼り付けてください。')
      return
    }

    // 重複チェック
    const dates = result.logs.map((l) => l.date)
    const existingLogs = await db.workoutLogs
      .where('date')
      .anyOf(dates)
      .toArray()
    const existingDates = existingLogs.map((l) => l.date)
    setDuplicateDates(existingDates)

    setParseResult(result)
  }

  async function handleImport() {
    if (!parseResult) return
    setImporting(true)

    try {
      // 種目マスタの追加
      const existingMasters = await db.exerciseMasters.toArray()
      const existingNames = new Set(existingMasters.map((m) => m.name))
      const now = Date.now()

      for (const ex of parseResult.exercises) {
        if (!existingNames.has(ex.name)) {
          const targetMuscles = EXERCISE_MUSCLE_MAP[ex.name]
          await db.exerciseMasters.add({
            name: ex.name,
            isBodyweight: ex.isBodyweight || undefined,
            isCardio: ex.isCardio || undefined,
            targetMuscles: targetMuscles && targetMuscles.length > 0 ? targetMuscles : undefined,
            createdAt: now,
          })
        }
      }

      // 重複日のログを処理
      let logsToImport = parseResult.logs
      if (duplicateDates.length > 0) {
        if (skipDuplicates) {
          logsToImport = logsToImport.filter((l) => !duplicateDates.includes(l.date))
        } else {
          // 上書き: 既存のログを削除
          const existingLogs = await db.workoutLogs
            .where('date')
            .anyOf(duplicateDates)
            .toArray()
          const idsToDelete = existingLogs.map((l) => l.id!).filter(Boolean)
          await db.workoutLogs.bulkDelete(idsToDelete)
        }
      }

      if (logsToImport.length > 0) {
        await db.workoutLogs.bulkAdd(logsToImport as WorkoutLog[])
      }

      alert(`${logsToImport.length}件のトレーニング記録をインポートしました`)
      setText('')
      setParseResult(null)
      setDuplicateDates([])
    } catch (e) {
      alert(`インポートに失敗しました: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setImporting(false)
    }
  }

  const totalSets = parseResult?.logs.reduce(
    (sum, log) => sum + log.exercises.reduce((s, ex) => s + ex.sets.length, 0),
    0,
  ) ?? 0

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-blue-600 text-white p-4 flex items-center">
        <Link to="/settings" className="text-white hover:opacity-80 mr-3">&larr;</Link>
        <h1 className="text-xl font-bold">インポート</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <label className="block text-sm font-medium mb-2">
            エクスポートしたテキストを貼り付け
          </label>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setParseResult(null)
              setParseError('')
            }}
            placeholder="# トレーニング記録 ..."
            className="w-full h-48 border rounded p-3 text-sm font-mono resize-none"
          />
          {parseError && (
            <p className="text-red-600 text-sm mt-2">{parseError}</p>
          )}
        </div>

        <button
          onClick={handleParse}
          disabled={!text.trim()}
          className={`w-full py-3 rounded-lg font-medium mb-4 ${
            text.trim()
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          解析する
        </button>

        {parseResult && (
          <>
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <h2 className="text-sm font-medium mb-3">解析結果</h2>
              <div className="grid grid-cols-3 gap-3 text-center mb-3">
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-2xl font-bold text-blue-600">{parseResult.logs.length}</div>
                  <div className="text-xs text-gray-500">日分</div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-2xl font-bold text-blue-600">{parseResult.exercises.length}</div>
                  <div className="text-xs text-gray-500">種目</div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-2xl font-bold text-blue-600">{totalSets}</div>
                  <div className="text-xs text-gray-500">セット</div>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {parseResult.logs.map((log) => (
                  <div key={log.date} className="border rounded p-2 text-sm">
                    <div className="font-medium flex items-center gap-2">
                      {log.date}
                      {duplicateDates.includes(log.date) && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">重複</span>
                      )}
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">
                      {log.exercises.map((ex) => ex.name).join('、')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {duplicateDates.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800 mb-2">
                  {duplicateDates.length}件の日付が既存データと重複しています
                </p>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      checked={skipDuplicates}
                      onChange={() => setSkipDuplicates(true)}
                    />
                    スキップ
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      checked={!skipDuplicates}
                      onChange={() => setSkipDuplicates(false)}
                    />
                    上書き
                  </label>
                </div>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={importing}
              className={`w-full py-3 rounded-lg font-medium ${
                importing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {importing ? 'インポート中...' : 'インポートする'}
            </button>
          </>
        )}
      </main>

      <BottomNav current="settings" />
    </div>
  )
}
