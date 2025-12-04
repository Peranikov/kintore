import { BottomNav } from '../components/BottomNav'

export function GraphPage() {
  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-xl font-bold">グラフ</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-center">準備中</p>
        </div>
      </main>

      <BottomNav current="graph" />
    </div>
  )
}
