import { useState } from 'react'
import type { WeeklyVolumeData } from '../utils/volumeCalculations'
import {
  getVolumeStatus,
  formatWeekRange,
} from '../utils/volumeCalculations'

interface WeeklyVolumeProps {
  data: WeeklyVolumeData[]
  compact?: boolean // true: ホーム画面用コンパクト表示
}

export function WeeklyVolume({ data, compact = false }: WeeklyVolumeProps) {
  const [isExpanded, setIsExpanded] = useState(!compact)

  // トレーニングがある部位のみフィルタリング（詳細表示時は全部位表示）
  const filteredData = compact && !isExpanded
    ? data.filter(d => d.totalSets > 0)
    : data

  // 最大セット数（バーの幅計算用）
  const maxSets = Math.max(25, ...data.map(d => d.totalSets))

  if (compact && filteredData.length === 0 && !isExpanded) {
    return null // データがない場合はコンパクトモードでは非表示
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-800">
          週間ボリューム
          <span className="ml-2 text-sm font-normal text-gray-500">
            {formatWeekRange()}
          </span>
        </h3>
        {compact && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-blue-600 min-w-11 min-h-11 flex items-center justify-center"
          >
            {isExpanded ? '閉じる' : '詳細'}
          </button>
        )}
      </div>

      {/* 凡例 */}
      {(isExpanded || !compact) && (
        <div className="flex gap-4 text-xs text-gray-600 mb-3">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span>メイン</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-300 rounded" />
            <span>サブ(×0.5)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">|</span>
            <span>推奨: 10-20セット</span>
          </div>
        </div>
      )}

      {/* 部位別バー */}
      <div className="space-y-2">
        {filteredData.map(item => {
          const status = getVolumeStatus(item.totalSets)
          const mainWidth = (item.mainSets / maxSets) * 100
          const subWidth = (item.subSets / maxSets) * 100
          const recommendedMinPos = (item.recommended.min / maxSets) * 100
          const recommendedMaxPos = (item.recommended.max / maxSets) * 100

          return (
            <div key={item.muscle} className="flex items-center gap-2">
              <div className="w-12 text-sm text-gray-700 shrink-0">
                {item.label}
              </div>
              <div className="flex-1 relative h-6 bg-gray-100 rounded overflow-hidden">
                {/* 推奨範囲の背景 */}
                <div
                  className="absolute top-0 bottom-0 bg-green-100"
                  style={{
                    left: `${recommendedMinPos}%`,
                    width: `${recommendedMaxPos - recommendedMinPos}%`,
                  }}
                />

                {/* メインセットのバー */}
                {item.mainSets > 0 && (
                  <div
                    className="absolute top-0 bottom-0 bg-blue-500"
                    style={{ width: `${mainWidth}%` }}
                  />
                )}

                {/* サブセットのバー（メインの後ろに） */}
                {item.subSets > 0 && (
                  <div
                    className="absolute top-0 bottom-0 bg-blue-300"
                    style={{
                      left: `${mainWidth}%`,
                      width: `${subWidth}%`,
                    }}
                  />
                )}

                {/* 推奨範囲のライン */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
                  style={{ left: `${recommendedMinPos}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
                  style={{ left: `${recommendedMaxPos}%` }}
                />
              </div>
              <div className={`w-14 text-right text-sm font-medium shrink-0 ${
                status === 'optimal' ? 'text-green-600' :
                status === 'insufficient' ? 'text-yellow-600' :
                status === 'excessive' ? 'text-red-600' :
                'text-gray-400'
              }`}>
                {item.totalSets > 0 ? item.totalSets.toFixed(1) : '-'}
              </div>
            </div>
          )
        })}
      </div>

      {/* サマリー */}
      {(isExpanded || !compact) && (
        <div className="mt-4 pt-3 border-t text-xs text-gray-500">
          <div className="flex justify-between">
            <span>
              適正: {data.filter(d => getVolumeStatus(d.totalSets) === 'optimal').length}部位
            </span>
            <span>
              不足: {data.filter(d => getVolumeStatus(d.totalSets) === 'insufficient').length}部位
            </span>
            <span>
              過多: {data.filter(d => getVolumeStatus(d.totalSets) === 'excessive').length}部位
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
