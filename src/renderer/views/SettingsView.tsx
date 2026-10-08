import { useEffect, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { useApp } from '../state/app'
import { useI18n } from '../i18n'
import { formatDate } from '../../i18n'
import { api, downloadExport, setStoredToken, type SessionInfo } from '../api/client'
import { Modal } from '../components/Modal'

function deviceName(userAgent: string): string {
  const ua = userAgent.trim()
  if (!ua) return ''
  const browser = /Firefox\//.test(ua)
    ? 'Firefox'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /OPR\//.test(ua)
        ? 'Opera'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : ''
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : ''
  return [browser, os].filter(Boolean).join(' · ')
}

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

interface ImportPreview {
  payload: unknown
  habits: number
  marks: number
}

export function SettingsView(): ReactNode {
  const { state, updateSettings, updateHabit, logout, importData, notify, isDesktop } = useApp()
  const { t, lang } = useI18n()
  const [portInput, setPortInput] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [notifState, setNotifState] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  // По HTTP с адреса LAN браузер запрещает уведомления: причина не в настройках.
  const insecure = typeof window !== 'undefined' && !window.isSecureContext
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [pendingImport, setPendingImport] = useState<ImportPreview | null>(null)
  const [restoreSettings, setRestoreSettings] = useState(true)

  useEffect(() => {
    let cancelled = false
    void api
      .listSessions()
      .then((result) => {
        if (!cancelled) setSessions(result.sessions)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  if (!state) return null
  const settings = state.settings
  const server = state.server
  const archived = state.habits.filter((h) => h.archived)

  const primaryUrl = server.lanUrls[0]

  async function applyPort(): Promise<void> {
    const port = Number(portInput)
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      notify(t('settings.toast.portRange'))
      return
    }
    if (port === settings.serverPort) return
    setBusy(true)
    await updateSettings({ serverPort: port })
    setBusy(false)
    setPortInput('')
    notify(t('settings.toast.portChanged', { port }), 'info')
  }

  async function changeCredentials(): Promise<void> {
    if (newUsername.trim().length < 2) {
      notify(t('settings.toast.usernameShort'))
      return
    }
    if (currentPassword.length < 8) {
      notify(t('settings.toast.passwordShort'))
      return
    }
    setBusy(true)
    try {
      await api.changeUsername(newUsername.trim())
      const result = await api.changePassword(currentPassword)
      // Смена пароля обрывает прежние сессии и выдаёт новый токен этому клиенту.
      if (result.token) setStoredToken(result.token)
      notify(t('settings.toast.credentialsUpdated'), 'info')
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
      const raw = parsed as { habits?: unknown; entries?: unknown }
      if (!Array.isArray(raw.habits)) throw new Error('bad')
      const ids = new Set(
        raw.habits.flatMap((item) =>
          typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string'
            ? [(item as { id: string }).id]
            : [],
        ),
      )
      const entries =
        typeof raw.entries === 'object' && raw.entries !== null ? (raw.entries as Record<string, unknown>) : {}
      let marks = 0
      for (const [habitId, days] of Object.entries(entries)) {
        if (ids.has(habitId) && typeof days === 'object' && days !== null) {
          marks += Object.keys(days as Record<string, unknown>).length
        }
      }
      setPendingImport({ payload: parsed, habits: raw.habits.length, marks })
    } catch {
      notify(t('settings.toast.fileError'))
    } finally {
      setBusy(false)
    }
  }

  async function confirmImport(): Promise<void> {
    if (!pendingImport) return
    setBusy(true)
    try {
      await importData(pendingImport.payload, restoreSettings)
      setPendingImport(null)
    } finally {
      setBusy(false)
    }
  }

  async function askNotifications(): Promise<void> {
    if (typeof Notification === 'undefined') return
    setNotifState(await Notification.requestPermission())
  }

  async function revokeSession(id: string): Promise<void> {
    try {
      await api.endSession(id)
      setSessions((current) => current.filter((item) => item.id !== id))
      notify(t('settings.toast.deviceEnded'), 'info')
    } catch (err) {
      notify(err instanceof Error ? err.message : t('error.generic'))
    }
  }

  function shortDate(iso: string): string {
    return /^\d{4}-\d{2}-\d{2}/.test(iso) ? formatDate(lang, iso.slice(0, 10), false) : '—'
  }

  return (
    <div className="view">
      <div className="view-inner">
        <h1>{t('settings.title')}</h1>

        <section className="card section">
          <div className="section-title">{t('settings.language')}</div>
          <div className="segmented">
            <button
              type="button"
              aria-pressed={settings.language === 'system'}
              onClick={() => void updateSettings({ language: 'system' })}
            >
              {t('settings.langSystem')}
            </button>
            <button
              type="button"
              aria-pressed={settings.language === 'en'}
              onClick={() => void updateSettings({ language: 'en' })}
            >
              {t('settings.langEn')}
            </button>
            <button
              type="button"
              aria-pressed={settings.language === 'ru'}
              onClick={() => void updateSettings({ language: 'ru' })}
            >
              {t('settings.langRu')}
            </button>
          </div>
        </section>

        <section className="card section">
          <div className="section-title">{t('settings.app')}</div>
          <Switch
            label={t('settings.tray')}
            hint={t('settings.trayHint')}
            checked={settings.trayEnabled}
            onChange={(value) => void updateSettings({ trayEnabled: value })}
          />
          <Switch
            label={t('settings.launch')}
            hint={t('settings.launchHint')}
            checked={settings.launchAtLogin}
            onChange={(value) => void updateSettings({ launchAtLogin: value })}
          />
          <Switch
            label={t('settings.remindersEnable')}
            hint={t('settings.remindersHint')}
            checked={settings.remindersEnabled}
            onChange={(value) => void updateSettings({ remindersEnabled: value })}
          />

          <div className="switch-row">
            <div className="switch-text">
              <span>{t('settings.notifications')}</span>
              <span className="hint">
                {insecure && notifState !== 'granted'
                  ? t('settings.notificationsInsecure')
                  : notifState === 'unsupported'
                    ? t('settings.notificationsUnsupported')
                    : notifState === 'granted'
                      ? t('settings.notificationsOn')
                      : notifState === 'denied'
                        ? t('settings.notificationsDenied')
                        : t('settings.notificationsHint')}
              </span>
            </div>
            {notifState === 'default' && !insecure ? (
              <button type="button" className="btn" onClick={() => void askNotifications()}>
                {t('settings.notificationsEnable')}
              </button>
            ) : null}
          </div>

          <Switch
            label={t('settings.autoBackup')}
            hint={t('settings.autoBackupHint')}
            checked={settings.autoBackupEnabled}
            onChange={(value) => void updateSettings({ autoBackupEnabled: value })}
          />

          <div className="field" style={{ marginTop: 6 }}>
            <label>{t('settings.appearance')}</label>
            <div className="segmented">
              {(['system', 'light', 'dark'] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  aria-pressed={settings.theme === theme}
                  onClick={() => void updateSettings({ theme })}
                >
                  {theme === 'system'
                    ? t('settings.themeSystem')
                    : theme === 'light'
                      ? t('settings.themeLight')
                      : t('settings.themeDark')}
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginTop: 6 }}>
            <label>{t('settings.weekStart')}</label>
            <div className="segmented">
              <button
                type="button"
                aria-pressed={settings.weekStartsOn === 1}
                onClick={() => void updateSettings({ weekStartsOn: 1 })}
              >
                {t('settings.monday')}
              </button>
              <button
                type="button"
                aria-pressed={settings.weekStartsOn === 0}
                onClick={() => void updateSettings({ weekStartsOn: 0 })}
              >
                {t('settings.sunday')}
              </button>
            </div>
          </div>
        </section>

        <section className="card section">
          <div className="section-title">{t('settings.remote')}</div>
          <Switch
            label={t('settings.remoteEnable')}
            hint={t('settings.remoteHint')}
            checked={settings.remoteAccessEnabled}
            onChange={(value) => void updateSettings({ remoteAccessEnabled: value })}
          />

          <div className="field">
            <label htmlFor="port">{t('settings.port')}</label>
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
                {t('settings.apply')}
              </button>
            </div>
            <span className="hint">{t('settings.portHint')}</span>
          </div>

          {settings.remoteAccessEnabled ? (
            server.lanUrls.length > 0 ? (
              <div className="field">
                <label>{t('settings.openAddress')}</label>
                <div className="address-list">
                  {server.lanUrls.map((url) => (
                    <div key={url} className="address">
                      <span className="grow">{url.replace(/^https?:\/\//, '')}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => {
                          void navigator.clipboard?.writeText(url)
                          notify(t('settings.addressCopied'), 'info')
                        }}
                        aria-label={t('settings.copyAddress')}
                      >
                        ⧉
                      </button>
                    </div>
                  ))}
                </div>
                <span className="hint">{t('settings.loginHint', { username: state.username })}</span>
                {primaryUrl ? <Qr value={primaryUrl} /> : null}
              </div>
            ) : (
              <div className="hint">{t('settings.notConnected')}</div>
            )
          ) : (
            <div className="hint">{t('settings.localOnly')}</div>
          )}
        </section>

        <section className="card section">
          <div className="section-title">{t('settings.credentials')}</div>
          <div className="field">
            <label htmlFor="new-username">{t('settings.username')}</label>
            <input
              id="new-username"
              className="input"
              defaultValue={state.username}
              onChange={(event) => setNewUsername(event.target.value)}
              placeholder={state.username}
            />
          </div>
          <div className="field">
            <label htmlFor="new-password">{t('settings.newPassword')}</label>
            <input
              id="new-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <span className="hint">{t('settings.passwordHint')}</span>
          </div>
          <div>
            <button type="button" className="btn btn-primary" onClick={() => void changeCredentials()} disabled={busy}>
              {t('settings.update')}
            </button>
          </div>
        </section>

        <section className="card section">
          <div className="section-title">{t('settings.devices')}</div>
          {sessions.length === 0 ? (
            <div className="hint">{t('settings.devicesEmpty')}</div>
          ) : (
            <div className="archive-list">
              {sessions.map((session) => (
                <div key={session.id} className="archive-row">
                  <span className="grow">
                    <span>{deviceName(session.userAgent) || t('settings.deviceUnknown')}</span>
                    <span className="hint">{t('settings.deviceLastUsed', { date: shortDate(session.lastUsedAt) })}</span>
                  </span>
                  {session.current ? (
                    <span className="hint">{t('settings.thisDevice')}</span>
                  ) : (
                    <button type="button" className="btn btn-ghost" onClick={() => void revokeSession(session.id)}>
                      {t('settings.deviceRevoke')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <span className="hint">{t('settings.devicesHint')}</span>
        </section>

        {archived.length > 0 ? (
          <section className="card section">
            <div className="section-title">{t('settings.archive')}</div>
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
                    {t('settings.restore')}
                  </button>
                </div>
              ))}
            </div>
            <span className="hint">{t('settings.archiveHint')}</span>
          </section>
        ) : null}

        <section className="card section">
          <div className="section-title">{t('settings.data')}</div>
          <div className="row wrap">
            <button
              type="button"
              className="btn"
              onClick={() => {
                void downloadExport().catch(() => notify(t('settings.toast.exportError')))
              }}
            >
              {t('settings.export')}
            </button>
            <label className="btn" style={{ cursor: 'pointer' }}>
              {t('settings.import')}
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
          <span className="hint">{t('settings.importHint')}</span>
        </section>

        {!isDesktop ? (
          <section className="card section">
            <div className="section-title">{t('settings.session')}</div>
            <div>
              <button type="button" className="btn btn-danger" onClick={() => void logout()}>
                {t('settings.logout')}
              </button>
            </div>
          </section>
        ) : null}
      </div>

      {pendingImport ? (
        <Modal
          title={t('settings.importPreviewTitle')}
          onClose={() => setPendingImport(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPendingImport(null)}
                disabled={busy}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void confirmImport()}
                disabled={busy}
              >
                {busy ? t('common.saving') : t('settings.importConfirm')}
              </button>
            </>
          }
        >
          <p>{t('settings.importPreview', { habits: pendingImport.habits, marks: pendingImport.marks })}</p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={restoreSettings}
              onChange={(event) => setRestoreSettings(event.target.checked)}
            />
            <span>{t('settings.importRestoreSettings')}</span>
          </label>
        </Modal>
      ) : null}
    </div>
  )
}
