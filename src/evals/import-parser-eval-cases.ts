import { createEvaluationCase } from './eval-harness'

type NormalizedLog = {
  date: string
  memo?: string
  exercises: Array<{
    name: string
    sets: Array<{
      weight: number
      reps: number
      duration?: number
      distance?: number
    }>
  }>
}

type NormalizedParseResult = {
  logs: NormalizedLog[]
  exercises: Array<{
    name: string
    isBodyweight: boolean
    isCardio: boolean
  }>
}

export type ImportParserEvalCase = {
  name: string
  markdown: string
  expected: NormalizedParseResult
}

export const importParserEvalCases: ImportParserEvalCase[] = [
  createEvaluationCase({
    name: 'parses mixed weight, bodyweight, cardio, and memo sections from export markdown',
    markdown: [
      '# トレーニング記録',
      '',
      '## 2026-03-30',
      '',
      '### ベンチプレス',
      '- 1セット目: 60kg × 10回',
      '- 2セット目: 65kg × 8回',
      '',
      '### 懸垂',
      '- 1セット目: 10回',
      '- 2セット目: 8回',
      '',
      '### ランニング',
      '- 30分 / 5.5km',
      '',
      '#### メモ',
      'フォームを意識',
      '呼吸を安定させる',
      '',
      '---',
    ].join('\n'),
    expected: {
      logs: [
        {
          date: '2026-03-30',
          memo: 'フォームを意識\n呼吸を安定させる',
          exercises: [
            {
              name: 'ベンチプレス',
              sets: [
                { weight: 60, reps: 10 },
                { weight: 65, reps: 8 },
              ],
            },
            {
              name: '懸垂',
              sets: [
                { weight: 0, reps: 10 },
                { weight: 0, reps: 8 },
              ],
            },
            {
              name: 'ランニング',
              sets: [
                { weight: 0, reps: 0, duration: 30, distance: 5.5 },
              ],
            },
          ],
        },
      ],
      exercises: [
        { name: 'ベンチプレス', isBodyweight: false, isCardio: false },
        { name: 'ランニング', isBodyweight: false, isCardio: true },
        { name: '懸垂', isBodyweight: true, isCardio: false },
      ],
    },
  }),
  createEvaluationCase({
    name: 'parses multiple days and cardio without distance while ignoring empty exercise blocks',
    markdown: [
      '# トレーニング記録',
      '',
      '## 2026-03-28',
      '',
      '### スクワット',
      '- 1セット目: 100kg × 5回',
      '',
      '### メモだけの種目',
      '',
      '#### メモ',
      '高重量の日',
      '',
      '---',
      '',
      '## 2026-03-29',
      '',
      '### バイク',
      '- 20分',
      '',
      '---',
    ].join('\n'),
    expected: {
      logs: [
        {
          date: '2026-03-28',
          memo: '高重量の日',
          exercises: [
            {
              name: 'スクワット',
              sets: [
                { weight: 100, reps: 5 },
              ],
            },
          ],
        },
        {
          date: '2026-03-29',
          exercises: [
            {
              name: 'バイク',
              sets: [
                { weight: 0, reps: 0, duration: 20 },
              ],
            },
          ],
        },
      ],
      exercises: [
        { name: 'スクワット', isBodyweight: false, isCardio: false },
        { name: 'バイク', isBodyweight: false, isCardio: true },
      ],
    },
  }),
]
