import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { FeedbackContext, type ConfirmOptions, type FeedbackContextValue } from './feedback'

type ToastTone = 'info' | 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ConfirmState extends ConfirmOptions {
  resolve: (confirmed: boolean) => void
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const nextToastId = useRef(1)

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextToastId.current++
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      dismissToast(id)
    }, 3000)
  }, [dismissToast])

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        ...options,
        resolve,
      })
    })
  }, [])

  const contextValue = useMemo<FeedbackContextValue>(() => ({
    showToast,
    confirm,
  }), [showToast, confirm])

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto w-full max-w-md rounded-xl px-4 py-3 text-sm shadow-lg ${
              toast.tone === 'success'
                ? 'bg-emerald-600 text-white'
                : toast.tone === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-gray-900 text-white'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center sm:pb-0">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-confirm-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h2 id="feedback-confirm-title" className="text-base font-semibold text-gray-900">
              {confirmState.title}
            </h2>
            {confirmState.message && (
              <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
                {confirmState.message}
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  confirmState.resolve(false)
                  setConfirmState(null)
                }}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {confirmState.cancelLabel || 'キャンセル'}
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmState.resolve(true)
                  setConfirmState(null)
                }}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white ${
                  confirmState.tone === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmState.confirmLabel || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  )
}
