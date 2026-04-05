import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BottomNav } from '../components/BottomNav'
import { bottomNavPagePaddingStyle } from '../components/bottomNavStyles'
import { seedSampleData, clearAllData } from '../utils/seedData'
import { useFeedback } from '../components/feedback'
import { db } from '../db'

const isDev = import.meta.env.DEV

export function SettingsPage() {
  const { showToast, confirm } = useFeedback()
  const logCount = useLiveQuery(() => db.workoutLogs.count(), [])

  async function handleSeedSampleData() {
    if ((logCount || 0) > 0) {
      const confirmed = await confirm({
        title: '既存のデータがあります。サンプルデータを追加しますか？',
        confirmLabel: '追加する',
        cancelLabel: 'キャンセル',
      })
      if (!confirmed) return
    }

    const count = await seedSampleData()
    showToast(`${count}件のサンプルデータを追加しました`, 'success')
  }

  async function handleClearAllData() {
    const confirmed = await confirm({
      title: 'すべてのデータを削除しますか？',
      message: 'この操作は取り消せません。',
      confirmLabel: '削除する',
      cancelLabel: 'キャンセル',
      tone: 'danger',
    })
    if (!confirmed) return

    await clearAllData()
    showToast('すべてのデータを削除しました', 'success')
  }

  return (
    <div
      className="min-h-screen bg-gray-100"
      style={bottomNavPagePaddingStyle}
    >
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-xl font-bold">設定</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <div className="bg-white rounded-lg shadow divide-y">
          <Link
            to="/exercises"
            className="flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <span>種目マスタ</span>
            <span className="text-gray-400">&rarr;</span>
          </Link>
          <Link
            to="/export"
            className="flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <span>トレーニング記録のエクスポート</span>
            <span className="text-gray-400">&rarr;</span>
          </Link>
          <Link
            to="/import"
            className="flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <span>トレーニング記録のインポート</span>
            <span className="text-gray-400">&rarr;</span>
          </Link>
          <Link
            to="/ai-settings"
            className="flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <span>AI設定</span>
            <span className="text-gray-400">&rarr;</span>
          </Link>
        </div>

        {isDev && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-gray-500 mb-2">開発用</h2>
            <div className="bg-white rounded-lg shadow divide-y">
              <Link
                to="/gemini-test"
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <span>Gemini API テスト</span>
                <span className="text-gray-400">&rarr;</span>
              </Link>
              <button
                onClick={handleSeedSampleData}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left"
              >
                <span>サンプルデータを追加</span>
                <span className="text-gray-400">&rarr;</span>
              </button>
              <button
                onClick={handleClearAllData}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left text-red-600"
              >
                <span>すべてのデータを削除</span>
                <span className="text-gray-400">&rarr;</span>
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNav current="settings" />
    </div>
  )
}
