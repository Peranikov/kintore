import { useState, useEffect, useRef, useMemo } from 'react'
import { db } from '../db'
import type { Exercise, Set, ExerciseMaster } from '../types'
import { calculateProgress } from '../utils/progressCalculations'
import { ProgressIndicator } from './ProgressIndicator'

interface LastRecord {
  date: string
  sets: Set[]
}

interface ExerciseFormProps {
  initialExercise?: Exercise
  onSubmit: (exercise: Exercise) => void
  onCancel: () => void
}

export function ExerciseForm({ initialExercise, onSubmit, onCancel }: ExerciseFormProps) {
  const [name, setName] = useState(initialExercise?.name || '')
  const [sets, setSets] = useState<Set[]>(initialExercise?.sets || [{ weight: 0, reps: 0 }])
  const [masterExercises, setMasterExercises] = useState<ExerciseMaster[]>([])
  const [lastRecord, setLastRecord] = useState<LastRecord | null>(null)
  const weightRefs = useRef<(HTMLInputElement | null)[]>([])
  const repsRefs = useRef<(HTMLInputElement | null)[]>([])
  const durationRef = useRef<HTMLInputElement | null>(null)
  const distanceRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    db.exerciseMasters.orderBy('name').toArray().then(setMasterExercises)
  }, [])

  // useMemoで計算 - setStateをeffect内で呼ばない
  const isBodyweight = useMemo(() => {
    if (!name.trim()) return false
    const master = masterExercises.find((ex) => ex.name === name.trim())
    return master?.isBodyweight || false
  }, [name, masterExercises])

  const isCardio = useMemo(() => {
    if (!name.trim()) return false
    const master = masterExercises.find((ex) => ex.name === name.trim())
    return master?.isCardio || false
  }, [name, masterExercises])

  // 前回比較を計算
  const progressComparison = useMemo(() => {
    if (!lastRecord || !sets.length) return null
    // 有効な入力があるかチェック
    const hasValidInput = isCardio
      ? (sets[0]?.duration ?? 0) > 0
      : sets.some(s => (isBodyweight ? s.reps > 0 : (s.weight > 0 || s.reps > 0)))
    if (!hasValidInput) return null
    return calculateProgress(sets, lastRecord.sets, isBodyweight, isCardio)
  }, [sets, lastRecord, isBodyweight, isCardio])

  useEffect(() => {
    // 編集モードまたは名前が空の場合は記録を取得しない
    if (!name.trim() || initialExercise) {
      return
    }

    let cancelled = false

    async function fetchLastRecord() {
      const logs = await db.workoutLogs.orderBy('date').reverse().toArray()
      if (cancelled) return
      for (const log of logs) {
        const exercise = log.exercises.find((ex) => ex.name === name.trim())
        if (exercise) {
          setLastRecord({ date: log.date, sets: exercise.sets })
          return
        }
      }
      if (!cancelled) {
        setLastRecord(null)
      }
    }

    fetchLastRecord()

    return () => {
      cancelled = true
      // クリーンアップ時にnullにリセット
      setLastRecord(null)
    }
  }, [name, initialExercise])

  function handleSetChange(index: number, field: keyof Set, value: number) {
    const newSets = [...sets]
    newSets[index] = { ...newSets[index], [field]: value }
    setSets(newSets)
  }

  function handleAddSet() {
    const lastSet = sets[sets.length - 1]
    const newSets = [...sets, { weight: lastSet?.weight || 0, reps: lastSet?.reps || 0 }]
    setSets(newSets)
    setTimeout(() => {
      if (isBodyweight) {
        repsRefs.current[newSets.length - 1]?.focus()
      } else {
        weightRefs.current[newSets.length - 1]?.focus()
      }
    }, 0)
  }

  function handleRemoveSet(index: number) {
    if (sets.length <= 1) return
    setSets(sets.filter((_, i) => i !== index))
  }

  function handleClearSet(index: number) {
    const newSets = [...sets]
    newSets[index] = { weight: 0, reps: 0 }
    setSets(newSets)
    setTimeout(() => {
      if (isBodyweight) {
        repsRefs.current[index]?.focus()
      } else {
        weightRefs.current[index]?.focus()
      }
    }, 0)
  }

  function handleNameKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (isCardio) {
        durationRef.current?.focus()
      } else if (isBodyweight) {
        repsRefs.current[0]?.focus()
      } else {
        weightRefs.current[0]?.focus()
      }
    }
  }

  function handleDurationKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      distanceRef.current?.focus()
    }
  }

  function handleWeightKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      repsRefs.current[index]?.focus()
    }
  }

  function handleRepsKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const nextIndex = index + 1
      if (nextIndex < sets.length) {
        // 次のセットがある場合はそこにフォーカス
        if (isBodyweight) {
          repsRefs.current[nextIndex]?.focus()
        } else {
          weightRefs.current[nextIndex]?.focus()
        }
      } else {
        // 次のセットがない場合は新規追加
        handleAddSet()
      }
    }
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.select()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      alert('種目名を入力してください')
      return
    }
    if (isCardio) {
      if (!sets[0]?.duration || sets[0].duration <= 0) {
        alert('時間を正しく入力してください')
        return
      }
    } else if (isBodyweight) {
      if (sets.some(s => s.reps <= 0)) {
        alert('回数を正しく入力してください')
        return
      }
    } else {
      if (sets.some(s => s.weight < 0 || s.reps <= 0)) {
        alert('重量と回数を正しく入力してください')
        return
      }
    }

    onSubmit({
      id: initialExercise?.id || crypto.randomUUID(),
      name: name.trim(),
      sets,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">種目名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleNameKeyDown}
          onFocus={handleFocus}
          list="exercise-names"
          className="w-full border rounded px-3 py-2"
          placeholder="種目名を入力..."
        />
        <datalist id="exercise-names">
          {masterExercises.map((ex) => (
            <option key={ex.id} value={ex.name} />
          ))}
        </datalist>
      </div>

      {lastRecord && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-700 font-medium">
              前回の記録（{lastRecord.date}）
            </span>
            <button
              type="button"
              onClick={() => setSets(lastRecord.sets.map((s) => ({ ...s })))}
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
            >
              コピー
            </button>
          </div>
          <div className="text-sm text-blue-600">
            {isCardio ? (
              <span>
                {lastRecord.sets[0]?.duration}分
                {lastRecord.sets[0]?.distance ? ` / ${lastRecord.sets[0].distance}km` : ''}
              </span>
            ) : (
              lastRecord.sets.map((s, i) => (
                <span key={i}>
                  {i > 0 && ' / '}
                  {isBodyweight ? `${s.reps}回` : `${s.weight}kg×${s.reps}`}
                </span>
              ))
            )}
          </div>
          {progressComparison && (
            <div className="mt-2 pt-2 border-t border-blue-200">
              <span className="text-xs text-blue-500 mr-2">前回比:</span>
              <ProgressIndicator comparison={progressComparison} compact />
            </div>
          )}
        </div>
      )}

      {isCardio ? (
        <div>
          <label className="block text-sm font-medium mb-2">記録</label>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 w-12">時間</label>
              <input
                ref={durationRef}
                type="number"
                value={sets[0]?.duration || ''}
                onChange={(e) => {
                  const newSets = [...sets]
                  newSets[0] = { ...newSets[0], duration: Number(e.target.value) }
                  setSets(newSets)
                }}
                onKeyDown={handleDurationKeyDown}
                onFocus={handleFocus}
                className="w-24 border rounded px-2 py-1 text-right"
                placeholder="0"
                min="1"
              />
              <span className="text-sm">分</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 w-12">距離</label>
              <input
                ref={distanceRef}
                type="number"
                value={sets[0]?.distance || ''}
                onChange={(e) => {
                  const newSets = [...sets]
                  newSets[0] = { ...newSets[0], distance: Number(e.target.value) }
                  setSets(newSets)
                }}
                onFocus={handleFocus}
                className="w-24 border rounded px-2 py-1 text-right"
                placeholder="0"
                min="0"
                step="0.1"
              />
              <span className="text-sm">km</span>
              <span className="text-xs text-gray-400">（任意）</span>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-2">セット</label>
          <div className="space-y-2">
            {sets.map((set, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-8">{index + 1}.</span>
                {!isBodyweight && (
                  <>
                    <input
                      ref={(el) => { weightRefs.current[index] = el }}
                      type="number"
                      value={set.weight || ''}
                      onChange={(e) => handleSetChange(index, 'weight', Number(e.target.value))}
                      onKeyDown={(e) => handleWeightKeyDown(e, index)}
                      onFocus={handleFocus}
                      className="w-20 border rounded px-2 py-1 text-right"
                      placeholder="0"
                      min="0"
                      step="0.5"
                    />
                    <span className="text-sm">kg</span>
                    <span className="text-gray-400">×</span>
                  </>
                )}
                <input
                  ref={(el) => { repsRefs.current[index] = el }}
                  type="number"
                  value={set.reps || ''}
                  onChange={(e) => handleSetChange(index, 'reps', Number(e.target.value))}
                  onKeyDown={(e) => handleRepsKeyDown(e, index)}
                  onFocus={handleFocus}
                  className="w-16 border rounded px-2 py-1 text-right"
                  placeholder="0"
                  min="1"
                />
                <span className="text-sm">回</span>
                <button
                  type="button"
                  onClick={() => handleClearSet(index)}
                  className="min-w-11 min-h-11 flex items-center justify-center text-gray-400 hover:text-gray-600"
                  title="クリア"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                {sets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSet(index)}
                    className="min-w-11 min-h-11 flex items-center justify-center text-red-400 hover:text-red-600"
                    title="削除"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddSet}
            className="mt-2 text-blue-600 text-sm hover:underline"
          >
            + セットを追加
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          {initialExercise ? '更新' : '追加'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}
