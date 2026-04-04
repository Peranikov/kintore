import { createEvaluationCase } from './eval-harness'
import type { Set, ProgressComparison } from '../types'

export type ProgressCalculationEvalCase = {
  name: string
  currentSets: Set[]
  previousSets: Set[]
  isBodyweight: boolean
  isCardio: boolean
  expected: ProgressComparison
}

export const progressCalculationEvalCases: ProgressCalculationEvalCase[] = [
  createEvaluationCase({
    name: 'treats an exact five percent increase as same for weight training metrics',
    currentSets: [
      { weight: 105, reps: 5 },
      { weight: 95, reps: 8 },
    ],
    previousSets: [
      { weight: 100, reps: 5 },
      { weight: 90, reps: 8 },
    ],
    isBodyweight: false,
    isCardio: false,
    expected: {
      maxWeight: {
        current: 105,
        previous: 100,
        diff: 5,
        diffPercent: 5,
        status: 'same',
      },
      totalVolume: {
        current: 1285,
        previous: 1220,
        diff: 65,
        diffPercent: 5.3,
        status: 'up',
      },
      estimated1RM: {
        current: 122.5,
        previous: 116.7,
        diff: 5.8,
        diffPercent: 5,
        status: 'same',
      },
    },
  }),
  createEvaluationCase({
    name: 'routes bodyweight exercises to rep-based comparison metrics',
    currentSets: [
      { weight: 0, reps: 12 },
      { weight: 0, reps: 10 },
    ],
    previousSets: [
      { weight: 0, reps: 10 },
      { weight: 0, reps: 10 },
    ],
    isBodyweight: true,
    isCardio: false,
    expected: {
      maxReps: {
        current: 12,
        previous: 10,
        diff: 2,
        diffPercent: 20,
        status: 'up',
      },
      totalReps: {
        current: 22,
        previous: 20,
        diff: 2,
        diffPercent: 10,
        status: 'up',
      },
    },
  }),
  createEvaluationCase({
    name: 'routes cardio exercises to duration and distance comparisons',
    currentSets: [
      { weight: 0, reps: 0, duration: 20, distance: 3.2 },
      { weight: 0, reps: 0, duration: 10, distance: 1.8 },
    ],
    previousSets: [
      { weight: 0, reps: 0, duration: 35, distance: 5.5 },
    ],
    isBodyweight: false,
    isCardio: true,
    expected: {
      totalDuration: {
        current: 30,
        previous: 35,
        diff: -5,
        diffPercent: -14.3,
        status: 'down',
      },
      totalDistance: {
        current: 5,
        previous: 5.5,
        diff: -0.5,
        diffPercent: -9.1,
        status: 'down',
      },
    },
  }),
]
