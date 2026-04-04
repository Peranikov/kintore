type EvaluationMetric = {
  label: string
  value: number | string
  format?: 'percent'
  detail?: string
}

type FailedEvaluationResult = {
  name: string
  passed: false
  error?: unknown
}

type EvaluationResult = {
  name: string
  passed: boolean
}

type EvaluationHarnessOptions<TCase, TResult extends EvaluationResult> = {
  title: string
  cases: readonly TCase[]
  evaluateCase: (testCase: TCase) => TResult | Promise<TResult>
  printFailure: (result: TResult | (TCase & FailedEvaluationResult)) => void
  summarize?: (results: Array<TResult | (TCase & FailedEvaluationResult)>) => EvaluationMetric[] | Promise<EvaluationMetric[]>
}

const formatMetricValue = (metric: EvaluationMetric) => {
  const { value, format } = metric

  if (format === 'percent' && typeof value === 'number' && Number.isFinite(value)) {
    return `${(value * 100).toFixed(1)}%`
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? `${value}` : value.toFixed(3)
  }

  return String(value)
}

export const createEvaluationCase = <TCase>(definition: TCase) => definition

export const runEvaluationHarness = async <TCase extends { name: string }, TResult extends EvaluationResult>({
  title,
  cases,
  evaluateCase,
  printFailure,
  summarize,
}: EvaluationHarnessOptions<TCase, TResult>) => {
  const results: Array<TResult | (TCase & FailedEvaluationResult)> = []

  for (const testCase of cases) {
    try {
      results.push(await evaluateCase(testCase))
    } catch (error) {
      results.push({
        ...testCase,
        passed: false,
        error,
      })
    }
  }

  const passedCases = results.filter((result) => result.passed).length

  console.log(title)
  console.log(`Cases: ${passedCases}/${results.length} passed`)

  const summaryMetrics = (await summarize?.(results)) ?? []
  for (const metric of summaryMetrics) {
    console.log(`${metric.label}: ${formatMetricValue(metric)}${metric.detail ? ` (${metric.detail})` : ''}`)
  }

  const failedCases = results.filter((result) => !result.passed)
  if (failedCases.length === 0) {
    console.log('All cases passed.')
    return { passed: true, results }
  }

  console.log('')
  console.log('Failed cases:')
  for (const result of failedCases) {
    printFailure(result)
  }

  return { passed: false, results }
}
