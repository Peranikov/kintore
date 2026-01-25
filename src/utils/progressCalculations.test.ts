import { describe, it, expect } from 'vitest'
import type { Set } from '../types'
import {
  getProgressStatus,
  calculateProgress,
  calculateWeightProgress,
  calculateBodyweightProgress,
  calculateCardioProgress,
  getProgressColorClass,
  getProgressBgClass,
  getProgressIcon,
  formatDiff,
} from './progressCalculations'

describe('progressCalculations', () => {
  describe('getProgressStatus', () => {
    it('returns "up" when improvement is greater than 5%', () => {
      expect(getProgressStatus(110, 100)).toBe('up')
      expect(getProgressStatus(106, 100)).toBe('up')
    })

    it('returns "same" when within ±5%', () => {
      expect(getProgressStatus(100, 100)).toBe('same')
      expect(getProgressStatus(105, 100)).toBe('same')
      expect(getProgressStatus(95, 100)).toBe('same')
    })

    it('returns "down" when decrease is greater than 5%', () => {
      expect(getProgressStatus(90, 100)).toBe('down')
      expect(getProgressStatus(94, 100)).toBe('down')
    })

    it('returns "up" when previous is 0 and current is positive', () => {
      expect(getProgressStatus(50, 0)).toBe('up')
    })

    it('returns "same" when both are 0', () => {
      expect(getProgressStatus(0, 0)).toBe('same')
    })
  })

  describe('calculateWeightProgress', () => {
    it('calculates max weight progress', () => {
      const currentSets: Set[] = [
        { weight: 80, reps: 10 },
        { weight: 100, reps: 5 },
      ]
      const previousSets: Set[] = [
        { weight: 70, reps: 10 },
        { weight: 90, reps: 5 },
      ]

      const result = calculateWeightProgress(currentSets, previousSets)

      expect(result.maxWeight?.current).toBe(100)
      expect(result.maxWeight?.previous).toBe(90)
      expect(result.maxWeight?.diff).toBe(10)
      expect(result.maxWeight?.status).toBe('up')
    })

    it('calculates total volume progress', () => {
      const currentSets: Set[] = [
        { weight: 60, reps: 10 },
        { weight: 60, reps: 10 },
      ]
      const previousSets: Set[] = [
        { weight: 50, reps: 10 },
        { weight: 50, reps: 10 },
      ]

      const result = calculateWeightProgress(currentSets, previousSets)

      expect(result.totalVolume?.current).toBe(1200)
      expect(result.totalVolume?.previous).toBe(1000)
      expect(result.totalVolume?.status).toBe('up')
    })

    it('calculates estimated 1RM progress', () => {
      const currentSets: Set[] = [{ weight: 100, reps: 5 }]
      const previousSets: Set[] = [{ weight: 90, reps: 5 }]

      const result = calculateWeightProgress(currentSets, previousSets)

      expect(result.estimated1RM).toBeDefined()
      expect(result.estimated1RM!.current).toBeGreaterThan(result.estimated1RM!.previous)
    })
  })

  describe('calculateBodyweightProgress', () => {
    it('calculates max reps progress', () => {
      const currentSets: Set[] = [
        { weight: 0, reps: 15 },
        { weight: 0, reps: 12 },
      ]
      const previousSets: Set[] = [
        { weight: 0, reps: 10 },
        { weight: 0, reps: 10 },
      ]

      const result = calculateBodyweightProgress(currentSets, previousSets)

      expect(result.maxReps?.current).toBe(15)
      expect(result.maxReps?.previous).toBe(10)
      expect(result.maxReps?.status).toBe('up')
    })

    it('calculates total reps progress', () => {
      const currentSets: Set[] = [
        { weight: 0, reps: 20 },
        { weight: 0, reps: 20 },
      ]
      const previousSets: Set[] = [
        { weight: 0, reps: 15 },
        { weight: 0, reps: 15 },
      ]

      const result = calculateBodyweightProgress(currentSets, previousSets)

      expect(result.totalReps?.current).toBe(40)
      expect(result.totalReps?.previous).toBe(30)
      expect(result.totalReps?.status).toBe('up')
    })
  })

  describe('calculateCardioProgress', () => {
    it('calculates duration progress', () => {
      const currentSets: Set[] = [{ weight: 0, reps: 0, duration: 45 }]
      const previousSets: Set[] = [{ weight: 0, reps: 0, duration: 30 }]

      const result = calculateCardioProgress(currentSets, previousSets)

      expect(result.totalDuration?.current).toBe(45)
      expect(result.totalDuration?.previous).toBe(30)
      expect(result.totalDuration?.status).toBe('up')
    })

    it('calculates distance progress', () => {
      const currentSets: Set[] = [{ weight: 0, reps: 0, duration: 30, distance: 5.5 }]
      const previousSets: Set[] = [{ weight: 0, reps: 0, duration: 30, distance: 5.0 }]

      const result = calculateCardioProgress(currentSets, previousSets)

      expect(result.totalDistance?.current).toBe(5.5)
      expect(result.totalDistance?.previous).toBe(5.0)
      expect(result.totalDistance?.status).toBe('up')
    })

    it('handles missing distance', () => {
      const currentSets: Set[] = [{ weight: 0, reps: 0, duration: 30 }]
      const previousSets: Set[] = [{ weight: 0, reps: 0, duration: 30 }]

      const result = calculateCardioProgress(currentSets, previousSets)

      expect(result.totalDistance?.current).toBe(0)
      expect(result.totalDistance?.previous).toBe(0)
    })
  })

  describe('calculateProgress', () => {
    it('delegates to calculateWeightProgress for weight training', () => {
      const currentSets: Set[] = [{ weight: 100, reps: 5 }]
      const previousSets: Set[] = [{ weight: 90, reps: 5 }]

      const result = calculateProgress(currentSets, previousSets, false, false)

      expect(result.maxWeight).toBeDefined()
      expect(result.totalVolume).toBeDefined()
      expect(result.estimated1RM).toBeDefined()
    })

    it('delegates to calculateBodyweightProgress for bodyweight training', () => {
      const currentSets: Set[] = [{ weight: 0, reps: 15 }]
      const previousSets: Set[] = [{ weight: 0, reps: 10 }]

      const result = calculateProgress(currentSets, previousSets, true, false)

      expect(result.maxReps).toBeDefined()
      expect(result.totalReps).toBeDefined()
      expect(result.maxWeight).toBeUndefined()
    })

    it('delegates to calculateCardioProgress for cardio', () => {
      const currentSets: Set[] = [{ weight: 0, reps: 0, duration: 45 }]
      const previousSets: Set[] = [{ weight: 0, reps: 0, duration: 30 }]

      const result = calculateProgress(currentSets, previousSets, false, true)

      expect(result.totalDuration).toBeDefined()
      expect(result.totalDistance).toBeDefined()
      expect(result.maxWeight).toBeUndefined()
    })
  })

  describe('getProgressColorClass', () => {
    it('returns green for up', () => {
      expect(getProgressColorClass('up')).toBe('text-green-600')
    })

    it('returns yellow for same', () => {
      expect(getProgressColorClass('same')).toBe('text-yellow-600')
    })

    it('returns red for down', () => {
      expect(getProgressColorClass('down')).toBe('text-red-600')
    })
  })

  describe('getProgressBgClass', () => {
    it('returns green bg for up', () => {
      expect(getProgressBgClass('up')).toBe('bg-green-100')
    })

    it('returns yellow bg for same', () => {
      expect(getProgressBgClass('same')).toBe('bg-yellow-100')
    })

    it('returns red bg for down', () => {
      expect(getProgressBgClass('down')).toBe('bg-red-100')
    })
  })

  describe('getProgressIcon', () => {
    it('returns up arrow for up', () => {
      expect(getProgressIcon('up')).toBe('↑')
    })

    it('returns right arrow for same', () => {
      expect(getProgressIcon('same')).toBe('→')
    })

    it('returns down arrow for down', () => {
      expect(getProgressIcon('down')).toBe('↓')
    })
  })

  describe('formatDiff', () => {
    it('formats positive diff with plus sign', () => {
      expect(formatDiff(10, 'kg')).toBe('+10kg')
    })

    it('formats negative diff without plus sign', () => {
      expect(formatDiff(-5, 'kg')).toBe('-5kg')
    })

    it('formats zero without sign', () => {
      expect(formatDiff(0, 'kg')).toBe('0kg')
    })

    it('formats decimal values', () => {
      expect(formatDiff(2.5, 'km')).toBe('+2.5km')
    })
  })
})
