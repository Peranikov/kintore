import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { BottomNav } from '../components/BottomNav'

export function ExerciseMasterPage() {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')

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
      createdAt: Date.now(),
    })
    setNewName('')
  }

  async function handleUpdate(id: number) {
    if (!editingName.trim()) return

    const existing = await db.exerciseMasters.where('name').equals(editingName.trim()).first()
    if (existing && existing.id !== id) {
      alert('同じ名前の種目が既に存在します')
      return
    }

    await db.exerciseMasters.update(id, { name: editingName.trim() })
    setEditingId(null)
    setEditingName('')
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
        <form onSubmit={handleAdd} className="mb-6">
          <div className="flex gap-2">
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
        </form>

        <section>
          <h2 className="text-lg font-semibold mb-3">登録済み種目</h2>
          {exercises && exercises.length > 0 ? (
            <ul className="bg-white rounded-lg shadow divide-y">
              {exercises.map((ex) => (
                <li key={ex.id} className="p-4">
                  {editingId === ex.id ? (
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
                        }}
                        className="text-gray-600 text-sm hover:underline"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span>{ex.name}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingId(ex.id!)
                            setEditingName(ex.name)
                          }}
                          className="text-blue-600 text-sm hover:underline"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(ex.id!)}
                          className="text-red-600 text-sm hover:underline"
                        >
                          削除
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
