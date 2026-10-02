import { useEffect, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { useApp } from '../state/app'
import { api, downloadExport, setStoredToken } from '../api/client'

interface QrProps {
  value: string
}

function Qr({ value }: QrProps): ReactNode {
  const [svg, setSvg] = useState('')

  useEffect(() => {
    let cancelled = false
    void QRCode.toString(value, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f1115', light: '#ffffff' },
    })
      .then((result) => {
        if (!cancelled) setSvg(result)
      })
      .catch(() => {
        if (!cancelled) setSvg('')
      })
    return () => {
      cancelled = true
    }
  }, [value])

  if (!svg) return null
  return (
    <div
      className="qr"
      // SVG генерируется библиотекой из строки адреса, внешних данных там нет.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function Switch({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}): ReactNode {
  return (
    <div className="switch-row">
      <div className="switch-text">
        <span>{label}</span>
        {hint ? <span className="hint">{hint}</span> : null}
      </div>
      <button
        type="button"
        className="switch"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      />
    </div>
  )
}

export function SettingsView(): ReactNode {
  const { state, updateSettings, updateHabit, logout, importData, notify, isDesktop } = useApp()
  const [portInput, setPortInput] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [busy, setBusy] = useState(false)

  if (!state) return null
  const settings = state.settings
  const server = state.server
  const archived = state.habits.filter((h) => h.archived)

  const primaryUrl = server.lanUrls[0]

  async function applyPort(): Promise<void> {
    const port = Number(portInput)
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      notify('Порт должен быть от 1024 до 65535')
      return
    }
    if (port === settings.serverPort) return
    setBusy(true)
    await updateSettings({ serverPort: port })
    setBusy(false)
    setPortInput('')
    notify(`Порт изменён на ${port}`, 'info')
  }

  async function changeCredentials(): Promise<void> {
    if (newUsername.trim().length < 2) {
      notify('Имя не короче 2 символов')
      return
    }
    if (currentPassword.length < 8) {
      notify('Новый пароль не короче 8 символов')
      return
    }
    setBusy(true)
    try {
      await api.changeUsername(newUsername.trim())
      const result = await api.changePassword(currentPassword)
      // Смена пароля обрывает прежние сессии и выдаёт новый токен этому клиенту.
      if (result.token) setStoredToken(result.token)
      notify('Логин и пароль обновлены', 'info')
      setNewUsername('')
      setCurrentPassword('')
    } finally {
      setBusy(false)
    }
  }

  async function onPickFile(file: File): Promise<void> {
    setBusy(true)
    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)
      if (typeof parsed !== 'object' || parsed === null) throw new Error('bad')
      await importData(parsed)
    } catch {
      notify('Не удалось прочитать файл')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="view">
      <div className="view-inner">
        <h1>Настройки</h1>

        <section className="card section">
          <div className="section-title">Серии</div>
          <Switch
            label="Сбрасывать серию при пропуске"
            hint={
              settings.streakResetEnabled
                ? 'Пропущенный запланированный день обнуляет серию. Незапланированные дни не влияют.'
                : 'Серия только копится и никогда не уменьшается: считается суммарное число выполненных дней.'
            }
            checked={settings.streakResetEnabled}
            onChange={(value) => void updateSettings({ streakResetEnabled: value })}
          />
        </section>

        <section className="card section">
          <div className="section-title">Приложение</div>
          <Switch
            label="Сворачивать в трей при закрытии окна"
            hint="Окно закрывается, приложение продолжает работать — интерфейс останется доступен с телефона."
            checked={settings.trayEnabled}
            onChange={(value) => void updateSettings({ trayEnabled: value })}
          />
          <Switch
            label="Запускать при входе в систему"
            hint="Приложение стартует свёрнутым в трей."
            checked={settings.launchAtLogin}
            onChange={(value) => void updateSettings({ launchAtLogin: value })}
          />

          <div className="field" style={{ marginTop: 6 }}>
            <label>Оформление</label>
            <div className="segmented">
              {(['system', 'light', 'dark'] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  aria-pressed={settings.theme === theme}
                  onClick={() => void updateSettings({ theme })}
                >
                  {theme === 'system' ? 'Как в системе' : theme === 'light' ? 'Светлое' : 'Тёмное'}
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginTop: 6 }}>
            <label>Первый день недели</label>
            <div className="segmented">
              <button
                type="button"
                aria-pressed={settings.weekStartsOn === 1}
                onClick={() => void updateSettings({ weekStartsOn: 1 })}
              >
                Понедельник
              </button>
              <button
                type="button"
                aria-pressed={settings.weekStartsOn === 0}
                onClick={() => void updateSettings({ weekStartsOn: 0 })}
              >
                Воскресенье
              </button>
            </div>
          </div>
        </section>

        <section className="card section">
          <div className="section-title">Доступ с других устройств</div>
          <Switch
            label="Разрешить вход из локальной сети"
            hint="Когда выключено, интерфейс открывается только на этом компьютере."
            checked={settings.remoteAccessEnabled}
            onChange={(value) => void updateSettings({ remoteAccessEnabled: value })}
          />

          <div className="field">
            <label htmlFor="port">Порт</label>
            <div className="row">
              <input
                id="port"
                className="input"
                style={{ maxWidth: 140 }}
                inputMode="numeric"
                placeholder={String(settings.serverPort)}
                value={portInput}
                onChange={(event) => setPortInput(event.target.value)}
              />
              <button type="button" className="btn" onClick={() => void applyPort()} disabled={busy}>
                Применить
              </button>
            </div>
            <span className="hint">После смены порта окно перезагрузится.</span>
          </div>

          {settings.remoteAccessEnabled ? (
            server.lanUrls.length > 0 ? (
              <div className="field">
                <label>Откройте адрес в браузере телефона или планшета</label>
                <div className="address-list">
                  {server.lanUrls.map((url) => (
                    <div key={url} className="address">
                      <span className="grow">{url.replace(/^https?:\/\//, '')}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => {
                          void navigator.clipboard?.writeText(url)
                          notify('Адрес скопирован', 'info')
                        }}
                        aria-label="Скопировать адрес"
                      >
                        ⧉
                      </button>
                    </div>
                  ))}
                </div>
                <span className="hint">
                  Потребуется вход: логин {state.username} и пароль, который вы задали при первом запуске.
                </span>
                {primaryUrl ? <Qr value={primaryUrl} /> : null}
              </div>
            ) : (
              <div className="hint">
                Компьютер не подключён к домашней сети — подключите его к тому же Wi-Fi, что и телефон.
              </div>
            )
          ) : (
            <div className="hint">Сейчас интерфейс доступен только на этом компьютере.</div>
          )}
        </section>

        <section className="card section">
          <div className="section-title">Вход с других устройств</div>
          <div className="field">
            <label htmlFor="new-username">Логин</label>
            <input
              id="new-username"
              className="input"
              defaultValue={state.username}
              onChange={(event) => setNewUsername(event.target.value)}
              placeholder={state.username}
            />
          </div>
          <div className="field">
            <label htmlFor="new-password">Новый пароль</label>
            <input
              id="new-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <span className="hint">
              Не короче 8 символов, хотя бы одна буква и одна цифра. После смены другие устройства попросят войти заново.
            </span>
          </div>
          <div>
            <button type="button" className="btn btn-primary" onClick={() => void changeCredentials()} disabled={busy}>
              Обновить
            </button>
          </div>
        </section>

        {archived.length > 0 ? (
          <section className="card section">
            <div className="section-title">В архиве</div>
            <div className="archive-list">
              {archived.map((habit) => (
                <div key={habit.id} className="archive-row">
                  <span aria-hidden="true">{habit.icon}</span>
                  <span className="grow">{habit.name}</span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void updateHabit(habit.id, { archived: false })}
                  >
                    Вернуть
                  </button>
                </div>
              ))}
            </div>
            <span className="hint">История выполнения сохраняется, но в календаре и списке привычка не показывается.</span>
          </section>
        ) : null}

        <section className="card section">
          <div className="section-title">Данные</div>
          <div className="row wrap">
            <button
              type="button"
              className="btn"
              onClick={() => {
                void downloadExport().catch(() => notify('Не удалось выгрузить копию'))
              }}
            >
              Выгрузить копию
            </button>
            <label className="btn" style={{ cursor: 'pointer' }}>
              Загрузить копию
              <input
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void onPickFile(file)
                  event.target.value = ''
                }}
              />
            </label>
          </div>
          <span className="hint">
            Загрузка заменяет текущие привычки и всю историю. Сделайте выгрузку перед заменой.
          </span>
        </section>

        {!isDesktop ? (
          <section className="card section">
            <div className="section-title">Сеанс</div>
            <div>
              <button type="button" className="btn btn-danger" onClick={() => void logout()}>
                Выйти
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}