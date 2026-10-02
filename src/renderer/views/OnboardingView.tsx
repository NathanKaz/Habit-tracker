import { useState, type ReactNode } from 'react'
import { useApp } from '../state/app'
import { useI18n } from '../i18n'

export function OnboardingView(): ReactNode {
  const { setup } = useApp()
  const { t } = useI18n()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(): Promise<void> {
    if (password !== repeat) {
      setError(t('auth.onboard.mismatch'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await setup(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.onboard.error'))
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
          <div className="auth-title">{t('auth.onboard.title')}</div>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {t('auth.onboard.body')}
          </p>
        </div>

        <div className="field">
          <label htmlFor="ob-user">{t('auth.login.username')}</label>
          <input
            id="ob-user"
            className="input"
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="ob-pass">{t('auth.onboard.password')}</label>
          <input
            id="ob-pass"
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="hint">{t('auth.onboard.hint')}</span>
        </div>

        <div className="field">
          <label htmlFor="ob-repeat">{t('auth.onboard.repeat')}</label>
          <input
            id="ob-repeat"
            className="input"
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
          />
        </div>

        {error ? <div className="error-text">{error}</div> : null}

        <button type="submit" className="btn btn-primary" disabled={busy || username.length < 2 || password.length < 8}>
          {busy ? t('auth.onboard.busy') : t('auth.onboard.submit')}
        </button>
      </form>
    </div>
  )
}
