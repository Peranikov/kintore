/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseForm } from './ExerciseForm'
import { db } from '../db'

// Mock alert
const mockAlert = vi.fn()
vi.stubGlobal('alert', mockAlert)

// Helper to get all spinbutton inputs grouped by set
// Returns array of arrays: [[weight1, reps1], [weight2, reps2], ...] or [[reps1], [reps2], ...] for bodyweight
function getAllSetInputs() {
  const allInputs = screen.getAllByRole('spinbutton')
  const setLabels = screen.getAllByText(/^\d+\.$/)
  const numSets = setLabels.length

  // Determine inputs per set by checking if weight input exists (kg label present)
  const hasWeight = screen.queryAllByText('kg').length > 0
  const inputsPerSet = hasWeight ? 2 : 1

  const result: HTMLInputElement[][] = []
  for (let i = 0; i < numSets; i++) {
    const start = i * inputsPerSet
    result.push(allInputs.slice(start, start + inputsPerSet) as HTMLInputElement[])
  }
  return result
}

// Helper to get weight and reps inputs for a specific set index
function getSetInputs(setIndex: number) {
  return getAllSetInputs()[setIndex]
}

describe('ExerciseForm', () => {
  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    // Clear database before each test
    await db.exerciseMasters.clear()
    await db.workoutLogs.clear()
  })

  afterEach(async () => {
    await db.exerciseMasters.clear()
    await db.workoutLogs.clear()
  })

  describe('バリデーション', () => {
    it('種目名が空の場合、アラートを表示する', async () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const submitButton = screen.getByRole('button', { name: '追加' })
      fireEvent.click(submitButton)

      expect(mockAlert).toHaveBeenCalledWith('種目名を入力してください')
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('回数が0以下の場合、アラートを表示する', async () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const nameInput = screen.getByPlaceholderText('種目名を入力...')
      await userEvent.type(nameInput, 'ベンチプレス')

      const submitButton = screen.getByRole('button', { name: '追加' })
      fireEvent.click(submitButton)

      expect(mockAlert).toHaveBeenCalledWith('重量と回数を正しく入力してください')
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('正しい入力でonSubmitが呼ばれる', async () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const nameInput = screen.getByPlaceholderText('種目名を入力...')
      await userEvent.type(nameInput, 'ベンチプレス')

      const inputs = getSetInputs(0)
      await userEvent.clear(inputs[0]) // weight
      await userEvent.type(inputs[0], '60')
      await userEvent.clear(inputs[1]) // reps
      await userEvent.type(inputs[1], '10')

      const submitButton = screen.getByRole('button', { name: '追加' })
      fireEvent.click(submitButton)

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ベンチプレス',
          sets: [{ weight: 60, reps: 10 }],
        })
      )
    })

    it('自重トレーニングで回数が0以下の場合、アラートを表示する', async () => {
      // Add bodyweight exercise to master
      await db.exerciseMasters.add({
        name: 'チンニング',
        isBodyweight: true,
        createdAt: Date.now(),
      })

      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const nameInput = screen.getByPlaceholderText('種目名を入力...')
      await userEvent.type(nameInput, 'チンニング')

      // Wait for isBodyweight to be calculated
      await waitFor(() => {
        // Weight input should not be visible for bodyweight exercise
        const spinbuttons = screen.getAllByRole('spinbutton')
        expect(spinbuttons).toHaveLength(1) // Only reps input
      })

      const submitButton = screen.getByRole('button', { name: '追加' })
      fireEvent.click(submitButton)

      expect(mockAlert).toHaveBeenCalledWith('回数を正しく入力してください')
    })
  })

  describe('セット管理', () => {
    it('初期状態で1セット表示される', () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      expect(screen.getByText('1.')).toBeInTheDocument()
    })

    it('セット追加ボタンでセットが追加される', async () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const addButton = screen.getByText('+ セットを追加')
      fireEvent.click(addButton)

      expect(screen.getByText('2.')).toBeInTheDocument()
    })

    it('追加されたセットは前のセットの値を引き継ぐ', async () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Set values for first set
      const inputs = getSetInputs(0)
      await userEvent.clear(inputs[0])
      await userEvent.type(inputs[0], '60')
      await userEvent.clear(inputs[1])
      await userEvent.type(inputs[1], '10')

      // Add new set
      const addButton = screen.getByText('+ セットを追加')
      fireEvent.click(addButton)

      // Check new set has same values
      await waitFor(() => {
        const secondSetInputs = getSetInputs(1)
        expect(secondSetInputs[0]).toHaveValue(60)
        expect(secondSetInputs[1]).toHaveValue(10)
      })
    })

    it('セット削除ボタンでセットが削除される', async () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Add a second set first
      const addButton = screen.getByText('+ セットを追加')
      fireEvent.click(addButton)

      expect(screen.getByText('2.')).toBeInTheDocument()

      // Delete the second set
      const deleteButtons = screen.getAllByTitle('削除')
      fireEvent.click(deleteButtons[1])

      expect(screen.queryByText('2.')).not.toBeInTheDocument()
    })

    it('最後の1セットは削除できない', () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // 削除ボタンは1セットのみの時は表示されない
      expect(screen.queryByTitle('削除')).not.toBeInTheDocument()
    })

    it('クリアボタンでセットの値がリセットされる', async () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Set values
      const inputs = getSetInputs(0)
      await userEvent.clear(inputs[0])
      await userEvent.type(inputs[0], '60')
      await userEvent.clear(inputs[1])
      await userEvent.type(inputs[1], '10')

      // Click clear button
      const clearButton = screen.getByTitle('クリア')
      fireEvent.click(clearButton)

      // Values should be reset
      await waitFor(() => {
        const clearedInputs = getSetInputs(0)
        expect(clearedInputs[0]).toHaveValue(null)
        expect(clearedInputs[1]).toHaveValue(null)
      })
    })
  })

  describe('キーボード操作', () => {
    it('種目名入力後のEnterで重量欄にフォーカス', async () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const nameInput = screen.getByPlaceholderText('種目名を入力...')
      await userEvent.type(nameInput, 'ベンチプレス')
      fireEvent.keyDown(nameInput, { key: 'Enter' })

      const inputs = getSetInputs(0)
      expect(document.activeElement).toBe(inputs[0]) // weight input
    })

    it('重量入力後のEnterで回数欄にフォーカス', async () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const inputs = getSetInputs(0)
      await userEvent.type(inputs[0], '60')
      fireEvent.keyDown(inputs[0], { key: 'Enter' })

      expect(document.activeElement).toBe(inputs[1]) // reps input
    })

    it('回数入力後のEnterで次のセットがなければ新規追加', async () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const inputs = getSetInputs(0)
      await userEvent.type(inputs[1], '10')
      fireEvent.keyDown(inputs[1], { key: 'Enter' })

      // New set should be added
      await waitFor(() => {
        expect(screen.getByText('2.')).toBeInTheDocument()
      })
    })

    it('回数入力後のEnterで次のセットがあればそこにフォーカス', async () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Add second set first
      const addButton = screen.getByText('+ セットを追加')
      fireEvent.click(addButton)

      await waitFor(() => {
        expect(screen.getByText('2.')).toBeInTheDocument()
      })

      const firstSetInputs = getSetInputs(0)
      const secondSetInputs = getSetInputs(1)

      // Press Enter on first set's reps
      fireEvent.keyDown(firstSetInputs[1], { key: 'Enter' })

      // Should focus on second set's weight
      expect(document.activeElement).toBe(secondSetInputs[0])
    })
  })

  describe('自重トレーニング', () => {
    beforeEach(async () => {
      await db.exerciseMasters.add({
        name: 'チンニング',
        isBodyweight: true,
        createdAt: Date.now(),
      })
    })

    it('自重トレーニングは重量入力が表示されない', async () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const nameInput = screen.getByPlaceholderText('種目名を入力...')
      await userEvent.type(nameInput, 'チンニング')

      await waitFor(() => {
        const spinbuttons = screen.getAllByRole('spinbutton')
        expect(spinbuttons).toHaveLength(1) // Only reps input
      })

      expect(screen.queryByText('kg')).not.toBeInTheDocument()
    })

    it('自重トレーニングで種目名EnterはReps欄にフォーカス', async () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const nameInput = screen.getByPlaceholderText('種目名を入力...')
      await userEvent.type(nameInput, 'チンニング')

      await waitFor(() => {
        const spinbuttons = screen.getAllByRole('spinbutton')
        expect(spinbuttons).toHaveLength(1)
      })

      fireEvent.keyDown(nameInput, { key: 'Enter' })

      const repsInput = screen.getByRole('spinbutton')
      expect(document.activeElement).toBe(repsInput)
    })
  })

  describe('前回記録', () => {
    beforeEach(async () => {
      await db.exerciseMasters.add({
        name: 'ベンチプレス',
        createdAt: Date.now(),
      })
      await db.workoutLogs.add({
        date: '2024-01-15',
        exercises: [
          {
            id: 'ex1',
            name: 'ベンチプレス',
            sets: [
              { weight: 60, reps: 10 },
              { weight: 65, reps: 8 },
            ],
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })

    it('種目名入力で前回記録が表示される', async () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const nameInput = screen.getByPlaceholderText('種目名を入力...')
      await userEvent.type(nameInput, 'ベンチプレス')

      await waitFor(
        () => {
          expect(screen.getByText(/前回の記録/)).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
      expect(screen.getByText(/2024-01-15/)).toBeInTheDocument()
    })

    it('コピーボタンで前回記録がコピーされる', async () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const nameInput = screen.getByPlaceholderText('種目名を入力...')
      await userEvent.type(nameInput, 'ベンチプレス')

      await waitFor(
        () => {
          expect(screen.getByText('コピー')).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      const copyButton = screen.getByText('コピー')
      fireEvent.click(copyButton)

      // Check that sets were copied (2 sets)
      await waitFor(() => {
        expect(screen.getByText('2.')).toBeInTheDocument()
      })

      const firstSetInputs = getSetInputs(0)
      const secondSetInputs = getSetInputs(1)
      expect(firstSetInputs[0]).toHaveValue(60)
      expect(secondSetInputs[0]).toHaveValue(65)
    })

    it('編集モードでは前回記録が表示されない', async () => {
      const initialExercise = {
        id: 'edit-id',
        name: 'ベンチプレス',
        sets: [{ weight: 70, reps: 8 }],
      }

      render(
        <ExerciseForm
          initialExercise={initialExercise}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Wait a bit for potential fetch
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(screen.queryByText(/前回の記録/)).not.toBeInTheDocument()
    })
  })

  describe('編集モード', () => {
    it('初期値が正しく表示される', () => {
      const initialExercise = {
        id: 'test-id',
        name: 'スクワット',
        sets: [
          { weight: 80, reps: 8 },
          { weight: 85, reps: 6 },
        ],
      }

      render(
        <ExerciseForm
          initialExercise={initialExercise}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const nameInput = screen.getByPlaceholderText('種目名を入力...')
      expect(nameInput).toHaveValue('スクワット')

      expect(screen.getByText('1.')).toBeInTheDocument()
      expect(screen.getByText('2.')).toBeInTheDocument()

      const firstSetInputs = getSetInputs(0)
      const secondSetInputs = getSetInputs(1)
      expect(firstSetInputs[0]).toHaveValue(80)
      expect(secondSetInputs[0]).toHaveValue(85)
    })

    it('ボタンテキストが「更新」になる', () => {
      const initialExercise = {
        id: 'test-id',
        name: 'スクワット',
        sets: [{ weight: 80, reps: 8 }],
      }

      render(
        <ExerciseForm
          initialExercise={initialExercise}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByRole('button', { name: '更新' })).toBeInTheDocument()
    })

    it('更新時にIDが維持される', async () => {
      const initialExercise = {
        id: 'original-id',
        name: 'スクワット',
        sets: [{ weight: 80, reps: 8 }],
      }

      render(
        <ExerciseForm
          initialExercise={initialExercise}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const submitButton = screen.getByRole('button', { name: '更新' })
      fireEvent.click(submitButton)

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'original-id',
        })
      )
    })
  })

  describe('キャンセル', () => {
    it('キャンセルボタンでonCancelが呼ばれる', () => {
      render(
        <ExerciseForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const cancelButton = screen.getByRole('button', { name: 'キャンセル' })
      fireEvent.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalled()
    })
  })
})
