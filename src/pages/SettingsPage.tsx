import { Link } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { seedSampleData, clearAllData } from '../utils/seedData'

const isDev = import.meta.env.DEV

export function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-100 pb-20">
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
        </div>

        {isDev && (
          <div className="mt-6">
            <h2 className="text-sm font-medium text-gray-500 mb-2">開発用</h2>
            <div className="bg-white rounded-lg shadow divide-y">
              <button
                onClick={() => seedSampleData()}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left"
              >
                <span>サンプルデータを追加</span>
                <span className="text-gray-400">&rarr;</span>
              </button>
              <button
                onClick={() => clearAllData()}
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
