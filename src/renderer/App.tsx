import { useState, type ReactNode } from 'react'
import { useApp } from './state/app'
import { Toasts } from './components/Toasts'
import { TodayView } from './views/TodayView'
import { CalendarView } from './views/CalendarView'
import { SettingsView } from './views/SettingsView'
import { OnboardingView } from './views/OnboardingView'
import { LoginView, OfflineView } from './views/LoginView'

type Tab = 'today' | 'calendar' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Сегодня' },
  { id: 'calendar', label: 'Календарь' },
  { id: 'settings', label: 'Настройки' },
]

export function App(): ReactNode {
  const { phase, state, connected } = useApp()
  const [tab, setTab] = useState<Tab>('today')

  if (phase === 'loading') {
    return (
      <div className="loading">
        <div className="spinner" aria-hidden="true" />
        <span>Загрузка…</span>
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
          <span>Трекер привычек</span>
          {state?.username ? <span className="brand-user">{state.username}</span> : null}
        </div>

        <span className="conn" title={connected ? 'Соединение с приложением активно' : 'Соединение потеряно'}>
          <span className={`conn-dot ${connected ? 'on' : 'off'}`} aria-hidden="true" />
          {connected ? 'на связи' : 'нет связи'}
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
              {item.label}
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