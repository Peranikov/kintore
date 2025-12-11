import { db } from '../db'
import type { WorkoutLog, ExerciseMaster } from '../types'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export interface GeneratedExercise {
  name: string
  sets: {
    weight: number
    reps: number
  }[]
}

export interface GeneratedPlan {
  exercises: GeneratedExercise[]
  advice?: string
}

// 設定値を取得
export async function getApiKey(): Promise<string | null> {
  const setting = await db.appSettings.where('key').equals('geminiApiKey').first()
  return setting?.value || null
}

export async function getUserProfile(): Promise<string | null> {
  const setting = await db.appSettings.where('key').equals('userProfile').first()
  return setting?.value || null
}

// 設定値を保存
export async function saveApiKey(apiKey: string): Promise<void> {
  const existing = await db.appSettings.where('key').equals('geminiApiKey').first()
  if (existing) {
    await db.appSettings.update(existing.id!, { value: apiKey })
  } else {
    await db.appSettings.add({ key: 'geminiApiKey', value: apiKey })
  }
}

export async function saveUserProfile(profile: string): Promise<void> {
  const existing = await db.appSettings.where('key').equals('userProfile').first()
  if (existing) {
    await db.appSettings.update(existing.id!, { value: profile })
  } else {
    await db.appSettings.add({ key: 'userProfile', value: profile })
  }
}

// トレーニング履歴をフォーマット
function formatWorkoutLogs(logs: WorkoutLog[]): string {
  if (logs.length === 0) {
    return 'トレーニング履歴はまだありません。'
  }

  return logs.map(log => {
    const exercises = log.exercises.map(ex => {
      const sets = ex.sets.map(s =>
        s.weight > 0 ? `${s.weight}kg×${s.reps}回` : `${s.reps}回`
      ).join(', ')
      return `  - ${ex.name}: ${sets}`
    }).join('\n')
    return `【${log.date}】\n${exercises}`
  }).join('\n\n')
}

// 器具マスタをフォーマット
function formatExerciseMasters(masters: ExerciseMaster[]): string {
  return masters.map(m => {
    const suffix = m.isBodyweight ? '（自重）' : ''
    return `- ${m.name}${suffix}`
  }).join('\n')
}

// プロンプトを構築
function buildPrompt(
  profile: string | null,
  exerciseMasters: ExerciseMaster[],
  recentLogs: WorkoutLog[],
  userMemo: string
): string {
  const systemPrompt = `あなたは経験豊富なパーソナルトレーナーです。
ユーザーの情報と過去のトレーニング履歴を考慮し、今日のトレーニングプランを提案してください。

【重要な指示】
1. 提案する種目は「利用可能な器具」リストに存在するもののみを使用してください
2. 過去の履歴から適切な重量・回数を推測してください
3. 回答は必ず以下のJSON形式で返してください（JSON以外のテキストは含めないでください）

{
  "exercises": [
    {
      "name": "種目名",
      "sets": [
        { "weight": 重量kg（自重の場合は0）, "reps": 回数 }
      ]
    }
  ],
  "advice": "今日のトレーニングに関するアドバイス（任意）"
}`

  const profileSection = profile
    ? `\n\n■ ユーザープロフィール\n${profile}`
    : ''

  const exercisesSection = `\n\n■ 利用可能な器具\n${formatExerciseMasters(exerciseMasters)}`

  const historySection = `\n\n■ 最近のトレーニング履歴（直近7回分）\n${formatWorkoutLogs(recentLogs)}`

  const memoSection = userMemo.trim()
    ? `\n\n■ 今日の状態・リクエスト\n${userMemo}`
    : ''

  return `${systemPrompt}${profileSection}${exercisesSection}${historySection}${memoSection}`
}

// JSONを抽出してパース
function parseGeneratedPlan(text: string): GeneratedPlan {
  // JSONブロックを抽出（```json ... ``` または { ... }）
  let jsonStr = text

  // ```json ... ``` 形式の場合
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonBlockMatch) {
    jsonStr = jsonBlockMatch[1].trim()
  } else {
    // 最初の { から最後の } までを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }
  }

  try {
    const parsed = JSON.parse(jsonStr)

    // バリデーション
    if (!parsed.exercises || !Array.isArray(parsed.exercises)) {
      throw new Error('exercises配列が見つかりません')
    }

    return {
      exercises: parsed.exercises.map((ex: { name?: string; sets?: { weight?: number; reps?: number }[] }) => ({
        name: String(ex.name || ''),
        sets: (ex.sets || []).map((s: { weight?: number; reps?: number }) => ({
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
        })),
      })),
      advice: parsed.advice || undefined,
    }
  } catch (e) {
    throw new Error(`JSONのパースに失敗しました: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// トレーニング評価を生成
export async function generateWorkoutEvaluation(log: WorkoutLog): Promise<string> {
  const apiKey = await getApiKey()
  if (!apiKey) {
    throw new Error('APIキーが設定されていません。設定画面でAPIキーを入力してください。')
  }

  const [profile, recentLogs] = await Promise.all([
    getUserProfile(),
    db.workoutLogs.orderBy('date').reverse().limit(10).toArray(),
  ])

  // 過去のログからこの日のログを除外
  const previousLogs = recentLogs.filter(l => l.id !== log.id && l.date < log.date).slice(0, 7)

  // 今回のトレーニング内容をフォーマット
  const todayWorkout = log.exercises.map(ex => {
    const sets = ex.sets.map(s =>
      s.weight > 0 ? `${s.weight}kg×${s.reps}回` : `${s.reps}回`
    ).join(', ')
    return `- ${ex.name}: ${sets}`
  }).join('\n')

  const prompt = `あなたは経験豊富なパーソナルトレーナーです。
ユーザーの今日のトレーニングを評価し、フィードバックを提供してください。

【評価のポイント】
1. トレーニングボリューム（種目数、セット数）は適切か
2. 前回と比較して進歩はあるか（重量増加、回数増加など）
3. 種目のバランスは良いか
4. 次回への具体的なアドバイス

${profile ? `■ ユーザープロフィール\n${profile}\n` : ''}
■ 今日のトレーニング（${log.date}）
${todayWorkout}

■ 過去のトレーニング履歴
${previousLogs.length > 0 ? formatWorkoutLogs(previousLogs) : 'まだ過去の記録がありません'}

【出力形式】
・簡潔で具体的なフィードバック（200-300文字程度）
・ポジティブな点と改善点をバランスよく
・絵文字を適度に使用してフレンドリーに`

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error?.message || `API Error: ${response.status}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('APIからの応答が空です')
  }

  return text
}

// プランを生成
export async function generatePlan(userMemo: string): Promise<GeneratedPlan> {
  const apiKey = await getApiKey()
  if (!apiKey) {
    throw new Error('APIキーが設定されていません。設定画面でAPIキーを入力してください。')
  }

  const [profile, exerciseMasters, recentLogs] = await Promise.all([
    getUserProfile(),
    db.exerciseMasters.toArray(),
    db.workoutLogs.orderBy('date').reverse().limit(7).toArray(),
  ])

  if (exerciseMasters.length === 0) {
    throw new Error('器具マスタが空です。先に種目を登録してください。')
  }

  const prompt = buildPrompt(profile, exerciseMasters, recentLogs, userMemo)

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    }),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error?.message || `API Error: ${response.status}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('APIからの応答が空です')
  }

  return parseGeneratedPlan(text)
}
