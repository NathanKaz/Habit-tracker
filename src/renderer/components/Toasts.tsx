import type { ReactNode } from 'react'
import { useApp } from '../state/app'
import { useI18n } from '../i18n'

export function Toasts(): ReactNode {
  const { toasts, dismissToast } = useApp()
  const { t } = useI18n()
  if (toasts.length === 0) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone}`}>
          <span className="grow">{toast.text}</span>
          {toast.action ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                toast.action?.run()
                dismissToast(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => dismissToast(toast.id)}
            aria-label={t('common.dismiss')}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
