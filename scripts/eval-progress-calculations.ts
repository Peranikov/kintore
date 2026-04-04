import { calculateProgress } from '../src/utils/progressCalculations'
import { runEvaluationHarness } from '../src/evals/eval-harness'
import {
  progressCalculationEvalCases,
  type ProgressCalculationEvalCase,
} from '../src/evals/progress-calculations-eval-cases'

type ProgressCalculationEvalResult = ProgressCalculationEvalCase & {
  actual: ReturnType<typeof calculateProgress>
  passed: boolean
}

const { passed } = await runEvaluationHarness({
  title: 'Progress calculation evaluation',
  cases: progressCalculationEvalCases,
  evaluateCase: (testCase): ProgressCalculationEvalResult => {
    const actual = calculateProgress(
      testCase.currentSets,
      testCase.previousSets,
      testCase.isBodyweight,
      testCase.isCardio
    )

    return {
      ...testCase,
      actual,
      passed: JSON.stringify(actual) === JSON.stringify(testCase.expected),
    }
  },
  summarize: (results) => [
    {
      label: 'Cardio cases',
      value: results.filter((result) => result.isCardio).length,
    },
    {
      label: 'Bodyweight cases',
      value: results.filter((result) => result.isBodyweight).length,
    },
  ],
  printFailure: (result) => {
    console.log(`- ${result.name}`)
    const error = 'error' in result ? result.error : undefined
    if (error) {
      console.log(`  error: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
      return
    }

    console.log(`  expected: ${JSON.stringify(result.expected)}`)
    console.log(`  actual: ${JSON.stringify(result.actual)}`)
  },
})

process.exit(passed ? 0 : 1)
