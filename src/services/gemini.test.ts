import { describe, it, expect } from 'vitest'
import {
  formatWorkoutLogs,
  formatExerciseMasters,
  buildPrompt,
  parseGeneratedPlan,
} from './gemini'
import type { WorkoutLog, ExerciseMaster } from '../types'

describe('formatWorkoutLogs', () => {
  it('空の配列の場合、メッセージを返す', () => {
    const result = formatWorkoutLogs([])
    expect(result).toBe('トレーニング履歴はまだありません。')
  })

  it('ウェイトトレーニングをフォーマットする', () => {
    const logs: WorkoutLog[] = [
      {
        id: 1,
        date: '2024-01-15',
        exercises: [
          {
            id: 'ex1',
            name: 'ベンチプレス',
            sets: [
              { weight: 60, reps: 10 },
              { weight: 70, reps: 8 },
            ],
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    const result = formatWorkoutLogs(logs)
    expect(result).toContain('【2024-01-15】')
    expect(result).toContain('ベンチプレス')
    expect(result).toContain('60kg×10回')
    expect(result).toContain('70kg×8回')
  })

  it('自重トレーニング（weight=0）を回数のみでフォーマットする', () => {
    const logs: WorkoutLog[] = [
      {
        id: 1,
        date: '2024-01-15',
        exercises: [
          {
            id: 'ex1',
            name: 'チンニング',
            sets: [
              { weight: 0, reps: 10 },
              { weight: 0, reps: 8 },
            ],
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    const result = formatWorkoutLogs(logs)
    expect(result).toContain('10回')
    expect(result).toContain('8回')
    expect(result).not.toContain('0kg')
  })

  it('複数の日付のログをフォーマットする', () => {
    const logs: WorkoutLog[] = [
      {
        id: 1,
        date: '2024-01-15',
        exercises: [{ id: 'ex1', name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 2,
        date: '2024-01-13',
        exercises: [{ id: 'ex2', name: 'スクワット', sets: [{ weight: 80, reps: 8 }] }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    const result = formatWorkoutLogs(logs)
    expect(result).toContain('【2024-01-15】')
    expect(result).toContain('【2024-01-13】')
    expect(result).toContain('ベンチプレス')
    expect(result).toContain('スクワット')
  })
})

describe('formatExerciseMasters', () => {
  it('空の配列の場合、空文字を返す', () => {
    const result = formatExerciseMasters([])
    expect(result).toBe('')
  })

  it('通常の種目をフォーマットする', () => {
    const masters: ExerciseMaster[] = [
      { id: 1, name: 'ベンチプレス', createdAt: Date.now() },
      { id: 2, name: 'スクワット', createdAt: Date.now() },
    ]

    const result = formatExerciseMasters(masters)
    expect(result).toBe('- ベンチプレス\n- スクワット')
  })

  it('自重トレーニングに（自重）サフィックスを付ける', () => {
    const masters: ExerciseMaster[] = [
      { id: 1, name: 'ベンチプレス', createdAt: Date.now() },
      { id: 2, name: 'チンニング', isBodyweight: true, createdAt: Date.now() },
    ]

    const result = formatExerciseMasters(masters)
    expect(result).toContain('- ベンチプレス')
    expect(result).toContain('- チンニング（自重）')
  })
})

describe('parseGeneratedPlan', () => {
  it('正常なJSONをパースする', () => {
    const json = JSON.stringify({
      exercises: [
        { name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] },
      ],
      advice: 'アドバイス',
    })

    const result = parseGeneratedPlan(json)
    expect(result.exercises).toHaveLength(1)
    expect(result.exercises[0].name).toBe('ベンチプレス')
    expect(result.exercises[0].sets[0].weight).toBe(60)
    expect(result.exercises[0].sets[0].reps).toBe(10)
    expect(result.advice).toBe('アドバイス')
  })

  it('```json ... ``` 形式をパースする', () => {
    const text = `
\`\`\`json
{
  "exercises": [
    { "name": "スクワット", "sets": [{ "weight": 80, "reps": 8 }] }
  ]
}
\`\`\`
    `

    const result = parseGeneratedPlan(text)
    expect(result.exercises[0].name).toBe('スクワット')
    expect(result.exercises[0].sets[0].weight).toBe(80)
  })

  it('```（jsonなし）形式をパースする', () => {
    const text = `
\`\`\`
{
  "exercises": [
    { "name": "デッドリフト", "sets": [{ "weight": 100, "reps": 5 }] }
  ]
}
\`\`\`
    `

    const result = parseGeneratedPlan(text)
    expect(result.exercises[0].name).toBe('デッドリフト')
  })

  it('前後にテキストがあるJSONを抽出する', () => {
    const text = `
はい、以下がおすすめのプランです。

{
  "exercises": [
    { "name": "ベンチプレス", "sets": [{ "weight": 60, "reps": 10 }] }
  ],
  "advice": "頑張ってください！"
}

このプランで今日も頑張りましょう！
    `

    const result = parseGeneratedPlan(text)
    expect(result.exercises[0].name).toBe('ベンチプレス')
    expect(result.advice).toBe('頑張ってください！')
  })

  it('adviceがない場合はundefinedになる', () => {
    const json = JSON.stringify({
      exercises: [{ name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] }],
    })

    const result = parseGeneratedPlan(json)
    expect(result.advice).toBeUndefined()
  })

  it('不正なJSONでエラーをスローする', () => {
    expect(() => parseGeneratedPlan('invalid json')).toThrow('JSONのパースに失敗しました')
  })

  it('exercises配列がない場合エラーをスローする', () => {
    const json = JSON.stringify({ advice: 'アドバイスのみ' })
    expect(() => parseGeneratedPlan(json)).toThrow('exercises配列が見つかりません')
  })

  it('欠損フィールドをデフォルト値で補完する', () => {
    const json = JSON.stringify({
      exercises: [
        { name: 'ベンチプレス', sets: [{}] },
        { sets: [{ weight: 50, reps: 10 }] },
      ],
    })

    const result = parseGeneratedPlan(json)
    expect(result.exercises[0].sets[0].weight).toBe(0)
    expect(result.exercises[0].sets[0].reps).toBe(0)
    expect(result.exercises[1].name).toBe('')
  })

  it('文字列の数値を数値に変換する', () => {
    const text = `{
      "exercises": [
        { "name": "ベンチプレス", "sets": [{ "weight": "60", "reps": "10" }] }
      ]
    }`

    const result = parseGeneratedPlan(text)
    expect(result.exercises[0].sets[0].weight).toBe(60)
    expect(result.exercises[0].sets[0].reps).toBe(10)
  })
})

describe('buildPrompt', () => {
  const baseExerciseMasters: ExerciseMaster[] = [
    { id: 1, name: 'ベンチプレス', createdAt: Date.now() },
  ]

  it('基本的なプロンプトを構築する', () => {
    const result = buildPrompt(null, baseExerciseMasters, [], '')

    expect(result).toContain('パーソナルトレーナー')
    expect(result).toContain('利用可能な器具')
    expect(result).toContain('ベンチプレス')
    expect(result).toContain('トレーニング履歴はまだありません')
  })

  it('プロフィールが含まれる', () => {
    const result = buildPrompt('30代男性、筋肥大目的', baseExerciseMasters, [], '')

    expect(result).toContain('ユーザープロフィール')
    expect(result).toContain('30代男性、筋肥大目的')
  })

  it('プロフィールがnullの場合、セクションが含まれない', () => {
    const result = buildPrompt(null, baseExerciseMasters, [], '')

    expect(result).not.toContain('ユーザープロフィール')
  })

  it('トレーニング履歴が含まれる', () => {
    const logs: WorkoutLog[] = [
      {
        id: 1,
        date: '2024-01-15',
        exercises: [
          { id: 'ex1', name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    const result = buildPrompt(null, baseExerciseMasters, logs, '')

    expect(result).toContain('最近のトレーニング履歴')
    expect(result).toContain('2024-01-15')
    expect(result).toContain('60kg×10回')
  })

  it('ユーザーメモが含まれる', () => {
    const result = buildPrompt(null, baseExerciseMasters, [], '今日は胸を中心にやりたい')

    expect(result).toContain('今日の状態・リクエスト')
    expect(result).toContain('今日は胸を中心にやりたい')
  })

  it('空のメモの場合、セクションが含まれない', () => {
    const result = buildPrompt(null, baseExerciseMasters, [], '')

    expect(result).not.toContain('今日の状態・リクエスト')
  })

  it('空白のみのメモの場合、セクションが含まれない', () => {
    const result = buildPrompt(null, baseExerciseMasters, [], '   ')

    expect(result).not.toContain('今日の状態・リクエスト')
  })

  it('前回の評価が含まれる', () => {
    const logs: WorkoutLog[] = [
      {
        id: 1,
        date: '2024-01-15',
        exercises: [
          { id: 'ex1', name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] },
        ],
        evaluation: 'よく頑張りました！次回は重量アップを目指しましょう。',
        evaluationGeneratedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    const result = buildPrompt(null, baseExerciseMasters, logs, '')

    expect(result).toContain('前回のトレーニング評価')
    expect(result).toContain('よく頑張りました！')
  })

  it('評価がない場合、評価セクションが含まれない', () => {
    const logs: WorkoutLog[] = [
      {
        id: 1,
        date: '2024-01-15',
        exercises: [
          { id: 'ex1', name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    const result = buildPrompt(null, baseExerciseMasters, logs, '')

    // 評価セクションヘッダー「■ 前回のトレーニング評価」が含まれないことを確認
    expect(result).not.toContain('■ 前回のトレーニング評価')
  })

  it('JSON形式の指示が含まれる', () => {
    const result = buildPrompt(null, baseExerciseMasters, [], '')

    expect(result).toContain('"exercises"')
    expect(result).toContain('"name"')
    expect(result).toContain('"sets"')
    expect(result).toContain('"weight"')
    expect(result).toContain('"reps"')
  })
})
