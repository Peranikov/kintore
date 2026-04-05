/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PlanCreatePage } from './PlanCreatePage'

const mockNavigate = vi.fn()
const mockGeneratePlan = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}))

vi.mock('../services/gemini', () => ({
  generatePlan: (...args: unknown[]) => mockGeneratePlan(...args),
  getApiKey: vi.fn(),
}))

import { useLiveQuery } from 'dexie-react-hooks'

describe('PlanCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()

    let callIndex = 0
    vi.mocked(useLiveQuery).mockImplementation(() => {
      const values = [undefined, [], true] as const
      const value = values[callIndex % values.length]
      callIndex += 1
      return value
    })

    mockGeneratePlan.mockResolvedValue({
      exercises: [
        {
          name: 'ベンチプレス',
          sets: [{ weight: 60, reps: 10 }],
        },
      ],
      advice: '今日のトレーニングプランです。',
    })
  })

  function renderPage() {
    render(
      <MemoryRouter>
        <PlanCreatePage />
      </MemoryRouter>
    )
  }

  it('AIプランモードではEnterで送信せず改行する', async () => {
    renderPage()

    await waitFor(() => {
      expect(mockGeneratePlan).toHaveBeenCalledWith('')
    })

    const textarea = await screen.findByRole('textbox')
    fireEvent.change(textarea, { target: { value: '1行目' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    fireEvent.change(textarea, { target: { value: '1行目\n2行目' } })

    expect(textarea).toHaveValue('1行目\n2行目')
    expect(mockGeneratePlan).toHaveBeenCalledTimes(1)
  })

  it('送信ボタンでは修正指示を送信できる', async () => {
    renderPage()

    await screen.findByText('今日のトレーニングプランです。')

    const textarea = await screen.findByRole('textbox')
    const sendButton = textarea.parentElement?.querySelector('button')
    expect(sendButton).not.toBeNull()

    fireEvent.change(textarea, { target: { value: '負荷を少し下げて' } })

    await waitFor(() => {
      expect(sendButton).toBeEnabled()
    })

    fireEvent.click(sendButton as HTMLButtonElement)

    await waitFor(() => {
      expect(mockGeneratePlan).toHaveBeenNthCalledWith(2, '負荷を少し下げて')
    })
  })
})
