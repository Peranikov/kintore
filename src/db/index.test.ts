import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './index'
import type { WorkoutLog, ExerciseMaster, AppSettings } from '../types'

describe('Database', () => {
  beforeEach(async () => {
    // 各テスト前にDBをクリア
    await db.workoutLogs.clear()
    await db.exerciseMasters.clear()
    await db.appSettings.clear()
  })

  describe('WorkoutLog CRUD', () => {
    const createTestLog = (overrides: Partial<WorkoutLog> = {}): Omit<WorkoutLog, 'id'> => ({
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
      ...overrides,
    })

    it('ログを追加できる', async () => {
      const log = createTestLog()
      const id = await db.workoutLogs.add(log)

      expect(id).toBeDefined()
      expect(typeof id).toBe('number')
    })

    it('追加したログを取得できる', async () => {
      const log = createTestLog()
      const id = await db.workoutLogs.add(log)
      const retrieved = await db.workoutLogs.get(id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.date).toBe('2024-01-15')
      expect(retrieved?.exercises).toHaveLength(1)
      expect(retrieved?.exercises[0].name).toBe('ベンチプレス')
    })

    it('日付でログを検索できる', async () => {
      await db.workoutLogs.add(createTestLog({ date: '2024-01-15' }))
      await db.workoutLogs.add(createTestLog({ date: '2024-01-16' }))
      await db.workoutLogs.add(createTestLog({ date: '2024-01-15' }))

      const logs = await db.workoutLogs.where('date').equals('2024-01-15').toArray()

      expect(logs).toHaveLength(2)
    })

    it('ログを更新できる', async () => {
      const log = createTestLog()
      const id = await db.workoutLogs.add(log)

      await db.workoutLogs.update(id, {
        memo: '調子が良かった',
        updatedAt: Date.now(),
      })

      const updated = await db.workoutLogs.get(id)
      expect(updated?.memo).toBe('調子が良かった')
    })

    it('ログを削除できる', async () => {
      const id = await db.workoutLogs.add(createTestLog())
      await db.workoutLogs.delete(id)

      const deleted = await db.workoutLogs.get(id)
      expect(deleted).toBeUndefined()
    })

    it('全ログを取得できる', async () => {
      await db.workoutLogs.add(createTestLog({ date: '2024-01-15' }))
      await db.workoutLogs.add(createTestLog({ date: '2024-01-16' }))
      await db.workoutLogs.add(createTestLog({ date: '2024-01-17' }))

      const allLogs = await db.workoutLogs.toArray()
      expect(allLogs).toHaveLength(3)
    })

    it('日付の降順でソートできる', async () => {
      await db.workoutLogs.add(createTestLog({ date: '2024-01-15' }))
      await db.workoutLogs.add(createTestLog({ date: '2024-01-17' }))
      await db.workoutLogs.add(createTestLog({ date: '2024-01-16' }))

      const sorted = await db.workoutLogs.orderBy('date').reverse().toArray()

      expect(sorted[0].date).toBe('2024-01-17')
      expect(sorted[1].date).toBe('2024-01-16')
      expect(sorted[2].date).toBe('2024-01-15')
    })

    it('複数の種目を持つログを保存できる', async () => {
      const log = createTestLog({
        exercises: [
          { id: 'ex1', name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] },
          { id: 'ex2', name: 'スクワット', sets: [{ weight: 80, reps: 8 }] },
          { id: 'ex3', name: 'デッドリフト', sets: [{ weight: 100, reps: 5 }] },
        ],
      })
      const id = await db.workoutLogs.add(log)
      const retrieved = await db.workoutLogs.get(id)

      expect(retrieved?.exercises).toHaveLength(3)
      expect(retrieved?.exercises.map(e => e.name)).toEqual([
        'ベンチプレス',
        'スクワット',
        'デッドリフト',
      ])
    })

    it('AI評価を保存できる', async () => {
      const log = createTestLog({
        evaluation: '良いトレーニングでした。重量が前回より増えています。',
        evaluationGeneratedAt: Date.now(),
      })
      const id = await db.workoutLogs.add(log)
      const retrieved = await db.workoutLogs.get(id)

      expect(retrieved?.evaluation).toContain('良いトレーニング')
      expect(retrieved?.evaluationGeneratedAt).toBeDefined()
    })

    it('メモを保存できる', async () => {
      const log = createTestLog({ memo: '体調良好。次回は重量アップ。' })
      const id = await db.workoutLogs.add(log)
      const retrieved = await db.workoutLogs.get(id)

      expect(retrieved?.memo).toBe('体調良好。次回は重量アップ。')
    })
  })

  describe('ExerciseMaster CRUD', () => {
    const createTestMaster = (overrides: Partial<ExerciseMaster> = {}): Omit<ExerciseMaster, 'id'> => ({
      name: 'テスト種目',
      createdAt: Date.now(),
      ...overrides,
    })

    it('種目を追加できる', async () => {
      const master = createTestMaster({ name: 'ベンチプレス' })
      const id = await db.exerciseMasters.add(master)

      expect(id).toBeDefined()
    })

    it('追加した種目を取得できる', async () => {
      const id = await db.exerciseMasters.add(createTestMaster({ name: 'スクワット' }))
      const retrieved = await db.exerciseMasters.get(id)

      expect(retrieved?.name).toBe('スクワット')
    })

    it('種目名で検索できる', async () => {
      await db.exerciseMasters.add(createTestMaster({ name: 'ベンチプレス' }))
      await db.exerciseMasters.add(createTestMaster({ name: 'スクワット' }))

      const found = await db.exerciseMasters.where('name').equals('ベンチプレス').first()

      expect(found?.name).toBe('ベンチプレス')
    })

    it('種目を更新できる', async () => {
      const id = await db.exerciseMasters.add(createTestMaster({ name: 'チンニング' }))

      await db.exerciseMasters.update(id, { isBodyweight: true })

      const updated = await db.exerciseMasters.get(id)
      expect(updated?.isBodyweight).toBe(true)
    })

    it('種目を削除できる', async () => {
      const id = await db.exerciseMasters.add(createTestMaster())
      await db.exerciseMasters.delete(id)

      const deleted = await db.exerciseMasters.get(id)
      expect(deleted).toBeUndefined()
    })

    it('全種目を取得できる', async () => {
      await db.exerciseMasters.add(createTestMaster({ name: '種目1' }))
      await db.exerciseMasters.add(createTestMaster({ name: '種目2' }))
      await db.exerciseMasters.add(createTestMaster({ name: '種目3' }))

      const all = await db.exerciseMasters.toArray()
      expect(all).toHaveLength(3)
    })

    it('名前順でソートできる', async () => {
      await db.exerciseMasters.add(createTestMaster({ name: 'チェストプレス' }))
      await db.exerciseMasters.add(createTestMaster({ name: 'アブドミナル' }))
      await db.exerciseMasters.add(createTestMaster({ name: 'ベンチプレス' }))

      const sorted = await db.exerciseMasters.orderBy('name').toArray()

      expect(sorted[0].name).toBe('アブドミナル')
      expect(sorted[1].name).toBe('チェストプレス')
      expect(sorted[2].name).toBe('ベンチプレス')
    })

    it('自重トレーニングフラグを設定できる', async () => {
      const id = await db.exerciseMasters.add(createTestMaster({
        name: 'チンニング',
        isBodyweight: true,
      }))
      const retrieved = await db.exerciseMasters.get(id)

      expect(retrieved?.isBodyweight).toBe(true)
    })

    it('一括追加できる', async () => {
      const masters = [
        createTestMaster({ name: '種目A' }),
        createTestMaster({ name: '種目B' }),
        createTestMaster({ name: '種目C' }),
      ]
      await db.exerciseMasters.bulkAdd(masters)

      const count = await db.exerciseMasters.count()
      expect(count).toBe(3)
    })
  })

  describe('AppSettings CRUD', () => {
    const createTestSetting = (key: string, value: string): Omit<AppSettings, 'id'> => ({
      key,
      value,
    })

    it('設定を追加できる', async () => {
      const setting = createTestSetting('apiKey', 'test-api-key')
      const id = await db.appSettings.add(setting)

      expect(id).toBeDefined()
    })

    it('設定を取得できる', async () => {
      await db.appSettings.add(createTestSetting('apiKey', 'my-secret-key'))

      const setting = await db.appSettings.where('key').equals('apiKey').first()

      expect(setting?.value).toBe('my-secret-key')
    })

    it('設定を更新できる', async () => {
      const id = await db.appSettings.add(createTestSetting('apiKey', 'old-key'))

      await db.appSettings.update(id, { value: 'new-key' })

      const updated = await db.appSettings.get(id)
      expect(updated?.value).toBe('new-key')
    })

    it('設定を削除できる', async () => {
      const id = await db.appSettings.add(createTestSetting('apiKey', 'test'))
      await db.appSettings.delete(id)

      const deleted = await db.appSettings.get(id)
      expect(deleted).toBeUndefined()
    })

    it('keyはユニーク制約がある', async () => {
      await db.appSettings.add(createTestSetting('uniqueKey', 'value1'))

      await expect(
        db.appSettings.add(createTestSetting('uniqueKey', 'value2'))
      ).rejects.toThrow()
    })

    it('複数の設定を保存できる', async () => {
      await db.appSettings.add(createTestSetting('apiKey', 'key-value'))
      await db.appSettings.add(createTestSetting('userName', 'テストユーザー'))
      await db.appSettings.add(createTestSetting('theme', 'dark'))

      const all = await db.appSettings.toArray()
      expect(all).toHaveLength(3)
    })

    it('put操作で既存の設定を上書きできる', async () => {
      await db.appSettings.add(createTestSetting('setting1', 'initial'))

      // 既存のレコードを取得してputで更新
      const existing = await db.appSettings.where('key').equals('setting1').first()
      if (existing) {
        await db.appSettings.put({ ...existing, value: 'updated' })
      }

      const updated = await db.appSettings.where('key').equals('setting1').first()
      expect(updated?.value).toBe('updated')
    })
  })

  describe('複合操作', () => {
    it('ログと種目の関連付けが正しく動作する', async () => {
      // 種目マスタを追加
      await db.exerciseMasters.add({
        name: 'ベンチプレス',
        createdAt: Date.now(),
      })
      await db.exerciseMasters.add({
        name: 'スクワット',
        createdAt: Date.now(),
      })

      // ログを追加
      const logId = await db.workoutLogs.add({
        date: '2024-01-15',
        exercises: [
          { id: 'ex1', name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] },
          { id: 'ex2', name: 'スクワット', sets: [{ weight: 80, reps: 8 }] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      // ログを取得して種目を確認
      const log = await db.workoutLogs.get(logId)
      const exerciseNames = log?.exercises.map(e => e.name) || []

      // 種目マスタに存在するか確認
      for (const name of exerciseNames) {
        const master = await db.exerciseMasters.where('name').equals(name).first()
        expect(master).toBeDefined()
      }
    })

    it('日付範囲でログをフィルタリングできる', async () => {
      await db.workoutLogs.add({
        date: '2024-01-10',
        exercises: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      await db.workoutLogs.add({
        date: '2024-01-15',
        exercises: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      await db.workoutLogs.add({
        date: '2024-01-20',
        exercises: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      const filtered = await db.workoutLogs
        .where('date')
        .between('2024-01-12', '2024-01-18')
        .toArray()

      expect(filtered).toHaveLength(1)
      expect(filtered[0].date).toBe('2024-01-15')
    })

    it('特定の種目を含むログを検索できる', async () => {
      await db.workoutLogs.add({
        date: '2024-01-15',
        exercises: [
          { id: 'ex1', name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      await db.workoutLogs.add({
        date: '2024-01-16',
        exercises: [
          { id: 'ex1', name: 'スクワット', sets: [{ weight: 80, reps: 8 }] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      await db.workoutLogs.add({
        date: '2024-01-17',
        exercises: [
          { id: 'ex1', name: 'ベンチプレス', sets: [{ weight: 65, reps: 10 }] },
          { id: 'ex2', name: 'デッドリフト', sets: [{ weight: 100, reps: 5 }] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      const allLogs = await db.workoutLogs.toArray()
      const benchPressLogs = allLogs.filter(log =>
        log.exercises.some(ex => ex.name === 'ベンチプレス')
      )

      expect(benchPressLogs).toHaveLength(2)
    })

    it('種目ごとの最大重量を集計できる', async () => {
      await db.workoutLogs.add({
        date: '2024-01-15',
        exercises: [
          { id: 'ex1', name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      await db.workoutLogs.add({
        date: '2024-01-17',
        exercises: [
          { id: 'ex1', name: 'ベンチプレス', sets: [{ weight: 70, reps: 8 }] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      await db.workoutLogs.add({
        date: '2024-01-19',
        exercises: [
          { id: 'ex1', name: 'ベンチプレス', sets: [{ weight: 65, reps: 10 }] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      const allLogs = await db.workoutLogs.toArray()
      const benchPressSets = allLogs
        .flatMap(log => log.exercises)
        .filter(ex => ex.name === 'ベンチプレス')
        .flatMap(ex => ex.sets)

      const maxWeight = Math.max(...benchPressSets.map(s => s.weight))
      expect(maxWeight).toBe(70)
    })
  })
})
