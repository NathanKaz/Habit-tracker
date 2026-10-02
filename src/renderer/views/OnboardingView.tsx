import { useState, type ReactNode } from 'react'
import { useApp } from '../state/app'

export function OnboardingView(): ReactNode {
  const { setup } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(): Promise<void> {
    if (password !== repeat) {
      setError('Пароли не совпадают')
      return
    }
    setBusy(true)
    setError('')
    try {
      await setup(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать учётную запись')
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
          <div className="auth-title">Добро пожаловать</div>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Придумайте логин и пароль. На этом компьютере вход не потребуется, а с телефона или другого
            компьютера по локальной сети понадобится ввести их.
          </p>
        </div>

        <div className="field">
          <label htmlFor="ob-user">Логин</label>
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
          <label htmlFor="ob-pass">Пароль</label>
          <input
            id="ob-pass"
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="hint">Минимум 8 символов, хотя бы одна буква и одна цифра.</span>
        </div>

        <div className="field">
          <label htmlFor="ob-repeat">Пароль ещё раз</label>
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
          {busy ? 'Создаём…' : 'Начать'}
        </button>
      </form>
    </div>
  )
}