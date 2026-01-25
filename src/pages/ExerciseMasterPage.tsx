import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { BottomNav } from '../components/BottomNav'
import type { TargetMuscle, MuscleGroup } from '../types'
import { ALL_MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from '../types'
import { getTargetMuscles } from '../db/exerciseMuscleMap'

// 部位選択コンポーネント
function MuscleSelector({
  targetMuscles,
  onChange,
  disabled,
}: {
  targetMuscles: TargetMuscle[]
  onChange: (muscles: TargetMuscle[]) => void
  disabled?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleMuscle = (muscle: MuscleGroup, isMain: boolean) => {
    const existing = targetMuscles.find(t => t.muscle === muscle)
    if (existing) {
      if (existing.isMain === isMain) {
        // 同じ状態ならトグルオフ
        onChange(targetMuscles.filter(t => t.muscle !== muscle))
      } else {
        // メイン/サブを切り替え
        onChange(targetMuscles.map(t => t.muscle === muscle ? { ...t, isMain } : t))
      }
    } else {
      // 新規追加
      onChange([...targetMuscles, { muscle, isMain }])
    }
  }

  const getMuscleState = (muscle: MuscleGroup): 'none' | 'main' | 'sub' => {
    const target = targetMuscles.find(t => t.muscle === muscle)
    if (!target) return 'none'
    return target.isMain ? 'main' : 'sub'
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        disabled={disabled}
      >
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        対象部位を設定 ({targetMuscles.length}部位)
      </button>
      {isExpanded && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-2">
            タップで選択: 1回目=メイン(青) / 2回目=サブ(水色) / 3回目=解除
          </div>
          <div className="flex flex-wrap gap-2">
            {ALL_MUSCLE_GROUPS.map(muscle => {
              const state = getMuscleState(muscle)
              return (
                <button
                  key={muscle}
                  type="button"
                  onClick={() => {
                    if (state === 'none') toggleMuscle(muscle, true)
                    else if (state === 'main') toggleMuscle(muscle, false)
                    else toggleMuscle(muscle, true) // sub -> remove
                  }}
                  disabled={disabled}
                  className={`px-2 py-1 text-sm rounded border transition-colors ${
                    state === 'main'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : state === 'sub'
                      ? 'bg-blue-200 text-blue-800 border-blue-300'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                  }`}
                >
                  {MUSCLE_GROUP_LABELS[muscle]}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function ExerciseMasterPage() {
  const [newName, setNewName] = useState('')
  const [newIsBodyweight, setNewIsBodyweight] = useState(false)
  const [newIsCardio, setNewIsCardio] = useState(false)
  const [newTargetMuscles, setNewTargetMuscles] = useState<TargetMuscle[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingIsBodyweight, setEditingIsBodyweight] = useState(false)
  const [editingIsCardio, setEditingIsCardio] = useState(false)
  const [editingTargetMuscles, setEditingTargetMuscles] = useState<TargetMuscle[]>([])

  const exercises = useLiveQuery(
    () => db.exerciseMasters.orderBy('name').toArray(),
    []
  )

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return

    const existing = await db.exerciseMasters.where('name').equals(newName.trim()).first()
    if (existing) {
      alert('同じ名前の種目が既に存在します')
      return
    }

    // 有酸素運動は部位なし
    const targetMuscles = newIsCardio ? [] : (newTargetMuscles.length > 0 ? newTargetMuscles : getTargetMuscles(newName.trim()))

    await db.exerciseMasters.add({
      name: newName.trim(),
      isBodyweight: newIsBodyweight,
      isCardio: newIsCardio,
      targetMuscles,
      createdAt: Date.now(),
    })
    setNewName('')
    setNewIsBodyweight(false)
    setNewIsCardio(false)
    setNewTargetMuscles([])
  }

  async function handleUpdate(id: number) {
    if (!editingName.trim()) return

    const existing = await db.exerciseMasters.where('name').equals(editingName.trim()).first()
    if (existing && existing.id !== id) {
      alert('同じ名前の種目が既に存在します')
      return
    }

    // 有酸素運動は部位なし
    const targetMuscles = editingIsCardio ? [] : editingTargetMuscles

    await db.exerciseMasters.update(id, {
      name: editingName.trim(),
      isBodyweight: editingIsBodyweight,
      isCardio: editingIsCardio,
      targetMuscles,
    })
    setEditingId(null)
    setEditingName('')
    setEditingIsBodyweight(false)
    setEditingIsCardio(false)
    setEditingTargetMuscles([])
  }

  async function handleDelete(id: number) {
    if (!confirm('この種目を削除しますか？')) return
    await db.exerciseMasters.delete(id)
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-blue-600 text-white p-4 flex items-center">
        <Link to="/settings" className="text-white hover:opacity-80 mr-3">&larr;</Link>
        <h1 className="text-xl font-bold">種目マスタ</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <form onSubmit={handleAdd} className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="種目名を入力..."
              className="flex-1 border rounded-lg px-3 py-2"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              追加
            </button>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={newIsBodyweight}
                onChange={(e) => {
                  setNewIsBodyweight(e.target.checked)
                  if (e.target.checked) setNewIsCardio(false)
                }}
                className="rounded"
              />
              自重トレーニング
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={newIsCardio}
                onChange={(e) => {
                  setNewIsCardio(e.target.checked)
                  if (e.target.checked) {
                    setNewIsBodyweight(false)
                    setNewTargetMuscles([])
                  }
                }}
                className="rounded"
              />
              有酸素運動
            </label>
          </div>
          {!newIsCardio && (
            <MuscleSelector
              targetMuscles={newTargetMuscles}
              onChange={setNewTargetMuscles}
            />
          )}
        </form>

        <section>
          <h2 className="text-lg font-semibold mb-3">登録済み種目</h2>
          {exercises && exercises.length > 0 ? (
            <ul className="bg-white rounded-lg shadow divide-y">
              {exercises.map((ex) => (
                <li key={ex.id} className="p-4">
                  {editingId === ex.id ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 border rounded px-2 py-1"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdate(ex.id!)}
                          className="text-blue-600 text-sm hover:underline"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null)
                            setEditingName('')
                            setEditingIsBodyweight(false)
                            setEditingIsCardio(false)
                            setEditingTargetMuscles([])
                          }}
                          className="text-gray-600 text-sm hover:underline"
                        >
                          キャンセル
                        </button>
                      </div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={editingIsBodyweight}
                            onChange={(e) => {
                              setEditingIsBodyweight(e.target.checked)
                              if (e.target.checked) setEditingIsCardio(false)
                            }}
                            className="rounded"
                          />
                          自重トレーニング
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={editingIsCardio}
                            onChange={(e) => {
                              setEditingIsCardio(e.target.checked)
                              if (e.target.checked) {
                                setEditingIsBodyweight(false)
                                setEditingTargetMuscles([])
                              }
                            }}
                            className="rounded"
                          />
                          有酸素運動
                        </label>
                      </div>
                      {!editingIsCardio && (
                        <MuscleSelector
                          targetMuscles={editingTargetMuscles}
                          onChange={setEditingTargetMuscles}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center flex-wrap gap-1">
                          <span>{ex.name}</span>
                          {ex.isBodyweight && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">自重</span>
                          )}
                          {ex.isCardio && (
                            <span className="text-xs bg-green-200 text-green-700 px-1.5 py-0.5 rounded">有酸素</span>
                          )}
                        </div>
                        {ex.targetMuscles && ex.targetMuscles.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {ex.targetMuscles.map(t => (
                              <span
                                key={t.muscle}
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  t.isMain
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-blue-50 text-blue-500'
                                }`}
                              >
                                {MUSCLE_GROUP_LABELS[t.muscle]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0">
                        <button
                          onClick={() => {
                            setEditingId(ex.id!)
                            setEditingName(ex.name)
                            setEditingIsBodyweight(ex.isBodyweight || false)
                            setEditingIsCardio(ex.isCardio || false)
                            setEditingTargetMuscles(ex.targetMuscles || [])
                          }}
                          className="min-w-11 min-h-11 flex items-center justify-center text-gray-400 hover:text-blue-600"
                          title="編集"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(ex.id!)}
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
            <p className="text-gray-500">種目が登録されていません</p>
          )}
        </section>
      </main>

      <BottomNav current="settings" />
    </div>
  )
}
