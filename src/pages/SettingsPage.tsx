import { Link } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'

export function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-xl font-bold">設定</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <div className="bg-white rounded-lg shadow">
          <Link
            to="/exercises"
            className="flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <span>種目マスタ</span>
            <span className="text-gray-400">&rarr;</span>
          </Link>
        </div>
      </main>

      <BottomNav current="settings" />
    </div>
  )
}
