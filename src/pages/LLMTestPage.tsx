import { useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'

// WebGPU types (experimental API)
declare global {
  interface Navigator {
    gpu?: {
      requestAdapter(): Promise<GPUAdapter | null>
    }
  }
  interface GPUAdapter {
    requestDevice(): Promise<GPUDevice>
    info?: {
      vendor?: string
      architecture?: string
    }
  }
  interface GPUDevice {}
}

// MLCEngine type (dynamic import)
interface MLCEngineInterface {
  chat: {
    completions: {
      create(options: {
        messages: { role: string; content: string }[]
        temperature?: number
        max_tokens?: number
        stream?: boolean
      }): Promise<AsyncIterable<{
        choices: { delta?: { content?: string } }[]
      }>>
    }
  }
  unload(): void
}

type Status = 'idle' | 'loading' | 'ready' | 'generating' | 'error'

// 軽量モデル候補
const MODELS = [
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B (推奨)', size: '~700MB' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 3B', size: '~1.8GB' },
  { id: 'SmolLM2-360M-Instruct-q4f16_1-MLC', name: 'SmolLM2 360M (最軽量)', size: '~250MB' },
]

export function LLMTestPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState('')
  const engineRef = useRef<MLCEngineInterface | null>(null)
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id)
  const [prompt, setPrompt] = useState('筋トレ初心者へのアドバイスを3つ教えてください。')
  const [response, setResponse] = useState('')
  const [stats, setStats] = useState<{ tokensPerSecond: number; totalTokens: number } | null>(null)
  const [error, setError] = useState('')
  const [engineLoaded, setEngineLoaded] = useState(false)

  // WebGPU対応チェック
  const checkWebGPU = useCallback(async () => {
    if (!navigator.gpu) {
      return { supported: false, reason: 'WebGPUがサポートされていません' }
    }
    try {
      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter) {
        return { supported: false, reason: 'GPUアダプタが見つかりません' }
      }
      const device = await adapter.requestDevice()
      const info = adapter.info
      return {
        supported: true,
        info: {
          vendor: info?.vendor || 'unknown',
          architecture: info?.architecture || 'unknown',
        },
        device: device,
      }
    } catch (e) {
      return { supported: false, reason: String(e) }
    }
  }, [])

  // モデルロード
  const loadModel = useCallback(async () => {
    setStatus('loading')
    setProgress('WebGPUをチェック中...')
    setError('')

    const gpuCheck = await checkWebGPU()
    if (!gpuCheck.supported) {
      setError(gpuCheck.reason || 'WebGPU not supported')
      setStatus('error')
      return
    }

    setProgress(`GPU検出: ${gpuCheck.info?.vendor} (${gpuCheck.info?.architecture})`)

    try {
      setProgress('WebLLMライブラリを読み込み中...')

      // Dynamic import of web-llm
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm')

      const progressCallback = (report: { text: string }) => {
        setProgress(report.text)
      }

      const newEngine = await CreateMLCEngine(selectedModel, {
        initProgressCallback: progressCallback,
      })

      engineRef.current = newEngine as MLCEngineInterface
      setEngineLoaded(true)
      setStatus('ready')
      setProgress('モデル準備完了')
    } catch (e) {
      setError(String(e))
      setStatus('error')
    }
  }, [selectedModel, checkWebGPU])

  // 推論実行
  const generate = useCallback(async () => {
    if (!engineRef.current) return

    setStatus('generating')
    setResponse('')
    setStats(null)

    const startTime = Date.now()
    let tokenCount = 0

    try {
      const systemPrompt = `あなたはフィットネスの専門家です。筋トレに関する質問に日本語で簡潔に答えてください。`

      const chunks = await engineRef.current.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 256,
        stream: true,
      })

      let fullResponse = ''
      for await (const chunk of chunks) {
        const content = chunk.choices[0]?.delta?.content || ''
        fullResponse += content
        tokenCount++
        setResponse(fullResponse)
      }

      const elapsed = (Date.now() - startTime) / 1000
      setStats({
        tokensPerSecond: Math.round(tokenCount / elapsed * 10) / 10,
        totalTokens: tokenCount,
      })
      setStatus('ready')
    } catch (e) {
      setError(String(e))
      setStatus('error')
    }
  }, [prompt])

  // エンジン解放
  const unloadModel = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.unload()
      engineRef.current = null
      setEngineLoaded(false)
      setStatus('idle')
      setProgress('')
      setResponse('')
      setStats(null)
    }
  }, [])

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
          <h1 className="text-xl font-bold text-gray-800">LLM テスト (PoC)</h1>
        </div>
      </header>

      <main className="max-w-screen-md mx-auto px-4 py-6 space-y-6">
        {/* WebGPU / デバイス情報 */}
        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="font-bold text-gray-700 mb-2">デバイス情報</h2>
          <div className="text-sm text-gray-600 space-y-1">
            <p>User Agent: {navigator.userAgent.slice(0, 80)}...</p>
            <p>WebGPU: {navigator.gpu ? '✅ 対応' : '❌ 非対応'}</p>
          </div>
        </section>

        {/* モデル選択 */}
        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="font-bold text-gray-700 mb-3">モデル選択</h2>
          <div className="space-y-2">
            {MODELS.map((model) => (
              <label
                key={model.id}
                className={`flex items-center p-3 border rounded-lg cursor-pointer ${
                  selectedModel === model.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="model"
                  value={model.id}
                  checked={selectedModel === model.id}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={status === 'loading' || status === 'generating'}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">{model.name}</div>
                  <div className="text-sm text-gray-500">{model.size}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={loadModel}
              disabled={status === 'loading' || status === 'generating' || status === 'ready'}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? 'ロード中...' : 'モデルをロード'}
            </button>
            {engineLoaded && (
              <button
                onClick={unloadModel}
                className="bg-gray-600 text-white py-2 px-4 rounded-lg"
              >
                解放
              </button>
            )}
          </div>

          {progress && (
            <div className="mt-3 p-3 bg-gray-100 rounded text-sm text-gray-700">
              {progress}
            </div>
          )}
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
            disabled={status !== 'ready'}
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
            {stats && (
              <div className="mt-3 text-sm text-gray-600">
                <span className="font-medium">速度:</span> {stats.tokensPerSecond} tokens/sec |{' '}
                <span className="font-medium">合計:</span> {stats.totalTokens} tokens
              </div>
            )}
          </section>
        )}

        {/* エラー表示 */}
        {error && (
          <section className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="font-bold text-red-700 mb-2">エラー</h2>
            <p className="text-sm text-red-600">{error}</p>
          </section>
        )}

        {/* 検証チェックリスト */}
        <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="font-bold text-yellow-800 mb-2">検証チェックリスト</h2>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>□ WebGPUが有効か</li>
            <li>□ モデルがダウンロードできるか</li>
            <li>□ 推論速度 (tokens/sec)</li>
            <li>□ メモリ使用量 (Settings → Safari → 開発)</li>
            <li>□ バッテリー消費</li>
            <li>□ 2回目以降のロード時間（キャッシュ効果）</li>
          </ul>
        </section>
      </main>
    </div>
  )
}
