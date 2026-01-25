import type { Set, ProgressStatus, ProgressMetric, ProgressComparison } from '../types'
import {
  getMaxWeight,
  getTotalVolume,
  getMaxEstimated1RM,
  getMaxReps,
  getTotalReps,
  getTotalDuration,
  getTotalDistance,
} from './graphCalculations'

// 維持と判定する閾値（±5%）
const SAME_THRESHOLD_PERCENT = 5

/**
 * 進捗状態を判定
 * - up: +5%超の向上
 * - same: ±5%以内（維持）
 * - down: -5%超の低下
 */
export function getProgressStatus(current: number, previous: number): ProgressStatus {
  if (previous === 0) {
    return current > 0 ? 'up' : 'same'
  }

  const diffPercent = ((current - previous) / previous) * 100

  if (diffPercent > SAME_THRESHOLD_PERCENT) {
    return 'up'
  } else if (diffPercent < -SAME_THRESHOLD_PERCENT) {
    return 'down'
  }
  return 'same'
}

/**
 * 進捗メトリックを計算
 */
function createProgressMetric(current: number, previous: number): ProgressMetric {
  const diff = current - previous
  const diffPercent = previous !== 0 ? Math.round((diff / previous) * 1000) / 10 : (current > 0 ? 100 : 0)

  return {
    current,
    previous,
    diff: Math.round(diff * 10) / 10,
    diffPercent,
    status: getProgressStatus(current, previous),
  }
}

/**
 * ウェイトトレーニングの進捗を計算
 */
export function calculateWeightProgress(
  currentSets: Set[],
  previousSets: Set[]
): ProgressComparison {
  const currentMaxWeight = getMaxWeight(currentSets)
  const previousMaxWeight = getMaxWeight(previousSets)

  const currentTotalVolume = getTotalVolume(currentSets)
  const previousTotalVolume = getTotalVolume(previousSets)

  const currentEstimated1RM = getMaxEstimated1RM(currentSets)
  const previousEstimated1RM = getMaxEstimated1RM(previousSets)

  return {
    maxWeight: createProgressMetric(currentMaxWeight, previousMaxWeight),
    totalVolume: createProgressMetric(currentTotalVolume, previousTotalVolume),
    estimated1RM: createProgressMetric(currentEstimated1RM, previousEstimated1RM),
  }
}

/**
 * 自重トレーニングの進捗を計算
 */
export function calculateBodyweightProgress(
  currentSets: Set[],
  previousSets: Set[]
): ProgressComparison {
  const currentMaxReps = getMaxReps(currentSets)
  const previousMaxReps = getMaxReps(previousSets)

  const currentTotalReps = getTotalReps(currentSets)
  const previousTotalReps = getTotalReps(previousSets)

  return {
    maxReps: createProgressMetric(currentMaxReps, previousMaxReps),
    totalReps: createProgressMetric(currentTotalReps, previousTotalReps),
  }
}

/**
 * 有酸素運動の進捗を計算
 */
export function calculateCardioProgress(
  currentSets: Set[],
  previousSets: Set[]
): ProgressComparison {
  const currentDuration = getTotalDuration(currentSets)
  const previousDuration = getTotalDuration(previousSets)

  const currentDistance = getTotalDistance(currentSets)
  const previousDistance = getTotalDistance(previousSets)

  return {
    totalDuration: createProgressMetric(currentDuration, previousDuration),
    totalDistance: createProgressMetric(currentDistance, previousDistance),
  }
}

/**
 * 種目タイプに応じた進捗を計算
 */
export function calculateProgress(
  currentSets: Set[],
  previousSets: Set[],
  isBodyweight: boolean,
  isCardio: boolean
): ProgressComparison {
  if (isCardio) {
    return calculateCardioProgress(currentSets, previousSets)
  }
  if (isBodyweight) {
    return calculateBodyweightProgress(currentSets, previousSets)
  }
  return calculateWeightProgress(currentSets, previousSets)
}

/**
 * 進捗状態に応じた色クラスを取得
 */
export function getProgressColorClass(status: ProgressStatus): string {
  switch (status) {
    case 'up':
      return 'text-green-600'
    case 'down':
      return 'text-red-600'
    case 'same':
      return 'text-yellow-600'
  }
}

/**
 * 進捗状態に応じた背景色クラスを取得
 */
export function getProgressBgClass(status: ProgressStatus): string {
  switch (status) {
    case 'up':
      return 'bg-green-100'
    case 'down':
      return 'bg-red-100'
    case 'same':
      return 'bg-yellow-100'
  }
}

/**
 * 進捗状態に応じたアイコンを取得
 */
export function getProgressIcon(status: ProgressStatus): string {
  switch (status) {
    case 'up':
      return '↑'
    case 'down':
      return '↓'
    case 'same':
      return '→'
  }
}

/**
 * 差分を表示用文字列にフォーマット
 */
export function formatDiff(diff: number, unit: string): string {
  const sign = diff > 0 ? '+' : ''
  return `${sign}${diff}${unit}`
}
