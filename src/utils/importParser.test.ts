// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { parseExportMarkdown } from './importParser'

describe('parseExportMarkdown', () => {
  it('ウェイトトレーニングをパースできる', () => {
    const text = `# トレーニング記録 2024-01-01 〜 2024-01-01

## 2024-01-01

### ベンチプレス
- 1セット目: 60kg × 10回
- 2セット目: 65kg × 8回
- 3セット目: 70kg × 6回`

    const result = parseExportMarkdown(text)
    expect(result.logs).toHaveLength(1)
    expect(result.logs[0].date).toBe('2024-01-01')
    expect(result.logs[0].exercises).toHaveLength(1)
    expect(result.logs[0].exercises[0].name).toBe('ベンチプレス')
    expect(result.logs[0].exercises[0].sets).toEqual([
      { weight: 60, reps: 10 },
      { weight: 65, reps: 8 },
      { weight: 70, reps: 6 },
    ])

    const ex = result.exercises.find((e) => e.name === 'ベンチプレス')
    expect(ex?.isBodyweight).toBe(false)
    expect(ex?.isCardio).toBe(false)
  })

  it('自重トレーニングをパースできる', () => {
    const text = `# トレーニング記録 2024-01-01 〜 2024-01-01

## 2024-01-01

### チンニング（懸垂）
- 1セット目: 10回
- 2セット目: 8回`

    const result = parseExportMarkdown(text)
    expect(result.logs[0].exercises[0].sets).toEqual([
      { weight: 0, reps: 10 },
      { weight: 0, reps: 8 },
    ])

    const ex = result.exercises.find((e) => e.name === 'チンニング（懸垂）')
    expect(ex?.isBodyweight).toBe(true)
    expect(ex?.isCardio).toBe(false)
  })

  it('有酸素運動（距離あり）をパースできる', () => {
    const text = `# トレーニング記録 2024-01-01 〜 2024-01-01

## 2024-01-01

### ランニング
- 30分 / 5.0km`

    const result = parseExportMarkdown(text)
    expect(result.logs[0].exercises[0].sets).toEqual([
      { weight: 0, reps: 0, duration: 30, distance: 5.0 },
    ])

    const ex = result.exercises.find((e) => e.name === 'ランニング')
    expect(ex?.isCardio).toBe(true)
  })

  it('有酸素運動（距離なし）をパースできる', () => {
    const text = `# トレーニング記録 2024-01-01 〜 2024-01-01

## 2024-01-01

### バイク
- 45分`

    const result = parseExportMarkdown(text)
    expect(result.logs[0].exercises[0].sets).toEqual([
      { weight: 0, reps: 0, duration: 45 },
    ])
  })

  it('メモ付きログをパースできる', () => {
    const text = `# トレーニング記録 2024-01-01 〜 2024-01-01

## 2024-01-01

### ベンチプレス
- 1セット目: 60kg × 10回

#### メモ
調子が良かった
フォームに注意`

    const result = parseExportMarkdown(text)
    expect(result.logs[0].memo).toBe('調子が良かった\nフォームに注意')
  })

  it('複数日分をパースできる', () => {
    const text = `# トレーニング記録 2024-01-01 〜 2024-01-03

## 2024-01-03

### ベンチプレス
- 1セット目: 60kg × 10回

---

## 2024-01-01

### スクワット
- 1セット目: 80kg × 8回`

    const result = parseExportMarkdown(text)
    expect(result.logs).toHaveLength(2)
    expect(result.logs[0].date).toBe('2024-01-03')
    expect(result.logs[1].date).toBe('2024-01-01')
  })

  it('複数種目をパースできる', () => {
    const text = `# トレーニング記録 2024-01-01 〜 2024-01-01

## 2024-01-01

### ベンチプレス
- 1セット目: 60kg × 10回

### ラットプルダウン
- 1セット目: 50kg × 12回`

    const result = parseExportMarkdown(text)
    expect(result.logs[0].exercises).toHaveLength(2)
    expect(result.logs[0].exercises[0].name).toBe('ベンチプレス')
    expect(result.logs[0].exercises[1].name).toBe('ラットプルダウン')
  })

  it('空のテキストは空の結果を返す', () => {
    const result = parseExportMarkdown('')
    expect(result.logs).toHaveLength(0)
    expect(result.exercises).toHaveLength(0)
  })

  it('小数の重量をパースできる', () => {
    const text = `# トレーニング記録 2024-01-01 〜 2024-01-01

## 2024-01-01

### ダンベルカール
- 1セット目: 12.5kg × 10回`

    const result = parseExportMarkdown(text)
    expect(result.logs[0].exercises[0].sets[0].weight).toBe(12.5)
  })

  it('exercisesに重複がない', () => {
    const text = `# トレーニング記録 2024-01-01 〜 2024-01-02

## 2024-01-02

### ベンチプレス
- 1セット目: 60kg × 10回

---

## 2024-01-01

### ベンチプレス
- 1セット目: 55kg × 10回`

    const result = parseExportMarkdown(text)
    expect(result.exercises.filter((e) => e.name === 'ベンチプレス')).toHaveLength(1)
  })
})
