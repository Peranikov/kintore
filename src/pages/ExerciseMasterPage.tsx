import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { BottomNav } from '../components/BottomNav'

export function ExerciseMasterPage() {
  const [newName, setNewName] = useState('')
  const [newIsBodyweight, setNewIsBodyweight] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingIsBodyweight, setEditingIsBodyweight] = useState(false)

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
      createdAt: Date.now(),
    })
    setNewName('')
    setNewIsBodyweight(false)
  }

  async function handleUpdate(id: number) {
    if (!editingName.trim()) return

    const existing = await db.exerciseMasters.where('name').equals(editingName.trim()).first()
    if (existing && existing.id !== id) {
      alert('同じ名前の種目が既に存在します')
      return
    }

    await db.exerciseMasters.update(id, { name: editingName.trim(), isBodyweight: editingIsBodyweight })
    setEditingId(null)
    setEditingName('')
    setEditingIsBodyweight(false)
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
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={newIsBodyweight}
              onChange={(e) => setNewIsBodyweight(e.target.checked)}
              className="rounded"
            />
            自重トレーニング（重量入力なし）
          </label>
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
                          }}
                          className="text-gray-600 text-sm hover:underline"
                        >
                          キャンセル
                        </button>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={editingIsBodyweight}
                          onChange={(e) => setEditingIsBodyweight(e.target.checked)}
                          className="rounded"
                        />
                        自重トレーニング
                      </label>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        <span>{ex.name}</span>
                        {ex.isBodyweight && (
                          <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">自重</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setEditingId(ex.id!)
                            setEditingName(ex.name)
                            setEditingIsBodyweight(ex.isBodyweight || false)
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="編集"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(ex.id!)}
                          className="p-1 text-red-400 hover:text-red-600"
                          title="削除"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
