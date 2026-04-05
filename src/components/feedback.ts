import { createContext, useContext } from 'react'

type ToastTone = 'info' | 'success' | 'error'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

export interface FeedbackContextValue {
  showToast: (message: string, tone?: ToastTone) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

export const FeedbackContext = createContext<FeedbackContextValue | null>(null)

export function useFeedback() {
  const context = useContext(FeedbackContext)
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider')
  }
  return context
}
