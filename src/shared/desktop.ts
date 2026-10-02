/** Мост, который preload прокидывает в окно приложения на этом компьютере. */
export interface HabitDesktopBridge {
  /** Всегда действующий токен окна; пароль для входа с других устройств не нужен. */
  getToken: () => Promise<string>
  platform: string
}