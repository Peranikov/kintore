import { useState, useEffect, useRef } from 'react'
import { db } from '../db'
import type { Exercise, Set, ExerciseMaster } from '../types'

interface ExerciseFormProps {
  initialExercise?: Exercise
  onSubmit: (exercise: Exercise) => void
  onCancel: () => void
}

export function ExerciseForm({ initialExercise, onSubmit, onCancel }: ExerciseFormProps) {
  const [name, setName] = useState(initialExercise?.name || '')
  const [sets, setSets] = useState<Set[]>(initialExercise?.sets || [{ weight: 0, reps: 0 }])
  const [masterExercises, setMasterExercises] = useState<ExerciseMaster[]>([])
  const weightRefs = useRef<(HTMLInputElement | null)[]>([])
  const repsRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    db.exerciseMasters.orderBy('name').toArray().then(setMasterExercises)
  }, [])

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
      weightRefs.current[newSets.length - 1]?.focus()
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
      weightRefs.current[index]?.focus()
    }, 0)
  }

  function handleNameKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      weightRefs.current[0]?.focus()
    }
  }

  function handleWeightKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      repsRefs.current[index]?.focus()
    }
  }

  function handleRepsKeyDown(e: React.KeyboardEvent, _index: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddSet()
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      alert('種目名を入力してください')
      return
    }
    if (sets.some(s => s.weight < 0 || s.reps <= 0)) {
      alert('重量と回数を正しく入力してください')
      return
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

      <div>
        <label className="block text-sm font-medium mb-2">セット</label>
        <div className="space-y-2">
          {sets.map((set, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-sm text-gray-500 w-8">{index + 1}.</span>
              <input
                ref={(el) => { weightRefs.current[index] = el }}
                type="number"
                value={set.weight || ''}
                onChange={(e) => handleSetChange(index, 'weight', Number(e.target.value))}
                onKeyDown={(e) => handleWeightKeyDown(e, index)}
                className="w-20 border rounded px-2 py-1 text-right"
                placeholder="0"
                min="0"
                step="0.5"
              />
              <span className="text-sm">kg</span>
              <span className="text-gray-400">×</span>
              <input
                ref={(el) => { repsRefs.current[index] = el }}
                type="number"
                value={set.reps || ''}
                onChange={(e) => handleSetChange(index, 'reps', Number(e.target.value))}
                onKeyDown={(e) => handleRepsKeyDown(e, index)}
                className="w-16 border rounded px-2 py-1 text-right"
                placeholder="0"
                min="1"
              />
              <span className="text-sm">回</span>
              <button
                type="button"
                onClick={() => handleClearSet(index)}
                className="text-gray-500 text-sm hover:text-gray-700"
              >
                クリア
              </button>
              {sets.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveSet(index)}
                  className="text-red-500 text-sm hover:text-red-700"
                >
                  削除
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
