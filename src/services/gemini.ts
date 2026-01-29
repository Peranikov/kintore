import { db } from '../db'
import type { WorkoutLog, ExerciseMaster, StagnationInfo, DeloadSuggestion } from '../types'
import { calculateWeeklyVolume, formatVolumeForPrompt } from '../utils/volumeCalculations'
import { detectStagnation, formatStagnationForPrompt } from '../utils/stagnationDetection'
import { generateDeloadSuggestion, formatDeloadForPrompt } from '../utils/periodization'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

// Gemini 2.5用のJSON Schemaを定義
const PLAN_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '種目名' },
          sets: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                weight: { type: 'number', description: '重量（kg）。自重の場合は0' },
                reps: { type: 'number', description: '回数' },
              },
              required: ['weight', 'reps'],
            },
          },
        },
        required: ['name', 'sets'],
      },
    },
    advice: { type: 'string', description: '今日のトレーニングに関するアドバイス' },
  },
  required: ['exercises'],
}

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
export function formatWorkoutLogs(logs: WorkoutLog[]): string {
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
export function formatExerciseMasters(masters: ExerciseMaster[]): string {
  return masters.map(m => {
    const suffix = m.isBodyweight ? '（自重）' : ''
    return `- ${m.name}${suffix}`
  }).join('\n')
}

// プロンプトを構築
export function buildPrompt(
  profile: string | null,
  exerciseMasters: ExerciseMaster[],
  recentLogs: WorkoutLog[],
  userMemo: string,
  stagnationInfos: StagnationInfo[] = [],
  deloadSuggestion: DeloadSuggestion | null = null,
  volumePrompt: string | null = null
): string {
  const systemPrompt = `あなたは経験豊富なパーソナルトレーナーです。
ユーザーの情報と過去のトレーニング履歴を考慮し、今日のトレーニングプランを提案してください。

【重要な指示】
1. 提案する種目は「利用可能な器具」リストに存在するもののみを使用してください
2. 過去の履歴から適切な重量・回数を推測してください
3. 「前回のトレーニング評価」がある場合は、その改善点を考慮してプランを作成してください
4. 「停滞中の種目」がある場合は、停滞を打破するための対策を考慮してください（重量を下げて回数を増やす、別の種目に変更するなど）
5. 「ディロード推奨」がある場合は、ボリュームを通常の50-60%に抑えたプランを提案してください
6. 「週間ボリューム状況」がある場合は、不足している部位を優先的に含め、過多の部位は控えめにしてください
7. 回答は必ず以下のJSON形式で返してください（JSON以外のテキストは含めないでください）

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

  // 直近の評価を取得してプロンプトに追加
  const latestEvaluation = recentLogs.find(log => log.evaluation)?.evaluation
  const evaluationSection = latestEvaluation
    ? `\n\n■ 前回のトレーニング評価（改善点を考慮してください）\n${latestEvaluation}`
    : ''

  // 停滞情報をプロンプトに追加
  const stagnationSection = stagnationInfos.length > 0
    ? `\n\n■ ${formatStagnationForPrompt(stagnationInfos)}`
    : ''

  // ディロード情報をプロンプトに追加
  const deloadSection = deloadSuggestion
    ? `\n\n■ ${formatDeloadForPrompt(deloadSuggestion)}`
    : ''

  const volumeSection = volumePrompt
    ? `\n\n■ ${volumePrompt}`
    : ''

  const memoSection = userMemo.trim()
    ? `\n\n■ 今日の状態・リクエスト\n${userMemo}`
    : ''

  return `${systemPrompt}${profileSection}${exercisesSection}${historySection}${evaluationSection}${stagnationSection}${deloadSection}${volumeSection}${memoSection}`
}

// JSONを抽出してパース
export function parseGeneratedPlan(text: string): GeneratedPlan {
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
        maxOutputTokens: 2048,
        // Gemini 2.5 Flashの思考機能を無効化（トークン効率化）
        thinkingConfig: {
          thinkingBudget: 0,
        },
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

// 総合進捗評価を生成（グラフページ用）
export async function generateProgressEvaluation(): Promise<string> {
  const apiKey = await getApiKey()
  if (!apiKey) {
    throw new Error('APIキーが設定されていません。設定画面でAPIキーを入力してください。')
  }

  const [profile, recentLogs, exerciseMasters] = await Promise.all([
    getUserProfile(),
    db.workoutLogs.orderBy('date').reverse().limit(30).toArray(),
    db.exerciseMasters.toArray(),
  ])

  if (recentLogs.length < 2) {
    throw new Error('評価には最低2回以上のトレーニング記録が必要です。')
  }

  // 種目ごとの進捗データを集計
  const exerciseProgress: { [name: string]: { dates: string[]; maxWeights: number[]; maxReps: number[]; isBodyweight: boolean } } = {}

  recentLogs.forEach(log => {
    log.exercises.forEach(ex => {
      const master = exerciseMasters.find(m => m.name === ex.name)
      const isBodyweight = master?.isBodyweight || false

      if (!exerciseProgress[ex.name]) {
        exerciseProgress[ex.name] = { dates: [], maxWeights: [], maxReps: [], isBodyweight }
      }
      const maxWeight = Math.max(...ex.sets.map(s => s.weight))
      const maxReps = Math.max(...ex.sets.map(s => s.reps))
      exerciseProgress[ex.name].dates.push(log.date)
      exerciseProgress[ex.name].maxWeights.push(maxWeight)
      exerciseProgress[ex.name].maxReps.push(maxReps)
    })
  })

  // 進捗サマリを作成
  const progressSummary = Object.entries(exerciseProgress).map(([name, data]) => {
    const first = { weight: data.maxWeights[data.maxWeights.length - 1], reps: data.maxReps[data.maxReps.length - 1] }
    const last = { weight: data.maxWeights[0], reps: data.maxReps[0] }

    if (data.isBodyweight) {
      const repsDiff = last.reps - first.reps
      return `- ${name}（自重）: ${first.reps}回 → ${last.reps}回（${repsDiff >= 0 ? '+' : ''}${repsDiff}回）`
    } else {
      const weightDiff = last.weight - first.weight
      return `- ${name}: ${first.weight}kg → ${last.weight}kg（${weightDiff >= 0 ? '+' : ''}${weightDiff}kg）`
    }
  }).join('\n')

  // トレーニング頻度を計算
  const sortedDates = recentLogs.map(l => l.date).sort()
  const firstDate = sortedDates[0]
  const lastDate = sortedDates[sortedDates.length - 1]
  const daysDiff = Math.ceil((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
  const frequency = recentLogs.length / (daysDiff / 7)

  const prompt = `あなたは経験豊富なパーソナルトレーナーです。
ユーザーの過去のトレーニング履歴を分析し、総合的な進捗評価を行ってください。

【分析対象データ】
■ 期間: ${firstDate} 〜 ${lastDate}（${recentLogs.length}回のトレーニング、週${frequency.toFixed(1)}回ペース）

■ 種目別の進捗
${progressSummary}

${profile ? `■ ユーザープロフィール\n${profile}\n` : ''}
■ 直近のトレーニング詳細
${formatWorkoutLogs(recentLogs.slice(0, 5))}

【評価ポイント】
1. 各種目の重量・回数の伸び具合
2. トレーニング頻度は適切か
3. 種目のバランス（部位の偏りがないか）
4. 特に伸びている種目と停滞している種目
5. 今後の具体的な改善アドバイス

【出力形式】
・300-400文字程度の総合評価
・伸びている点、改善点を具体的に
・次の目標設定のアドバイスを含む
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
        maxOutputTokens: 2048,
        // Gemini 2.5 Flashの思考機能を無効化（トークン効率化）
        thinkingConfig: {
          thinkingBudget: 0,
        },
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

  // 停滞検出・ディロード検出用に多めのログを取得
  const [profile, exerciseMasters, recentLogs, allRecentLogs] = await Promise.all([
    getUserProfile(),
    db.exerciseMasters.toArray(),
    db.workoutLogs.orderBy('date').reverse().limit(7).toArray(),
    db.workoutLogs.orderBy('date').reverse().limit(30).toArray(),  // 停滞・ディロード検出用
  ])

  if (exerciseMasters.length === 0) {
    throw new Error('器具マスタが空です。先に種目を登録してください。')
  }

  // 停滞を検出
  const stagnationInfos = detectStagnation(allRecentLogs, exerciseMasters)

  // ディロード推奨を検出
  const deloadSuggestion = generateDeloadSuggestion(allRecentLogs, exerciseMasters)

  // 週間ボリューム状況を取得
  const weeklyVolume = calculateWeeklyVolume(allRecentLogs, exerciseMasters)
  const volumePrompt = formatVolumeForPrompt(weeklyVolume)

  const prompt = buildPrompt(profile, exerciseMasters, recentLogs, userMemo, stagnationInfos, deloadSuggestion, volumePrompt)

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
        responseMimeType: 'application/json',
        responseSchema: PLAN_RESPONSE_SCHEMA,
        // Gemini 2.5 Flashの思考機能を無効化（トークン効率化）
        thinkingConfig: {
          thinkingBudget: 0,
        },
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
