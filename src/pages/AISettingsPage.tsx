import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getApiKey, getUserProfile, saveApiKey, saveUserProfile } from '../services/gemini'

export function AISettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [profile, setProfile] = useState('')
  const [savedApiKey, setSavedApiKey] = useState('')
  const [savedProfile, setSavedProfile] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 初期値を読み込み
  useEffect(() => {
    const load = async () => {
      const [key, prof] = await Promise.all([getApiKey(), getUserProfile()])
      if (key) {
        setApiKey(key)
        setSavedApiKey(key)
      }
      if (prof) {
        setProfile(prof)
        setSavedProfile(prof)
      }
    }
    load()
  }, [])

  // 保存
  const handleSave = useCallback(async () => {
    setSaving(true)
    setMessage(null)

    try {
      await Promise.all([
        saveApiKey(apiKey.trim()),
        saveUserProfile(profile.trim()),
      ])
      setSavedApiKey(apiKey.trim())
      setSavedProfile(profile.trim())
      setMessage({ type: 'success', text: '設定を保存しました' })
    } catch (e) {
      setMessage({ type: 'error', text: `保存に失敗しました: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setSaving(false)
    }
  }, [apiKey, profile])

  const hasChanges = apiKey !== savedApiKey || profile !== savedProfile

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-md mx-auto px-4 py-4 flex items-center">
          <Link to="/settings" className="mr-4 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-800">AI設定</h1>
        </div>
      </header>

      <main className="max-w-screen-md mx-auto px-4 py-6 space-y-6">
        {/* APIキー設定 */}
        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="font-bold text-gray-700 mb-3">Gemini APIキー</h2>

          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="APIキーを入力..."
              className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-sm"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              type="button"
            >
              {showApiKey ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Google AI StudioでAPIキーを取得
          </a>
        </section>

        {/* プロフィール設定 */}
        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="font-bold text-gray-700 mb-3">プロフィール</h2>
          <p className="text-sm text-gray-500 mb-3">
            目標、体組成、トレーニング歴などを自由に記述してください。AIがより適切なプランを提案できるようになります。
          </p>

          <textarea
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            rows={6}
            className="w-full border border-gray-300 rounded-lg p-3 text-sm"
            placeholder={`例:
目標: 筋肥大
身長: 175cm、体重: 70kg
体脂肪率: 18%
トレーニング歴: 2年
週3回ジムに通っている
胸と背中を重点的に鍛えたい`}
          />
        </section>

        {/* メッセージ */}
        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 保存ボタン */}
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {saving ? '保存中...' : '設定を保存'}
        </button>

        {/* 説明 */}
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="font-bold text-blue-800 mb-2">AI設定について</h2>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>APIキーはこの端末にのみ保存されます</li>
            <li>プロフィールはAIへのプロンプトに含まれます</li>
            <li>Gemini APIの無料枠は1日1,500リクエストです</li>
          </ul>
        </section>
      </main>
    </div>
  )
}
