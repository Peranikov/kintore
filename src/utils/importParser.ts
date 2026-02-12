import type { WorkoutLog, Exercise, Set } from '../types'

export interface ParsedExerciseInfo {
  name: string
  isBodyweight: boolean
  isCardio: boolean
}

export interface ParseResult {
  logs: Omit<WorkoutLog, 'id'>[]
  exercises: ParsedExerciseInfo[]
}

const DATE_HEADER_RE = /^## (\d{4}-\d{2}-\d{2})/
const EXERCISE_HEADER_RE = /^### (.+)/
const MEMO_HEADER_RE = /^#### メモ/
const WEIGHT_SET_RE = /^- \d+セット目: ([\d.]+)kg × (\d+)回/
const BODYWEIGHT_SET_RE = /^- \d+セット目: (\d+)回/
const CARDIO_WITH_DISTANCE_RE = /^- (\d+)分 \/ ([\d.]+)km/
const CARDIO_RE = /^- (\d+)分$/

export function parseExportMarkdown(text: string): ParseResult {
  const lines = text.split('\n')
  const logs: Omit<WorkoutLog, 'id'>[] = []
  const exerciseMap = new Map<string, ParsedExerciseInfo>()

  let currentDate: string | null = null
  let currentExercises: Exercise[] = []
  let currentExercise: Exercise | null = null
  let currentMemo: string[] = []
  let inMemo = false

  function finishExercise() {
    if (currentExercise && currentExercise.sets.length > 0) {
      currentExercises.push(currentExercise)
    }
    currentExercise = null
  }

  function finishDay() {
    finishExercise()
    if (currentDate && currentExercises.length > 0) {
      const now = Date.now()
      logs.push({
        date: currentDate,
        exercises: currentExercises,
        memo: currentMemo.length > 0 ? currentMemo.join('\n') : undefined,
        createdAt: now,
        updatedAt: now,
      })
    }
    currentDate = null
    currentExercises = []
    currentMemo = []
    inMemo = false
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // 日付ヘッダー
    const dateMatch = trimmed.match(DATE_HEADER_RE)
    if (dateMatch) {
      finishDay()
      currentDate = dateMatch[1]
      continue
    }

    // 種目ヘッダー
    const exerciseMatch = trimmed.match(EXERCISE_HEADER_RE)
    if (exerciseMatch) {
      finishExercise()
      inMemo = false
      currentExercise = {
        id: crypto.randomUUID(),
        name: exerciseMatch[1],
        sets: [],
      }
      continue
    }

    // メモヘッダー
    if (MEMO_HEADER_RE.test(trimmed)) {
      finishExercise()
      inMemo = true
      continue
    }

    // セパレータ
    if (trimmed === '---') {
      continue
    }

    // メモ内容
    if (inMemo && currentDate) {
      if (trimmed) {
        currentMemo.push(trimmed)
      }
      continue
    }

    // セットデータのパース
    if (currentExercise) {
      const set = parseSetLine(trimmed)
      if (set) {
        currentExercise.sets.push(set.set)
        if (!exerciseMap.has(currentExercise.name)) {
          exerciseMap.set(currentExercise.name, {
            name: currentExercise.name,
            isBodyweight: set.type === 'bodyweight',
            isCardio: set.type === 'cardio',
          })
        }
      }
    }
  }

  // 最後のログを確定
  finishDay()

  return {
    logs,
    exercises: Array.from(exerciseMap.values()),
  }
}

type SetType = 'weight' | 'bodyweight' | 'cardio'

function parseSetLine(line: string): { set: Set; type: SetType } | null {
  // ウェイトトレーニング: "- 1セット目: 60kg × 10回"
  const weightMatch = line.match(WEIGHT_SET_RE)
  if (weightMatch) {
    return {
      set: { weight: parseFloat(weightMatch[1]), reps: parseInt(weightMatch[2]) },
      type: 'weight',
    }
  }

  // 有酸素（距離あり）: "- 30分 / 5.0km"
  const cardioDistMatch = line.match(CARDIO_WITH_DISTANCE_RE)
  if (cardioDistMatch) {
    return {
      set: { weight: 0, reps: 0, duration: parseInt(cardioDistMatch[1]), distance: parseFloat(cardioDistMatch[2]) },
      type: 'cardio',
    }
  }

  // 有酸素（距離なし）: "- 30分"
  const cardioMatch = line.match(CARDIO_RE)
  if (cardioMatch) {
    return {
      set: { weight: 0, reps: 0, duration: parseInt(cardioMatch[1]) },
      type: 'cardio',
    }
  }

  // 自重トレーニング: "- 1セット目: 10回"
  const bwMatch = line.match(BODYWEIGHT_SET_RE)
  if (bwMatch) {
    return {
      set: { weight: 0, reps: parseInt(bwMatch[1]) },
      type: 'bodyweight',
    }
  }

  return null
}
