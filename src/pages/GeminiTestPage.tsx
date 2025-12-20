import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db'

type Status = 'idle' | 'loading' | 'ready' | 'generating' | 'error'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export function GeminiTestPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [apiKey, setApiKey] = useState('')
  const [savedApiKey, setSavedApiKey] = useState('')
  const [prompt, setPrompt] = useState('筋トレ初心者へのアドバイスを3つ教えてください。')
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  // APIキーを読み込み
  useEffect(() => {
    const loadApiKey = async () => {
      const setting = await db.appSettings.where('key').equals('geminiApiKey').first()
      if (setting) {
        setApiKey(setting.value)
        setSavedApiKey(setting.value)
        setStatus('ready')
      }
    }
    loadApiKey()
  }, [])

  // APIキーを保存
  const saveApiKey = useCallback(async () => {
    if (!apiKey.trim()) {
      setError('APIキーを入力してください')
      return
    }

    try {
      const existing = await db.appSettings.where('key').equals('geminiApiKey').first()
      if (existing) {
        await db.appSettings.update(existing.id!, { value: apiKey.trim() })
      } else {
        await db.appSettings.add({ key: 'geminiApiKey', value: apiKey.trim() })
      }
      setSavedApiKey(apiKey.trim())
      setStatus('ready')
      setError('')
    } catch (e) {
      setError(String(e))
    }
  }, [apiKey])

  // APIキーを削除
  const deleteApiKey = useCallback(async () => {
    try {
      await db.appSettings.where('key').equals('geminiApiKey').delete()
      setApiKey('')
      setSavedApiKey('')
      setStatus('idle')
      setResponse('')
    } catch (e) {
      setError(String(e))
    }
  }, [])

  // Gemini APIを呼び出し
  const generate = useCallback(async () => {
    if (!savedApiKey) {
      setError('APIキーを保存してください')
      return
    }

    setStatus('generating')
    setResponse('')
    setError('')

    try {
      const systemPrompt = 'あなたはフィットネスの専門家です。筋トレに関する質問に日本語で簡潔に答えてください。'

      const res = await fetch(`${GEMINI_API_URL}?key=${savedApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `${systemPrompt}\n\n質問: ${prompt}` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error?.message || `HTTP ${res.status}`)
      }

      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '応答がありません'
      setResponse(text)
      setStatus('ready')
    } catch (e) {
      setError(String(e))
      setStatus('error')
    }
  }, [savedApiKey, prompt])

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
          <h1 className="text-xl font-bold text-gray-800">Gemini API テスト</h1>
        </div>
      </header>

      <main className="max-w-screen-md mx-auto px-4 py-6 space-y-6">
        {/* APIキー設定 */}
        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="font-bold text-gray-700 mb-3">APIキー設定</h2>

          <div className="space-y-3">
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Gemini APIキーを入力..."
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

            <div className="flex gap-2">
              <button
                onClick={saveApiKey}
                disabled={!apiKey.trim() || apiKey === savedApiKey}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {savedApiKey ? '更新' : '保存'}
              </button>
              {savedApiKey && (
                <button
                  onClick={deleteApiKey}
                  className="bg-red-500 text-white p-2 rounded-lg"
                  title="削除"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>

            {savedApiKey && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                APIキーが保存されています
              </p>
            )}

            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Google AI StudioでAPIキーを取得
            </a>
          </div>
        </section>

        {/* プロンプト入力 */}
        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="font-bold text-gray-700 mb-3">プロンプト</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg p-3 text-sm"
            placeholder="質問を入力..."
          />
          <button
            onClick={generate}
            disabled={status === 'generating' || !savedApiKey}
            className="mt-3 w-full bg-green-600 text-white py-2 px-4 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {status === 'generating' ? '生成中...' : '生成'}
          </button>
        </section>

        {/* レスポンス */}
        {(response || status === 'generating') && (
          <section className="bg-white rounded-lg shadow p-4">
            <h2 className="font-bold text-gray-700 mb-3">レスポンス</h2>
            <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap min-h-[100px]">
              {response || '生成中...'}
            </div>
          </section>
        )}

        {/* エラー表示 */}
        {error && (
          <section className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="font-bold text-red-700 mb-2">エラー</h2>
            <p className="text-sm text-red-600">{error}</p>
          </section>
        )}

        {/* 説明 */}
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="font-bold text-blue-800 mb-2">使い方</h2>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Google AI StudioでAPIキーを取得</li>
            <li>上記入力欄にAPIキーを貼り付けて保存</li>
            <li>質問を入力して「生成」をタップ</li>
          </ol>
          <p className="text-sm text-blue-600 mt-3">
            APIキーはこの端末のみに保存され、外部サーバーには送信されません。
          </p>
        </section>
      </main>
    </div>
  )
}
