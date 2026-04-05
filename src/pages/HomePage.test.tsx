/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../db'
import { HomePage } from './HomePage'

function makeDateDaysAgo(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString().split('T')[0]
}

async function seedDeloadLogs() {
  await db.exerciseMasters.add({
    name: 'ベンチプレス',
    createdAt: 1,
  })

  const now = Date.now()
  const logs = Array.from({ length: 16 }, (_, index) => ({
    date: makeDateDaysAgo(index),
    exercises: [
      {
        id: `ex-${index}`,
        name: 'ベンチプレス',
        sets: [{ weight: 80, reps: 10 }],
      },
    ],
    createdAt: now - index,
    updatedAt: now - index,
  }))

  await db.workoutLogs.bulkAdd(logs)
}

describe('HomePage', () => {
  beforeEach(async () => {
    await db.workoutLogs.clear()
    await db.exerciseMasters.clear()
    await db.appSettings.clear()
    ;(globalThis as unknown as { __COMMIT_HASH__?: string }).__COMMIT_HASH__ = 'test'
  })

  it('can dismiss deload suggestion until the next log is created', async () => {
    const user = userEvent.setup()
    await seedDeloadLogs()

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await screen.findByText('ディロード週の検討を')
    await user.click(screen.getByRole('button', { name: '今回は見送る' }))

    await waitFor(() => {
      expect(screen.queryByText('ディロード週の検討を')).not.toBeInTheDocument()
    })
  })

  it('shows deload suggestion again after a new log is created', async () => {
    const user = userEvent.setup()
    await seedDeloadLogs()

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )

    await screen.findByText('ディロード週の検討を')
    await user.click(screen.getByRole('button', { name: '今回は見送る' }))

    await waitFor(() => {
      expect(screen.queryByText('ディロード週の検討を')).not.toBeInTheDocument()
    })

    const newCreatedAt = Date.now() + 1000
    await db.workoutLogs.add({
      date: makeDateDaysAgo(0),
      exercises: [
        {
          id: 'new-ex',
          name: 'ベンチプレス',
          sets: [{ weight: 75, reps: 10 }],
        },
      ],
      createdAt: newCreatedAt,
      updatedAt: newCreatedAt,
    })

    await screen.findByText('ディロード週の検討を')
  })
})
