import { describe, expect, it } from 'vitest'
import { formatLocalDate } from './date'

describe('formatLocalDate', () => {
  it('Dateをローカル日付のYYYY-MM-DDで返す', () => {
    expect(formatLocalDate(new Date(2026, 3, 5, 0, 30))).toBe('2026-04-05')
    expect(formatLocalDate(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02')
  })
})
