/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { db } from '../db'
import { LogDetailPage } from './LogDetailPage'

function Navigator({ firstId, secondId }: { firstId: number; secondId: number }) {
  const navigate = useNavigate()

  return (
    <div>
      <button onClick={() => navigate(`/log/${firstId}`)}>log1</button>
      <button onClick={() => navigate(`/log/${secondId}`)}>log2</button>
    </div>
  )
}

async function seedLogs() {
  await db.exerciseMasters.add({
    name: 'ベンチプレス',
    createdAt: 1,
  })

  await db.appSettings.add({
    key: 'geminiApiKey',
    value: 'test-key',
  })

  const firstId = await db.workoutLogs.add({
    date: '2026-04-01',
    exercises: [
      { id: 'ex-1', name: 'ベンチプレス', sets: [{ weight: 60, reps: 10 }] },
    ],
    memo: '1件目のメモ',
    evaluation: '1件目のAI評価',
    evaluationGeneratedAt: 1000,
    createdAt: 1000,
    updatedAt: 1000,
  })

  const secondId = await db.workoutLogs.add({
    date: '2026-04-02',
    exercises: [
      { id: 'ex-2', name: 'ベンチプレス', sets: [{ weight: 65, reps: 8 }] },
    ],
    memo: '2件目のメモ',
    evaluation: '2件目のAI評価',
    evaluationGeneratedAt: 2000,
    createdAt: 2000,
    updatedAt: 2000,
  })

  return {
    firstId: Number(firstId),
    secondId: Number(secondId),
  }
}

function renderPage(initialEntry: string, logIds: { firstId: number; secondId: number }) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Navigator firstId={logIds.firstId} secondId={logIds.secondId} />
      <Routes>
        <Route path="/log/:id" element={<LogDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('LogDetailPage', () => {
  let logIds: Awaited<ReturnType<typeof seedLogs>>

  beforeEach(async () => {
    await db.workoutLogs.clear()
    await db.exerciseMasters.clear()
    await db.appSettings.clear()
    logIds = await seedLogs()
  })

  it('保存済みのメモとAI評価を表示する', async () => {
    renderPage(`/log/${logIds.firstId}`, logIds)

    await screen.findByText('1件目のメモ')
    expect(await screen.findByText('1件目のAI評価')).toBeInTheDocument()
  })

  it('別ログへ遷移するとメモとAI評価が切り替わる', async () => {
    const user = userEvent.setup()
    renderPage(`/log/${logIds.firstId}`, logIds)

    await screen.findByText('1件目のメモ')
    await user.click(screen.getByRole('button', { name: 'log2' }))

    await screen.findByText('2件目のメモ')
    await waitFor(() => {
      expect(screen.queryByText('1件目のメモ')).not.toBeInTheDocument()
    })
    expect(screen.getByText('2件目のAI評価')).toBeInTheDocument()
  })
})
