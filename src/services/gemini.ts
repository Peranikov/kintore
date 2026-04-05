import { db } from '../db'
import type {
  WorkoutLog,
  ExerciseMaster,
  StagnationInfo,
  DeloadSuggestion,
  StructuredUserProfile,
  ExerciseBodyPart,
  Set as WorkoutSet,
} from '../types'
import { getActiveDeloadSuggestion, getDeloadDismissal } from './deload'
import { detectStagnation, formatStagnationForPrompt } from '../utils/stagnationDetection'
import { formatDeloadForPrompt } from '../utils/periodization'
import { EXERCISE_BODY_PARTS } from '../utils/exerciseMetadata'
import { formatLocalDate, todayLocalDate } from '../utils/date'

export const GEMINI_MODELS = [
  { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash-Lite (Preview)', description: 'コスパ良・最新' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', description: '最安・最速' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'バランス型' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: '高品質推論' },
] as const

export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite-preview'

function getApiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

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
                weight: { type: 'number', description: '重量（kg）。自重・有酸素の場合は0' },
                reps: { type: 'number', description: '回数。有酸素の場合は0' },
                duration: { type: 'number', description: '有酸素運動の時間（分）' },
                distance: { type: 'number', description: '有酸素運動の距離（km）。任意' },
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
  sets: WorkoutSet[]
}

export interface GeneratedPlan {
  exercises: GeneratedExercise[]
  advice?: string
}

export function validateGeneratedPlan(plan: GeneratedPlan, exerciseMasters: ExerciseMaster[]): GeneratedPlan {
  const masterByName = new Map(exerciseMasters.map((master) => [master.name, master]))

  for (const exercise of plan.exercises) {
    const master = masterByName.get(exercise.name)
    if (!master) {
      throw new Error(`未登録の種目が含まれています: ${exercise.name}`)
    }

    if (exercise.sets.length === 0) {
      throw new Error(`セットが空の種目があります: ${exercise.name}`)
    }

    if (master.isCardio) {
      const invalidCardioSet = exercise.sets.find((set) => !set.duration || set.duration <= 0)
      if (invalidCardioSet) {
        throw new Error(`有酸素種目には時間の指定が必要です: ${exercise.name}`)
      }
    }
  }

  return plan
}

interface BodyPartPriority {
  bodyPart: string
  weeklySets: number
  targetWeeklySets: number | null
  targetGap: number | null
  lastPerformed: string | null
  daysSinceLastPerformed: number | null
}

const BODY_PART_TARGET_KEYS: Record<string, keyof StructuredUserProfile> = {
  胸: 'weeklySetTargetChest',
  背中: 'weeklySetTargetBack',
  肩: 'weeklySetTargetShoulders',
  脚: 'weeklySetTargetLegs',
  腕: 'weeklySetTargetArms',
  体幹: 'weeklySetTargetCore',
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return formatLocalDate(date)
}

function diffDays(fromDate: string, toDate: string): number {
  const from = new Date(fromDate)
  const to = new Date(toDate)
  from.setHours(0, 0, 0, 0)
  to.setHours(0, 0, 0, 0)
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000))
}

const STRUCTURED_USER_PROFILE_KEY = 'structuredUserProfile'
const LEGACY_USER_PROFILE_KEY = 'userProfile'

export const EMPTY_STRUCTURED_USER_PROFILE: StructuredUserProfile = {
  primaryGoal: '',
  trainingExperience: '',
  weeklyFrequency: '',
  sessionDurationMinutes: '',
  focusAreas: '',
  weeklySetTargetChest: '',
  weeklySetTargetBack: '',
  weeklySetTargetShoulders: '',
  weeklySetTargetLegs: '',
  weeklySetTargetArms: '',
  weeklySetTargetCore: '',
  limitations: '',
  bodyMetrics: '',
  additionalNotes: '',
}

function normalizeStructuredUserProfile(profile: Partial<StructuredUserProfile> | null | undefined): StructuredUserProfile {
  return {
    primaryGoal: profile?.primaryGoal?.trim() || '',
    trainingExperience: profile?.trainingExperience?.trim() || '',
    weeklyFrequency: profile?.weeklyFrequency?.trim() || '',
    sessionDurationMinutes: profile?.sessionDurationMinutes?.trim() || '',
    focusAreas: profile?.focusAreas?.trim() || '',
    weeklySetTargetChest: profile?.weeklySetTargetChest?.trim() || '',
    weeklySetTargetBack: profile?.weeklySetTargetBack?.trim() || '',
    weeklySetTargetShoulders: profile?.weeklySetTargetShoulders?.trim() || '',
    weeklySetTargetLegs: profile?.weeklySetTargetLegs?.trim() || '',
    weeklySetTargetArms: profile?.weeklySetTargetArms?.trim() || '',
    weeklySetTargetCore: profile?.weeklySetTargetCore?.trim() || '',
    limitations: profile?.limitations?.trim() || '',
    bodyMetrics: profile?.bodyMetrics?.trim() || '',
    additionalNotes: profile?.additionalNotes?.trim() || '',
  }
}

function hasStructuredUserProfileContent(profile: StructuredUserProfile): boolean {
  return Object.values(profile).some(value => value.length > 0)
}

export function formatStructuredUserProfile(profile: Partial<StructuredUserProfile> | null | undefined): string | null {
  const normalized = normalizeStructuredUserProfile(profile)
  const weeklySetTargetLine = Object.entries(BODY_PART_TARGET_KEYS)
    .map(([bodyPart, key]) => normalized[key] ? `${bodyPart} ${normalized[key]}セット` : null)
    .filter(Boolean)
    .join(' / ')
  const lines = [
    normalized.primaryGoal && `- 主な目標: ${normalized.primaryGoal}`,
    normalized.trainingExperience && `- トレーニング歴: ${normalized.trainingExperience}`,
    normalized.weeklyFrequency && `- 週あたりのトレーニング回数: ${normalized.weeklyFrequency}`,
    normalized.sessionDurationMinutes && `- 1回あたりの目安時間: ${normalized.sessionDurationMinutes}分`,
    normalized.focusAreas && `- 強化したい部位: ${normalized.focusAreas}`,
    weeklySetTargetLine && `- 部位ごとの目標週セット数: ${weeklySetTargetLine}`,
    normalized.limitations && `- 痛み・避けたい動き・配慮事項: ${normalized.limitations}`,
    normalized.bodyMetrics && `- 体格・体組成メモ: ${normalized.bodyMetrics}`,
    normalized.additionalNotes && `- 補足メモ: ${normalized.additionalNotes}`,
  ].filter(Boolean)

  return lines.length > 0 ? lines.join('\n') : null
}

function getBodyPartWeeklySetTarget(
  profile: StructuredUserProfile | null | undefined,
  bodyPart: string,
): number | null {
  if (!profile) return null

  const key = BODY_PART_TARGET_KEYS[bodyPart]
  if (!key) return null

  const rawValue = profile[key]
  if (!rawValue) return null

  const parsed = Number(rawValue)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseStructuredUserProfile(raw: string | null | undefined): StructuredUserProfile | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    return normalizeStructuredUserProfile(parsed)
  } catch {
    return null
  }
}

// 設定値を取得
export async function getApiKey(): Promise<string | null> {
  const setting = await db.appSettings.where('key').equals('geminiApiKey').first()
  return setting?.value || null
}

export async function getGeminiModel(): Promise<string> {
  const setting = await db.appSettings.where('key').equals('geminiModel').first()
  return setting?.value || DEFAULT_GEMINI_MODEL
}

export async function getUserProfile(): Promise<string | null> {
  const [structuredSetting, legacySetting] = await Promise.all([
    db.appSettings.where('key').equals(STRUCTURED_USER_PROFILE_KEY).first(),
    db.appSettings.where('key').equals(LEGACY_USER_PROFILE_KEY).first(),
  ])

  const structuredProfile = parseStructuredUserProfile(structuredSetting?.value)
  const formattedStructuredProfile = formatStructuredUserProfile(structuredProfile)
  if (formattedStructuredProfile) {
    return formattedStructuredProfile
  }

  return legacySetting?.value || null
}

export async function getStructuredUserProfile(): Promise<StructuredUserProfile> {
  const [structuredSetting, legacySetting] = await Promise.all([
    db.appSettings.where('key').equals(STRUCTURED_USER_PROFILE_KEY).first(),
    db.appSettings.where('key').equals(LEGACY_USER_PROFILE_KEY).first(),
  ])

  const structuredProfile = parseStructuredUserProfile(structuredSetting?.value)
  if (structuredProfile) {
    return structuredProfile
  }

  if (legacySetting?.value) {
    return {
      ...EMPTY_STRUCTURED_USER_PROFILE,
      additionalNotes: legacySetting.value,
    }
  }

  return { ...EMPTY_STRUCTURED_USER_PROFILE }
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

export async function saveGeminiModel(model: string): Promise<void> {
  const existing = await db.appSettings.where('key').equals('geminiModel').first()
  if (existing) {
    await db.appSettings.update(existing.id!, { value: model })
  } else {
    await db.appSettings.add({ key: 'geminiModel', value: model })
  }
}

export async function saveUserProfile(profile: string): Promise<void> {
  const existing = await db.appSettings.where('key').equals(LEGACY_USER_PROFILE_KEY).first()
  if (existing) {
    await db.appSettings.update(existing.id!, { value: profile })
  } else {
    await db.appSettings.add({ key: LEGACY_USER_PROFILE_KEY, value: profile })
  }
}

export async function saveStructuredUserProfile(profile: StructuredUserProfile): Promise<void> {
  const normalizedProfile = normalizeStructuredUserProfile(profile)
  const [structuredExisting, legacyExisting] = await Promise.all([
    db.appSettings.where('key').equals(STRUCTURED_USER_PROFILE_KEY).first(),
    db.appSettings.where('key').equals(LEGACY_USER_PROFILE_KEY).first(),
  ])

  const structuredValue = JSON.stringify(normalizedProfile)
  const legacyValue = formatStructuredUserProfile(normalizedProfile) || ''

  if (structuredExisting) {
    await db.appSettings.update(structuredExisting.id!, { value: structuredValue })
  } else {
    await db.appSettings.add({ key: STRUCTURED_USER_PROFILE_KEY, value: structuredValue })
  }

  if (legacyExisting) {
    await db.appSettings.update(legacyExisting.id!, { value: legacyValue })
  } else if (hasStructuredUserProfileContent(normalizedProfile)) {
    await db.appSettings.add({ key: LEGACY_USER_PROFILE_KEY, value: legacyValue })
  }
}

// セットをフォーマット（有酸素運動対応）
function formatSet(s: { weight: number; reps: number; duration?: number; distance?: number }): string {
  if (s.duration != null) {
    const parts = [`${s.duration}分`]
    if (s.distance) parts.push(`${s.distance}km`)
    return parts.join(' / ')
  }
  return s.weight > 0 ? `${s.weight}kg×${s.reps}回` : `${s.reps}回`
}

// トレーニング履歴をフォーマット
export function formatWorkoutLogs(logs: WorkoutLog[]): string {
  if (logs.length === 0) {
    return 'トレーニング履歴はまだありません。'
  }

  return logs.map(log => {
    const exercises = log.exercises.map(ex => {
      const sets = ex.sets.map(s => formatSet(s)).join(', ')
      return `  - ${ex.name}: ${sets}`
    }).join('\n')
    return `【${log.date}】\n${exercises}`
  }).join('\n\n')
}

// 器具マスタをフォーマット
export function formatExerciseMasters(masters: ExerciseMaster[]): string {
  return masters.map(m => {
    const details = [
      m.bodyPart && `部位: ${m.bodyPart}`,
      m.category && `カテゴリ: ${m.category}`,
      m.isBodyweight && '種別: 自重',
      m.isCardio && '種別: 有酸素',
    ].filter(Boolean)

    return details.length > 0
      ? `- ${m.name}（${details.join(' / ')}）`
      : `- ${m.name}`
  }).join('\n')
}

export function formatBodyPartWeeklySetSummary(
  logs: WorkoutLog[],
  exerciseMasters: ExerciseMaster[],
  structuredProfile?: StructuredUserProfile | null,
): string {
  if (logs.length === 0) {
    return '直近1週間の記録はありません。'
  }

  const latestLogDate = logs.reduce((latest, log) => log.date > latest ? log.date : latest, logs[0].date)
  const windowStart = addDays(latestLogDate, -6)
  const setCounts = new Map<string, number>()

  logs
    .filter((log) => log.date >= windowStart && log.date <= latestLogDate)
    .forEach((log) => {
      log.exercises.forEach((exercise) => {
        const master = exerciseMasters.find((item) => item.name === exercise.name)
        const bodyPart = master?.bodyPart || 'その他'
        setCounts.set(bodyPart, (setCounts.get(bodyPart) || 0) + exercise.sets.length)
      })
    })

  const lines = EXERCISE_BODY_PARTS
    .map((bodyPart) => {
      const count = setCounts.get(bodyPart)
      if (!count) return null
      const target = getBodyPartWeeklySetTarget(structuredProfile, bodyPart)
      return target
        ? `- ${bodyPart}: ${count} / ${target}セット`
        : `- ${bodyPart}: ${count}セット`
    })
    .filter(Boolean)

  return lines.length > 0
    ? `直近1週間（${windowStart}〜${latestLogDate}）の部位別セット数\n${lines.join('\n')}`
    : '直近1週間の記録はありません。'
}

export function formatBodyPartLastPerformedSummary(
  logs: WorkoutLog[],
  exerciseMasters: ExerciseMaster[],
): string {
  if (logs.length === 0) {
    return '部位ごとの前回実施日はありません。'
  }

  const lastPerformedMap = new Map<string, string>()

  logs.forEach((log) => {
    log.exercises.forEach((exercise) => {
      const master = exerciseMasters.find((item) => item.name === exercise.name)
      const bodyPart = master?.bodyPart || 'その他'
      const current = lastPerformedMap.get(bodyPart)
      if (!current || log.date > current) {
        lastPerformedMap.set(bodyPart, log.date)
      }
    })
  })

  const lines = EXERCISE_BODY_PARTS
    .map((bodyPart) => {
      const date = lastPerformedMap.get(bodyPart)
      return date ? `- ${bodyPart}: ${date}` : null
    })
    .filter(Boolean)

  return lines.length > 0
    ? `部位ごとの前回実施日\n${lines.join('\n')}`
    : '部位ごとの前回実施日はありません。'
}

export function formatStagnationSummary(stagnationInfos: StagnationInfo[]): string {
  if (stagnationInfos.length === 0) {
    return '停滞中の種目はありません。'
  }

  const lines = stagnationInfos
    .slice(0, 5)
    .map((info) => `- ${info.exerciseName}: ${info.metric} ${info.value}${info.unit} / ${info.weeks}週間停滞`)

  return `停滞中の種目\n${lines.join('\n')}`
}

export function buildBodyPartPriorities(
  logs: WorkoutLog[],
  exerciseMasters: ExerciseMaster[],
  structuredProfile?: StructuredUserProfile | null,
  referenceDate: string = todayLocalDate(),
): BodyPartPriority[] {
  const skippedBodyParts = new Set(['有酸素', 'その他'])
  const availableBodyParts = new Set(
    exerciseMasters
      .map((exercise) => exercise.bodyPart)
      .filter((bodyPart): bodyPart is ExerciseBodyPart => Boolean(bodyPart) && bodyPart !== '有酸素' && bodyPart !== 'その他')
  )
  const lastRelevantBodyParts = EXERCISE_BODY_PARTS.filter((bodyPart) => availableBodyParts.has(bodyPart))
  const latestLogDate = logs.length > 0
    ? logs.reduce((latest, log) => log.date > latest ? log.date : latest, logs[0].date)
    : referenceDate
  const windowStart = addDays(latestLogDate, -6)
  const weeklySetCounts = new Map<string, number>()
  const lastPerformedMap = new Map<string, string>()

  logs.forEach((log) => {
    log.exercises.forEach((exercise) => {
      const master = exerciseMasters.find((item) => item.name === exercise.name)
      const bodyPart = master?.bodyPart || 'その他'

      if (skippedBodyParts.has(bodyPart)) {
        return
      }

      if (log.date >= windowStart && log.date <= latestLogDate) {
        weeklySetCounts.set(bodyPart, (weeklySetCounts.get(bodyPart) || 0) + exercise.sets.length)
      }

      const current = lastPerformedMap.get(bodyPart)
      if (!current || log.date > current) {
        lastPerformedMap.set(bodyPart, log.date)
      }
    })
  })

  return lastRelevantBodyParts
    .map((bodyPart) => {
      const lastPerformed = lastPerformedMap.get(bodyPart) || null
      return {
        bodyPart,
        weeklySets: weeklySetCounts.get(bodyPart) || 0,
        targetWeeklySets: getBodyPartWeeklySetTarget(structuredProfile, bodyPart),
        targetGap: (() => {
          const target = getBodyPartWeeklySetTarget(structuredProfile, bodyPart)
          if (target == null) return null
          return Math.max(target - (weeklySetCounts.get(bodyPart) || 0), 0)
        })(),
        lastPerformed,
        daysSinceLastPerformed: lastPerformed ? diffDays(lastPerformed, referenceDate) : null,
      }
    })
    .sort((a, b) => {
      const aGap = a.targetGap ?? -1
      const bGap = b.targetGap ?? -1
      if (aGap !== bGap) {
        return bGap - aGap
      }

      if (a.weeklySets !== b.weeklySets) {
        return a.weeklySets - b.weeklySets
      }

      const aDays = a.daysSinceLastPerformed ?? Number.MAX_SAFE_INTEGER
      const bDays = b.daysSinceLastPerformed ?? Number.MAX_SAFE_INTEGER
      if (aDays !== bDays) {
        return bDays - aDays
      }

      return a.bodyPart.localeCompare(b.bodyPart)
    })
}

export function formatBodyPartPrioritySummary(
  logs: WorkoutLog[],
  exerciseMasters: ExerciseMaster[],
  structuredProfile?: StructuredUserProfile | null,
  referenceDate?: string,
): string {
  const priorities = buildBodyPartPriorities(logs, exerciseMasters, structuredProfile, referenceDate).slice(0, 3)

  if (priorities.length === 0) {
    return '優先部位の候補はありません。'
  }

  const lines = priorities.map((priority, index) => {
    const lastPerformedPart = priority.lastPerformed
      ? `${priority.lastPerformed}（${priority.daysSinceLastPerformed}日前）`
      : '記録なし'
    const targetPart = priority.targetWeeklySets
      ? ` / 目標 ${priority.targetWeeklySets}セット / 不足 ${priority.targetGap}セット`
      : ''
    return `${index + 1}. ${priority.bodyPart}: 直近1週間 ${priority.weeklySets}セット${targetPart} / 前回 ${lastPerformedPart}`
  })

  return `今日の優先候補部位\n${lines.join('\n')}`
}

export function formatRecommendedBodyPartSummary(
  logs: WorkoutLog[],
  exerciseMasters: ExerciseMaster[],
  structuredProfile?: StructuredUserProfile | null,
  referenceDate?: string,
): string {
  const topPriority = buildBodyPartPriorities(logs, exerciseMasters, structuredProfile, referenceDate)[0]

  if (!topPriority) {
    return '今日の推奨部位はありません。'
  }

  const reasons: string[] = []

  if (topPriority.targetWeeklySets && topPriority.targetGap != null) {
    reasons.push(`目標 ${topPriority.targetWeeklySets}セットに対して ${topPriority.targetGap}セット不足`)
  } else if (topPriority.weeklySets === 0) {
    reasons.push('直近1週間のセット数が0')
  } else {
    reasons.push(`直近1週間のセット数が${topPriority.weeklySets}セットと少なめ`)
  }

  if (topPriority.lastPerformed) {
    reasons.push(`前回実施が${topPriority.lastPerformed}（${topPriority.daysSinceLastPerformed}日前）`)
  } else {
    reasons.push('最近の実施記録がない')
  }

  return `今日の推奨部位\n- ${topPriority.bodyPart}\n- 理由: ${reasons.join(' / ')}`
}

export function formatRecommendedExerciseCandidates(
  logs: WorkoutLog[],
  exerciseMasters: ExerciseMaster[],
  structuredProfile?: StructuredUserProfile | null,
  referenceDate?: string,
  stagnationInfos: StagnationInfo[] = [],
): string {
  const topPriority = buildBodyPartPriorities(logs, exerciseMasters, structuredProfile, referenceDate)[0]

  if (!topPriority) {
    return '推奨部位に対応する種目候補はありません。'
  }

  const candidates = exerciseMasters
    .filter((exercise) => exercise.bodyPart === topPriority.bodyPart && !exercise.isCardio)
    .sort((a, b) => a.name.localeCompare(b.name))

  if (candidates.length === 0) {
    return '推奨部位に対応する種目候補はありません。'
  }

  const lastPerformedByExercise = new Map<string, string>()
  const lastSetsByExercise = new Map<string, string>()
  const consecutiveUseCountByExercise = new Map<string, number>()
  logs.forEach((log) => {
    log.exercises.forEach((exercise) => {
      const current = lastPerformedByExercise.get(exercise.name)
      if (!current || log.date > current) {
        lastPerformedByExercise.set(exercise.name, log.date)
        lastSetsByExercise.set(exercise.name, exercise.sets.map((set) => formatSet(set)).join(', '))
      }
    })
  })

  const uniqueLogsDesc = [...logs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((log, index, array) => index === 0 || log.date !== array[index - 1].date)

  candidates.forEach((candidate) => {
    let count = 0
    for (const log of uniqueLogsDesc) {
      const hasExercise = log.exercises.some((exercise) => exercise.name === candidate.name)
      if (!hasExercise) {
        break
      }
      count++
    }
    consecutiveUseCountByExercise.set(candidate.name, count)
  })

  const stagnatingExerciseNames = new Set(
    stagnationInfos
      .map((info) => info.exerciseName)
      .filter((exerciseName) => {
        const master = exerciseMasters.find((exercise) => exercise.name === exerciseName)
        return master?.bodyPart === topPriority.bodyPart
      })
  )
  const hasStagnationInBodyPart = stagnatingExerciseNames.size > 0
  const latestPerformedCategory = (() => {
    const latestEntry = candidates
      .map((exercise) => ({
        category: exercise.category || null,
        lastPerformed: lastPerformedByExercise.get(exercise.name) || null,
      }))
      .filter((entry) => entry.lastPerformed)
      .sort((a, b) => (b.lastPerformed || '').localeCompare(a.lastPerformed || ''))[0]

    return latestEntry?.category || null
  })()

  const sortedCandidates = [...candidates].sort((a, b) => {
    const aLastPerformed = lastPerformedByExercise.get(a.name)
    const bLastPerformed = lastPerformedByExercise.get(b.name)
    const aStagnating = stagnatingExerciseNames.has(a.name) ? 1 : 0
    const bStagnating = stagnatingExerciseNames.has(b.name) ? 1 : 0
    if (aStagnating !== bStagnating) {
      return bStagnating - aStagnating
    }

    const aVariation = hasStagnationInBodyPart && latestPerformedCategory && a.category && a.category !== latestPerformedCategory ? 1 : 0
    const bVariation = hasStagnationInBodyPart && latestPerformedCategory && b.category && b.category !== latestPerformedCategory ? 1 : 0
    if (aVariation !== bVariation) {
      return bVariation - aVariation
    }

    const aConsecutive = consecutiveUseCountByExercise.get(a.name) || 0
    const bConsecutive = consecutiveUseCountByExercise.get(b.name) || 0
    if (aConsecutive !== bConsecutive) {
      return aConsecutive - bConsecutive
    }

    if (aLastPerformed !== bLastPerformed) {
      return (aLastPerformed || '').localeCompare(bLastPerformed || '')
    }

    return a.name.localeCompare(b.name)
  })

  const sortedLines = sortedCandidates.map((exercise) => {
    const lastPerformed = lastPerformedByExercise.get(exercise.name)
    const details = [
      exercise.category && `カテゴリ: ${exercise.category}`,
      exercise.isBodyweight && '自重',
      lastPerformed
        ? `${lastPerformed}（${diffDays(lastPerformed, referenceDate || todayLocalDate())}日前）`
        : '最近未実施',
      lastSetsByExercise.get(exercise.name) && `前回: ${lastSetsByExercise.get(exercise.name)}`,
      (consecutiveUseCountByExercise.get(exercise.name) || 0) >= 2
        ? `${consecutiveUseCountByExercise.get(exercise.name)}回連続採用中`
        : null,
      stagnatingExerciseNames.has(exercise.name) && '停滞中',
      hasStagnationInBodyPart && latestPerformedCategory && exercise.category && exercise.category !== latestPerformedCategory
        ? '刺激変化候補'
        : null,
    ].filter(Boolean)

    return details.length > 0
      ? `- ${exercise.name}（${details.join(' / ')}）`
      : `- ${exercise.name}`
  })

  return `推奨部位の種目候補（${topPriority.bodyPart}）\n${sortedLines.join('\n')}`
}

export function formatAiPlanContextSummary(
  logs: WorkoutLog[],
  exerciseMasters: ExerciseMaster[],
  stagnationInfos: StagnationInfo[],
  structuredProfile?: StructuredUserProfile | null,
): string {
  return [
    formatBodyPartWeeklySetSummary(logs, exerciseMasters, structuredProfile),
    formatBodyPartLastPerformedSummary(logs, exerciseMasters),
    formatRecommendedBodyPartSummary(logs, exerciseMasters, structuredProfile),
    formatRecommendedExerciseCandidates(logs, exerciseMasters, structuredProfile, undefined, stagnationInfos),
    formatBodyPartPrioritySummary(logs, exerciseMasters, structuredProfile),
    formatStagnationSummary(stagnationInfos),
  ].join('\n\n')
}

// プロンプトを構築
export function buildPrompt(
  profile: string | null,
  structuredProfile: StructuredUserProfile | null,
  exerciseMasters: ExerciseMaster[],
  recentLogs: WorkoutLog[],
  userMemo: string,
  conversationContext: string = '',
  stagnationInfos: StagnationInfo[] = [],
  deloadSuggestion: DeloadSuggestion | null = null,
): string {
  const systemPrompt = `あなたは経験豊富なパーソナルトレーナーです。
ユーザーの情報と過去のトレーニング履歴を考慮し、今日のトレーニングプランを提案してください。

【重要な指示】
1. 提案する種目は「利用可能な器具」リストに存在するもののみを使用してください
2. 過去の履歴から適切な重量・回数を推測してください
3. 「前回のトレーニング評価」がある場合は、その改善点を考慮してプランを作成してください
4. 「停滞中の種目」がある場合は、停滞を打破するための対策を考慮してください（重量を下げて回数を増やす、別の種目に変更するなど）
5. 「ディロード推奨」がある場合は、ボリュームを通常の50-60%に抑えたプランを提案してください
6. 「今日の推奨部位」がある場合は、その部位を最優先でプランの軸にしてください
7. 「推奨部位の種目候補」がある場合は、その中から優先して種目を選んでください。最近やっていない種目や、停滞打破のために刺激を変えやすい候補を優先してください
8. 同じ種目が連続採用中の場合は固定化を避け、補助種目では別カテゴリの候補を1つ混ぜてください
9. 「今日の優先候補部位」がある場合は、上位1〜2部位を補助候補としてプランに反映してください。ただし「今日の状態・リクエスト」で明示された希望がある場合はその希望を優先してください
10. 回答は必ず以下のJSON形式で返してください（JSON以外のテキストは含めないでください）
11. 有酸素運動を提案する場合は、setsは1件にし、weightとrepsを0、durationに分数、distanceに距離km（任意）を入れてください

{
  "exercises": [
    {
      "name": "種目名",
      "sets": [
        { "weight": 重量kg（自重・有酸素は0）, "reps": 回数（有酸素は0）, "duration": 有酸素の時間（分、任意）, "distance": 有酸素の距離（km、任意） }
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

  const conversationSection = conversationContext.trim()
    ? `\n\n■ これまでの会話コンテキスト\n${conversationContext}`
    : ''

  const trainingSummarySection = recentLogs.length > 0 || stagnationInfos.length > 0
    ? `\n\n■ AI判断用サマリ\n${formatAiPlanContextSummary(recentLogs, exerciseMasters, stagnationInfos, structuredProfile)}`
    : ''

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

  const memoSection = userMemo.trim()
    ? `\n\n■ 今日の状態・リクエスト\n${userMemo}`
    : ''

  return `${systemPrompt}${profileSection}${exercisesSection}${historySection}${trainingSummarySection}${conversationSection}${evaluationSection}${stagnationSection}${deloadSection}${memoSection}`
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
      exercises: parsed.exercises.map((ex: { name?: string; sets?: { weight?: number; reps?: number; duration?: number; distance?: number }[] }) => ({
        name: String(ex.name || ''),
        sets: (ex.sets || []).map((s: { weight?: number; reps?: number; duration?: number; distance?: number }) => ({
          weight: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
          duration: s.duration == null ? undefined : Number(s.duration) || 0,
          distance: s.distance == null ? undefined : Number(s.distance) || 0,
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

  const [profile, recentLogs, model] = await Promise.all([
    getUserProfile(),
    db.workoutLogs.orderBy('date').reverse().limit(10).toArray(),
    getGeminiModel(),
  ])

  // 過去のログからこの日のログを除外
  const previousLogs = recentLogs.filter(l => l.id !== log.id && l.date < log.date).slice(0, 7)

  // 今回のトレーニング内容をフォーマット
  const todayWorkout = log.exercises.map(ex => {
    const sets = ex.sets.map(s => formatSet(s)).join(', ')
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

  const response = await fetch(`${getApiUrl(model)}?key=${apiKey}`, {
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

  const [profile, recentLogs, exerciseMasters, model] = await Promise.all([
    getUserProfile(),
    db.workoutLogs.orderBy('date').reverse().limit(30).toArray(),
    db.exerciseMasters.toArray(),
    getGeminiModel(),
  ])

  if (recentLogs.length < 2) {
    throw new Error('評価には最低2回以上のトレーニング記録が必要です。')
  }

  // 種目ごとの進捗データを集計
  const exerciseProgress: { [name: string]: { dates: string[]; maxWeights: number[]; maxReps: number[]; maxDurations: number[]; maxDistances: number[]; isBodyweight: boolean; isCardio: boolean } } = {}

  recentLogs.forEach(log => {
    log.exercises.forEach(ex => {
      const master = exerciseMasters.find(m => m.name === ex.name)
      const isBodyweight = master?.isBodyweight || false
      const isCardio = master?.isCardio || false

      if (!exerciseProgress[ex.name]) {
        exerciseProgress[ex.name] = { dates: [], maxWeights: [], maxReps: [], maxDurations: [], maxDistances: [], isBodyweight, isCardio }
      }
      exerciseProgress[ex.name].dates.push(log.date)

      if (isCardio) {
        const maxDuration = Math.max(...ex.sets.map(s => s.duration ?? 0))
        const maxDistance = Math.max(...ex.sets.map(s => s.distance ?? 0))
        exerciseProgress[ex.name].maxDurations.push(maxDuration)
        exerciseProgress[ex.name].maxDistances.push(maxDistance)
      } else {
        const maxWeight = Math.max(...ex.sets.map(s => s.weight))
        const maxReps = Math.max(...ex.sets.map(s => s.reps))
        exerciseProgress[ex.name].maxWeights.push(maxWeight)
        exerciseProgress[ex.name].maxReps.push(maxReps)
      }
    })
  })

  // 進捗サマリを作成
  const progressSummary = Object.entries(exerciseProgress).map(([name, data]) => {
    if (data.isCardio) {
      const firstDuration = data.maxDurations[data.maxDurations.length - 1]
      const lastDuration = data.maxDurations[0]
      const durationDiff = lastDuration - firstDuration
      const distancePart = data.maxDistances.some(d => d > 0)
        ? (() => {
            const firstDist = data.maxDistances[data.maxDistances.length - 1]
            const lastDist = data.maxDistances[0]
            const distDiff = lastDist - firstDist
            return `、距離: ${firstDist}km → ${lastDist}km（${distDiff >= 0 ? '+' : ''}${distDiff.toFixed(1)}km）`
          })()
        : ''
      return `- ${name}（有酸素）: ${firstDuration}分 → ${lastDuration}分（${durationDiff >= 0 ? '+' : ''}${durationDiff}分）${distancePart}`
    } else if (data.isBodyweight) {
      const first = data.maxReps[data.maxReps.length - 1]
      const last = data.maxReps[0]
      const repsDiff = last - first
      return `- ${name}（自重）: ${first}回 → ${last}回（${repsDiff >= 0 ? '+' : ''}${repsDiff}回）`
    } else {
      const first = data.maxWeights[data.maxWeights.length - 1]
      const last = data.maxWeights[0]
      const weightDiff = last - first
      return `- ${name}: ${first}kg → ${last}kg（${weightDiff >= 0 ? '+' : ''}${weightDiff}kg）`
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

  const response = await fetch(`${getApiUrl(model)}?key=${apiKey}`, {
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
export async function generatePlan(userMemo: string, conversationContext: string = ''): Promise<GeneratedPlan> {
  const apiKey = await getApiKey()
  if (!apiKey) {
    throw new Error('APIキーが設定されていません。設定画面でAPIキーを入力してください。')
  }

  // 停滞検出・ディロード検出用に多めのログを取得
  const [profile, structuredProfile, exerciseMasters, recentLogs, allRecentLogs, model, deloadDismissal] = await Promise.all([
    getUserProfile(),
    getStructuredUserProfile(),
    db.exerciseMasters.toArray(),
    db.workoutLogs.orderBy('date').reverse().limit(7).toArray(),
    db.workoutLogs.orderBy('date').reverse().limit(30).toArray(),  // 停滞・ディロード検出用
    getGeminiModel(),
    getDeloadDismissal(),
  ])

  if (exerciseMasters.length === 0) {
    throw new Error('器具マスタが空です。先に種目を登録してください。')
  }

  // 停滞を検出
  const stagnationInfos = detectStagnation(allRecentLogs, exerciseMasters)

  // ディロード推奨を検出
  const deloadSuggestion = getActiveDeloadSuggestion(allRecentLogs, exerciseMasters, deloadDismissal)

  const prompt = buildPrompt(profile, structuredProfile, exerciseMasters, recentLogs, userMemo, conversationContext, stagnationInfos, deloadSuggestion)

  const response = await fetch(`${getApiUrl(model)}?key=${apiKey}`, {
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

  return validateGeneratedPlan(parseGeneratedPlan(text), exerciseMasters)
}
