import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { BottomNav } from '../components/BottomNav'
import { EXERCISE_BODY_PARTS, EXERCISE_CATEGORIES } from '../utils/exerciseMetadata'
import type { ExerciseBodyPart, ExerciseCategory } from '../types'

function getNextMetadata(
  isBodyweight: boolean,
  isCardio: boolean,
  currentBodyPart: ExerciseBodyPart | '',
  currentCategory: ExerciseCategory | ''
) {
  if (isCardio) {
    return { bodyPart: '有酸素' as const, category: '有酸素' as const }
  }

  if (isBodyweight) {
    return {
      bodyPart: currentBodyPart,
      category: currentCategory === '有酸素' || !currentCategory ? '自重' as const : currentCategory,
    }
  }

  return {
    bodyPart: currentBodyPart === '有酸素' ? '' : currentBodyPart,
    category: currentCategory === '有酸素' || currentCategory === '自重' ? '' : currentCategory,
  }
}

export function ExerciseMasterPage() {
  const [newName, setNewName] = useState('')
  const [newIsBodyweight, setNewIsBodyweight] = useState(false)
  const [newIsCardio, setNewIsCardio] = useState(false)
  const [newBodyPart, setNewBodyPart] = useState<ExerciseBodyPart | ''>('')
  const [newCategory, setNewCategory] = useState<ExerciseCategory | ''>('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingIsBodyweight, setEditingIsBodyweight] = useState(false)
  const [editingIsCardio, setEditingIsCardio] = useState(false)
  const [editingBodyPart, setEditingBodyPart] = useState<ExerciseBodyPart | ''>('')
  const [editingCategory, setEditingCategory] = useState<ExerciseCategory | ''>('')

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

    await db.exerciseMasters.add({
      name: newName.trim(),
      isBodyweight: newIsBodyweight,
      isCardio: newIsCardio,
      bodyPart: newBodyPart || undefined,
      category: newCategory || undefined,
      createdAt: Date.now(),
    })
    setNewName('')
    setNewIsBodyweight(false)
    setNewIsCardio(false)
    setNewBodyPart('')
    setNewCategory('')
  }

  async function handleUpdate(id: number) {
    if (!editingName.trim()) return

    const existing = await db.exerciseMasters.where('name').equals(editingName.trim()).first()
    if (existing && existing.id !== id) {
      alert('同じ名前の種目が既に存在します')
      return
    }

    await db.exerciseMasters.update(id, {
      name: editingName.trim(),
      isBodyweight: editingIsBodyweight,
      isCardio: editingIsCardio,
      bodyPart: editingBodyPart || undefined,
      category: editingCategory || undefined,
    })
    setEditingId(null)
    setEditingName('')
    setEditingIsBodyweight(false)
    setEditingIsCardio(false)
    setEditingBodyPart('')
    setEditingCategory('')
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
                  const nextIsBodyweight = e.target.checked
                  const nextIsCardio = nextIsBodyweight ? false : newIsCardio
                  const nextMetadata = getNextMetadata(nextIsBodyweight, nextIsCardio, newBodyPart, newCategory)
                  setNewIsBodyweight(nextIsBodyweight)
                  setNewIsCardio(nextIsCardio)
                  setNewBodyPart(nextMetadata.bodyPart)
                  setNewCategory(nextMetadata.category)
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
                  const nextIsCardio = e.target.checked
                  const nextIsBodyweight = nextIsCardio ? false : newIsBodyweight
                  const nextMetadata = getNextMetadata(nextIsBodyweight, nextIsCardio, newBodyPart, newCategory)
                  setNewIsCardio(nextIsCardio)
                  setNewIsBodyweight(nextIsBodyweight)
                  setNewBodyPart(nextMetadata.bodyPart)
                  setNewCategory(nextMetadata.category)
                }}
                className="rounded"
              />
              有酸素運動
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm text-gray-600">対象部位</span>
              <select
                value={newBodyPart}
                onChange={(e) => setNewBodyPart(e.target.value as ExerciseBodyPart | '')}
                disabled={newIsCardio}
                className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">未設定</option>
                {EXERCISE_BODY_PARTS.map((bodyPart) => (
                  <option key={bodyPart} value={bodyPart}>
                    {bodyPart}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-gray-600">カテゴリ</span>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ExerciseCategory | '')}
                disabled={newIsCardio}
                className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">未設定</option>
                {EXERCISE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </form>

        <section>
          <h2 className="text-lg font-semibold mb-3">登録済み種目</h2>
          {exercises && exercises.length > 0 ? (
            <ul className="bg-white rounded-lg shadow divide-y">
              {exercises.map((ex) => (
                <li key={ex.id} className="p-4">
                  {editingId === ex.id ? (
                    <div className="space-y-3">
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
                            setEditingBodyPart('')
                            setEditingCategory('')
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
                              const nextIsBodyweight = e.target.checked
                              const nextIsCardio = nextIsBodyweight ? false : editingIsCardio
                              const nextMetadata = getNextMetadata(nextIsBodyweight, nextIsCardio, editingBodyPart, editingCategory)
                              setEditingIsBodyweight(nextIsBodyweight)
                              setEditingIsCardio(nextIsCardio)
                              setEditingBodyPart(nextMetadata.bodyPart)
                              setEditingCategory(nextMetadata.category)
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
                              const nextIsCardio = e.target.checked
                              const nextIsBodyweight = nextIsCardio ? false : editingIsBodyweight
                              const nextMetadata = getNextMetadata(nextIsBodyweight, nextIsCardio, editingBodyPart, editingCategory)
                              setEditingIsCardio(nextIsCardio)
                              setEditingIsBodyweight(nextIsBodyweight)
                              setEditingBodyPart(nextMetadata.bodyPart)
                              setEditingCategory(nextMetadata.category)
                            }}
                            className="rounded"
                          />
                          有酸素運動
                        </label>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-sm text-gray-600">対象部位</span>
                          <select
                            value={editingBodyPart}
                            onChange={(e) => setEditingBodyPart(e.target.value as ExerciseBodyPart | '')}
                            disabled={editingIsCardio}
                            className="w-full rounded border px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                          >
                            <option value="">未設定</option>
                            {EXERCISE_BODY_PARTS.map((bodyPart) => (
                              <option key={bodyPart} value={bodyPart}>
                                {bodyPart}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-sm text-gray-600">カテゴリ</span>
                          <select
                            value={editingCategory}
                            onChange={(e) => setEditingCategory(e.target.value as ExerciseCategory | '')}
                            disabled={editingIsCardio}
                            className="w-full rounded border px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                          >
                            <option value="">未設定</option>
                            {EXERCISE_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
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
                          {ex.bodyPart && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{ex.bodyPart}</span>
                          )}
                          {ex.category && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{ex.category}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0">
                        <button
                          onClick={() => {
                            setEditingId(ex.id!)
                            setEditingName(ex.name)
                            setEditingIsBodyweight(ex.isBodyweight || false)
                            setEditingIsCardio(ex.isCardio || false)
                            setEditingBodyPart(ex.bodyPart || '')
                            setEditingCategory(ex.category || '')
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
