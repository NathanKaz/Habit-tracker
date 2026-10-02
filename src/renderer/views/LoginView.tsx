import { useState, type ReactNode } from 'react'
import { useApp } from '../state/app'

export function LoginView(): ReactNode {
  const { login } = useApp()
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
      setError(err instanceof Error ? err.message : 'Не удалось войти')
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
          <div className="auth-title">Вход</div>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Введите логин и пароль, заданные на этом компьютере.
          </p>
        </div>

        <div className="field">
          <label htmlFor="login-user">Логин</label>
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
          <label htmlFor="login-pass">Пароль</label>
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
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}

export function OfflineView(): ReactNode {
  const { offlineMessage, retry } = useApp()
  return (
    <div className="centered">
      <div className="auth-card">
        <div className="auth-mark" aria-hidden="true" />
        <div>
          <div className="auth-title">Нет связи с компьютером</div>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Приложение хранит данные только на своём компьютере. Убедитесь, что он включён, а в настройках
            разрешён доступ из локальной сети, и что телефон подключён к той же сети.
          </p>
        </div>
        {offlineMessage ? <div className="error-text">{offlineMessage}</div> : null}
        <button type="button" className="btn btn-primary" onClick={retry}>
          Повторить
        </button>
      </div>
    </div>
  )
}