import type { ProgressComparison, ProgressMetric } from '../types'
import {
  getProgressColorClass,
  getProgressIcon,
  formatDiff,
} from '../utils/progressCalculations'

interface ProgressIndicatorProps {
  comparison: ProgressComparison
  compact?: boolean  // true: アイコンと差分のみ, false: ラベル付き詳細表示
}

interface MetricDisplayProps {
  label: string
  metric: ProgressMetric
  unit: string
  compact?: boolean
}

function MetricDisplay({ label, metric, unit, compact }: MetricDisplayProps) {
  const colorClass = getProgressColorClass(metric.status)
  const icon = getProgressIcon(metric.status)
  const diffText = formatDiff(metric.diff, unit)

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-0.5 ${colorClass}`}>
        <span className="text-xs">{icon}</span>
        <span className="text-xs font-medium">{diffText}</span>
      </span>
    )
  }

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${colorClass}`}>
      <span className="text-sm">{icon}</span>
      <span className="text-xs text-gray-600">{label}</span>
      <span className="text-sm font-medium">{diffText}</span>
    </div>
  )
}

export function ProgressIndicator({ comparison, compact = false }: ProgressIndicatorProps) {
  const metrics: Array<{ key: string; label: string; metric?: ProgressMetric; unit: string }> = []

  // ウェイトトレーニング
  if (comparison.maxWeight) {
    metrics.push({ key: 'maxWeight', label: '最大重量', metric: comparison.maxWeight, unit: 'kg' })
  }
  if (comparison.totalVolume) {
    metrics.push({ key: 'totalVolume', label: 'ボリューム', metric: comparison.totalVolume, unit: 'kg' })
  }
  if (comparison.estimated1RM) {
    metrics.push({ key: 'estimated1RM', label: '1RM', metric: comparison.estimated1RM, unit: 'kg' })
  }

  // 自重トレーニング
  if (comparison.maxReps) {
    metrics.push({ key: 'maxReps', label: '最大回数', metric: comparison.maxReps, unit: '回' })
  }
  if (comparison.totalReps) {
    metrics.push({ key: 'totalReps', label: '合計', metric: comparison.totalReps, unit: '回' })
  }

  // 有酸素運動
  if (comparison.totalDuration) {
    metrics.push({ key: 'totalDuration', label: '時間', metric: comparison.totalDuration, unit: '分' })
  }
  if (comparison.totalDistance) {
    metrics.push({ key: 'totalDistance', label: '距離', metric: comparison.totalDistance, unit: 'km' })
  }

  if (metrics.length === 0) {
    return null
  }

  const validMetrics = metrics.filter(m => m.metric !== undefined)

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {validMetrics.map(({ key, label, metric, unit }) => (
          <div key={key} className="flex items-center gap-1">
            <span className="text-xs text-gray-500">{label}</span>
            <MetricDisplay label={label} metric={metric!} unit={unit} compact />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {validMetrics.map(({ key, label, metric, unit }) => (
        <MetricDisplay key={key} label={label} metric={metric!} unit={unit} />
      ))}
    </div>
  )
}

// コンパクト版（単一メトリック用）
interface SingleProgressProps {
  metric: ProgressMetric
  label: string
  unit: string
}

export function SingleProgress({ metric, label, unit }: SingleProgressProps) {
  const colorClass = getProgressColorClass(metric.status)
  const icon = getProgressIcon(metric.status)
  const diffText = formatDiff(metric.diff, unit)

  return (
    <span className={`inline-flex items-center gap-0.5 ${colorClass}`} title={`${label}: ${diffText}`}>
      <span className="text-xs">{icon}</span>
      <span className="text-xs font-medium">{diffText}</span>
    </span>
  )
}
