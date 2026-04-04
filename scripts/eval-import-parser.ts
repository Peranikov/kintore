import { parseExportMarkdown } from '../src/utils/importParser'
import { runEvaluationHarness } from '../src/evals/eval-harness'
import {
  importParserEvalCases,
  type ImportParserEvalCase,
} from '../src/evals/import-parser-eval-cases'

type ImportParserEvalResult = ImportParserEvalCase & {
  actual: ReturnType<typeof normalizeParseResult>
  passed: boolean
}

const normalizeParseResult = (result: ReturnType<typeof parseExportMarkdown>) => ({
  logs: result.logs.map((log) => ({
    date: log.date,
    memo: log.memo,
    exercises: log.exercises.map((exercise) => ({
      name: exercise.name,
      sets: exercise.sets.map((set) => ({
        weight: set.weight,
        reps: set.reps,
        ...(set.duration !== undefined ? { duration: set.duration } : {}),
        ...(set.distance !== undefined ? { distance: set.distance } : {}),
      })),
    })),
  })),
  exercises: [...result.exercises].sort((a, b) => a.name.localeCompare(b.name)),
})

const { passed } = await runEvaluationHarness({
  title: 'Import parser evaluation',
  cases: importParserEvalCases,
  evaluateCase: (testCase): ImportParserEvalResult => {
    const actual = normalizeParseResult(parseExportMarkdown(testCase.markdown))

    return {
      ...testCase,
      actual,
      passed: JSON.stringify(actual) === JSON.stringify(testCase.expected),
    }
  },
  summarize: (results) => [
    {
      label: 'Multi-day cases',
      value: results.filter((result) => result.expected.logs.length > 1).length,
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
