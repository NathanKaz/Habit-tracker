import { useEffect, useState, type ReactNode } from 'react'
import { useApp } from './state/app'
import { useI18n } from './i18n'
import type { TranslationKey } from '../i18n'
import { Toasts } from './components/Toasts'
import { TodayView } from './views/TodayView'
import { CalendarView } from './views/CalendarView'
import { SettingsView } from './views/SettingsView'
import { OnboardingView } from './views/OnboardingView'
import { LoginView, OfflineView } from './views/LoginView'

type Tab = 'today' | 'calendar' | 'settings'

const TABS: { id: Tab; key: TranslationKey }[] = [
  { id: 'today', key: 'nav.today' },
  { id: 'calendar', key: 'nav.calendar' },
  { id: 'settings', key: 'nav.settings' },
]

export function App(): ReactNode {
  const { phase, state, connected } = useApp()
  const { t, lang } = useI18n()
  const [tab, setTab] = useState<Tab>('today')

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t('app.name')
  }, [lang, t])

  if (phase === 'loading') {
    return (
      <div className="loading">
        <div className="spinner" aria-hidden="true" />
        <span>{t('common.loading')}</span>
      </div>
    )
  }

  if (phase === 'onboarding') {
    return (
      <>
        <OnboardingView />
        <Toasts />
      </>
    )
  }

  if (phase === 'offline') {
    return (
      <>
        <OfflineView />
        <Toasts />
      </>
    )
  }

  if (phase === 'login') {
    return (
      <>
        <LoginView />
        <Toasts />
      </>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>{t('app.name')}</span>
          {state?.username ? <span className="brand-user">{state.username}</span> : null}
        </div>

        <span className="conn" title={connected ? t('conn.active') : t('conn.lost')}>
          <span className={`conn-dot ${connected ? 'on' : 'off'}`} aria-hidden="true" />
          {connected ? t('conn.online') : t('conn.offline')}
        </span>

        <nav className="tabs" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              {t(item.key)}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'today' ? <TodayView /> : null}
      {tab === 'calendar' ? <CalendarView /> : null}
      {tab === 'settings' ? <SettingsView /> : null}

      <Toasts />
    </div>
  )
}