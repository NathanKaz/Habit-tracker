import { useState, type ReactNode } from 'react'
import { useApp } from '../state/app'
import { useI18n } from '../i18n'

export function LoginView(): ReactNode {
  const { login } = useApp()
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(): Promise<void> {
    setBusy(true)
    setError('')
    try {
      await login(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.login.error'))
      setBusy(false)
    }
  }

  return (
    <div className="centered">
      <form
        className="auth-card"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="auth-mark" aria-hidden="true" />
        <div>
          <div className="auth-title">{t('auth.login.title')}</div>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {t('auth.login.body')}
          </p>
        </div>

        <div className="field">
          <label htmlFor="login-user">{t('auth.login.username')}</label>
          <input
            id="login-user"
            className="input"
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="login-pass">{t('auth.login.password')}</label>
          <input
            id="login-pass"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error ? <div className="error-text">{error}</div> : null}

        <button type="submit" className="btn btn-primary" disabled={busy || !username || !password}>
          {busy ? t('auth.login.busy') : t('auth.login.submit')}
        </button>
      </form>
    </div>
  )
}

export function OfflineView(): ReactNode {
  const { offlineMessage, retry } = useApp()
  const { t } = useI18n()
  return (
    <div className="centered">
      <div className="auth-card">
        <div className="auth-mark" aria-hidden="true" />
        <div>
          <div className="auth-title">{t('auth.offline.title')}</div>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {t('auth.offline.body')}
          </p>
        </div>
        {offlineMessage ? <div className="error-text">{offlineMessage}</div> : null}
        <button type="button" className="btn btn-primary" onClick={retry}>
          {t('auth.retry')}
        </button>
      </div>
    </div>
  )
}
