import type { DateStr, Habit, Schedule } from '../main/domain/types'
import { parseDate } from '../main/domain/dates'

export type Language = 'en' | 'ru'
export type LanguageSetting = 'en' | 'ru' | 'system'

export function resolveLanguage(setting: LanguageSetting | undefined, systemLang: string | undefined): Language {
  if (setting === 'en' || setting === 'ru') return setting
  return (systemLang ?? '').toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

const en = {
  'app.name': 'Habit Tracker',
  'common.loading': 'Loading…',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.saving': 'Saving…',
  'common.delete': 'Delete',
  'common.close': 'Close',
  'common.dismiss': 'Dismiss',
  'common.decrease': 'Decrease',
  'common.increase': 'Increase',
  'common.today': 'Today',
  'common.edit': 'Edit',

  'nav.today': 'Today',
  'nav.calendar': 'Calendar',
  'nav.settings': 'Settings',

  'conn.active': 'Connected to the app',
  'conn.lost': 'Connection lost',
  'conn.online': 'online',
  'conn.offline': 'offline',

  'today.title': 'Today',
  'today.empty': 'nothing planned today',
  'today.allDone': 'all done',
  'today.done': 'done',
  'today.noHabits.title': 'No habits yet',
  'today.noHabits.body': 'Create your first habit with a daily goal and check it off every day.',
  'today.addHabit': 'Add habit',

  'summary.title': 'Summary',
  'summary.thisMonth': 'This month',
  'summary.allTime': 'All time',
  'summary.ratio': '{done} of {planned} · {percent}%',

  'habit.unitFallback': 'times',
  'habit.editAria': 'Edit "{name}"',
  'habit.weekLine': 'Week {weekDone}/{weekTarget} · month {monthDone}/{monthPlanned} ({percent}%)',
  'habit.weekTitle': 'Week: {done} of {target}',
  'habit.notScheduledToday': 'Not scheduled today',
  'habit.reminderAt': '⏰ {times}',
  'habit.checkAria': 'Check "{name}"',
  'habit.uncheckAria': 'Uncheck "{name}"',

  'streak.broken': 'Streak broken',
  'streak.noWeeks': 'No completed weeks in a row yet',
  'streak.inARow': '{n} {unit} in a row',
  'streak.record': 'Record: {n} {unit}',
  'streak.week': 'week',
  'streak.weekShort': 'wk.',

  'day.today': 'today',
  'day.nothingPlanned': 'Nothing planned',
  'day.completed': 'Completed {done} of {total}',
  'day.canMark': 'You can check any habit — the mark will be saved for this day.',
  'day.notScheduled': 'Not scheduled for this day: {count}',
  'day.checked': 'checked',
  'day.check': 'check',
  'day.markAria': 'Mark "{name}" for {date}',

  'calendar.title': 'Calendar',
  'calendar.prev': 'Previous month',
  'calendar.next': 'Next month',
  'calendar.today': 'Today',
  'calendar.legend':
    "A dot means done, a ring means partial. The bar below shows the day's completion. Click a day to edit its marks, including past ones.",
  'calendar.selected': 'Selected: {date}',
  'calendar.nothingPlanned': 'Nothing planned',
  'calendar.completedLabel': 'Completed {done} of {total}: {names}',

  'editor.titleEdit': 'Habit',
  'editor.titleNew': 'New habit',
  'editor.err.name': 'Enter a habit name',
  'editor.err.start': 'Check the start date',
  'editor.err.endBeforeStart': 'End date is before start date',
  'editor.err.goalMin': 'The goal must be at least 1',
  'editor.err.pickDay': 'Select at least one day',
  'editor.err.timesPerWeek': 'Choose the number of days per week',
  'editor.err.reminderTime': 'Time must be in HH:MM format',
  'editor.err.save': 'Could not save',
  'editor.err.delete': 'Could not delete',
  'editor.confirmDelete': 'Delete along with history?',
  'editor.name': 'Name',
  'editor.namePlaceholder': 'E.g., glasses of water',
  'editor.icon': 'Icon',
  'editor.iconAria': 'Icon',
  'editor.emoji': 'Emoji',
  'editor.color': 'Color',
  'editor.colorAria': 'Color {color}',
  'editor.track': 'How to track',
  'editor.boolean': 'Yes / no',
  'editor.count': 'Counter',
  'editor.dailyGoal': 'Daily goal',
  'editor.unit': 'Unit',
  'editor.unitPlaceholder': 'glasses, min',
  'editor.note': 'Comment',
  'editor.notePlaceholder': 'E.g., 2 glasses in the morning and 6 in the evening',
  'editor.reminders': 'Reminders',
  'editor.remindersHint': 'A notification if the habit is not done by that time. The app has to be running.',
  'editor.reminderAdd': 'Add a time',
  'editor.reminderRemove': 'Remove the time',
  'editor.reminderTimeAria': 'Reminder time',
  'editor.reminderMax': 'At most {max} times',
  'editor.repeat': 'Repeat',
  'editor.everyDay': 'Every day',
  'editor.selectedDays': 'Selected days',
  'editor.timesPerWeek': 'N times a week',
  'editor.weekdays': 'Weekdays',
  'editor.weekdaysHint': 'Unselected days do not reset the streak.',
  'editor.timesLabel': 'Times per week',
  'editor.timesHint':
    'The streak counts in weeks: how many weeks in a row the quota was met. The current week is not over yet.',
  'editor.start': 'Start',
  'editor.endMode': 'End',
  'editor.endNever': 'No end date',
  'editor.endDate': 'Until date',
  'editor.endCount': 'Total repetitions',
  'editor.endCountLabel': 'Number of repetitions',
  'editor.endCountHint': 'Only scheduled days are counted.',
  'editor.resetStreak': 'Reset streak on a miss',
  'editor.resetStreakHintOn': 'A missed scheduled day resets the streak. Unscheduled days do not count.',
  'editor.resetStreakHintOff': 'The streak only grows and never decreases: the total number of completed days.',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.langSystem': 'System',
  'settings.langEn': 'English',
  'settings.langRu': 'Русский',
  'settings.app': 'Application',
  'settings.tray': 'Minimize to tray when closing the window',
  'settings.trayHint': 'The window closes, the app keeps running — the interface stays available from your phone.',
  'settings.reminders': 'Reminders',
  'settings.remindersEnable': 'Remind about habits that are not done',
  'settings.remindersHint':
    'Notifications appear while the app is running. Turn on launch at login and minimize to tray, otherwise they stop with the app.',
  'settings.launch': 'Launch at login',
  'settings.launchHint': 'The app starts minimized to the tray.',
  'settings.appearance': 'Appearance',
  'settings.themeSystem': 'System',
  'settings.themeLight': 'Light',
  'settings.themeDark': 'Dark',
  'settings.weekStart': 'First day of the week',
  'settings.monday': 'Monday',
  'settings.sunday': 'Sunday',
  'settings.remote': 'Access from other devices',
  'settings.remoteEnable': 'Allow access from the local network',
  'settings.remoteHint': 'When off, the interface opens only on this computer.',
  'settings.port': 'Port',
  'settings.apply': 'Apply',
  'settings.portHint': 'The window will reload after the port changes.',
  'settings.openAddress': 'Open the address in your phone or tablet browser',
  'settings.copyAddress': 'Copy address',
  'settings.addressCopied': 'Address copied',
  'settings.loginHint': 'Sign-in required: username {username} and the password you set on first launch.',
  'settings.notConnected':
    'The computer is not connected to a home network — connect it to the same Wi-Fi as your phone.',
  'settings.localOnly': 'Right now the interface is available only on this computer.',
  'settings.credentials': 'Sign in from other devices',
  'settings.username': 'Username',
  'settings.newPassword': 'New password',
  'settings.passwordHint':
    'At least 8 characters, at least one letter and one digit. After the change, other devices will ask you to sign in again.',
  'settings.update': 'Update',
  'settings.archive': 'Archived',
  'settings.restore': 'Restore',
  'settings.archiveHint': 'History is preserved, but the habit is hidden in the calendar and list.',
  'settings.data': 'Data',
  'settings.export': 'Export a copy',
  'settings.import': 'Import a copy',
  'settings.importHint': 'Import replaces current habits and all history. Export before replacing.',
  'settings.session': 'Session',
  'settings.logout': 'Sign out',
  'settings.toast.portRange': 'Port must be between 1024 and 65535',
  'settings.toast.portChanged': 'Port changed to {port}',
  'settings.toast.usernameShort': 'Username must be at least 2 characters',
  'settings.toast.passwordShort': 'New password must be at least 8 characters',
  'settings.toast.credentialsUpdated': 'Username and password updated',
  'settings.toast.fileError': 'Could not read the file',
  'settings.toast.exportError': 'Could not export the copy',

  'auth.login.title': 'Sign in',
  'auth.login.body': 'Enter the username and password set on this computer.',
  'auth.login.username': 'Username',
  'auth.login.password': 'Password',
  'auth.login.submit': 'Sign in',
  'auth.login.busy': 'Signing in…',
  'auth.login.error': 'Could not sign in',
  'auth.offline.title': 'No connection to the computer',
  'auth.offline.body':
    'The app stores data only on your computer. Make sure it is on, local network access is enabled in the settings, and your phone is on the same network.',
  'auth.retry': 'Retry',
  'auth.onboard.title': 'Welcome',
  'auth.onboard.body':
    'Create a username and password. On this computer you will not need to sign in; from a phone or another computer on the local network you will.',
  'auth.onboard.password': 'Password',
  'auth.onboard.repeat': 'Repeat password',
  'auth.onboard.hint': 'At least 8 characters, at least one letter and one digit.',
  'auth.onboard.submit': 'Get started',
  'auth.onboard.busy': 'Creating…',
  'auth.onboard.mismatch': 'Passwords do not match',
  'auth.onboard.error': 'Could not create the account',

  'toast.setupDone': 'Done. You can start adding habits.',
  'toast.imported': 'Data replaced',
  'error.generic': 'Something went wrong',
  'error.requestFailed': 'Request failed ({status})',

  'reminder.body': 'Time to complete "{name}"',
  'reminder.bodyWithNote': 'Time to complete "{name}": {note}',

  'tray.open': 'Open',
  'tray.remoteOn': 'Access from other devices',
  'tray.remoteOff': 'Local access is off',
  'tray.copyUrl': '{url} — copy',
  'tray.urlCopied': 'Address copied: {url}',
  'tray.quit': 'Quit',
  'tray.inNetwork': 'Online: {url}',
  'tray.localOnly': 'This computer only',
  'tray.portBusy': 'Error: port {port} is busy',
} as const

export type TranslationKey = keyof typeof en

const ru: Record<TranslationKey, string> = {
  'app.name': 'Трекер привычек',
  'common.loading': 'Загрузка…',
  'common.cancel': 'Отмена',
  'common.save': 'Сохранить',
  'common.saving': 'Сохранение…',
  'common.delete': 'Удалить',
  'common.close': 'Закрыть',
  'common.dismiss': 'Скрыть',
  'common.decrease': 'Уменьшить',
  'common.increase': 'Увеличить',
  'common.today': 'Сегодня',
  'common.edit': 'Настроить',

  'nav.today': 'Сегодня',
  'nav.calendar': 'Календарь',
  'nav.settings': 'Настройки',

  'conn.active': 'Соединение с приложением активно',
  'conn.lost': 'Соединение потеряно',
  'conn.online': 'на связи',
  'conn.offline': 'нет связи',

  'today.title': 'Сегодня',
  'today.empty': 'на сегодня пусто',
  'today.allDone': 'всё выполнено',
  'today.done': 'выполнено',
  'today.noHabits.title': 'Привычек пока нет',
  'today.noHabits.body': 'Заведите первую привычку с целью на день — и отмечайте выполнение каждый день.',
  'today.addHabit': 'Добавить привычку',

  'summary.title': 'Итоги',
  'summary.thisMonth': 'Этот месяц',
  'summary.allTime': 'Всё время',
  'summary.ratio': '{done} из {planned} · {percent}%',

  'habit.unitFallback': 'раз',
  'habit.editAria': 'Настроить «{name}»',
  'habit.weekLine': 'Неделя {weekDone}/{weekTarget} · месяц {monthDone}/{monthPlanned} ({percent}%)',
  'habit.weekTitle': 'Неделя: {done} из {target}',
  'habit.notScheduledToday': 'Сегодня не запланировано',
  'habit.reminderAt': '⏰ {times}',
  'habit.checkAria': 'Отметить «{name}»',
  'habit.uncheckAria': 'Отменить «{name}»',

  'streak.broken': 'Серия прервана',
  'streak.noWeeks': 'Подряд ещё ни одной закрытой недели',
  'streak.inARow': '{n} {unit} подряд',
  'streak.record': 'Рекорд: {n} {unit}',
  'streak.week': 'неделя',
  'streak.weekShort': 'нед.',

  'day.today': 'сегодня',
  'day.nothingPlanned': 'Ничего не запланировано',
  'day.completed': 'Выполнено {done} из {total}',
  'day.canMark': 'Можно отметить любую привычку — отметка сохранится на этот день.',
  'day.notScheduled': 'Не запланированы на этот день: {count}',
  'day.checked': 'отмечено',
  'day.check': 'отметить',
  'day.markAria': 'Отметить «{name}» за {date}',

  'calendar.title': 'Календарь',
  'calendar.prev': 'Предыдущий месяц',
  'calendar.next': 'Следующий месяц',
  'calendar.today': 'Сегодня',
  'calendar.legend':
    'Точка — выполнено, кольцо — частично. Полоса снизу показывает выполнение дня. Нажмите на день, чтобы изменить отметки за него, включая прошлые.',
  'calendar.selected': 'Выбрано: {date}',
  'calendar.nothingPlanned': 'Ничего не запланировано',
  'calendar.completedLabel': 'Выполнено {done} из {total}: {names}',

  'editor.titleEdit': 'Привычка',
  'editor.titleNew': 'Новая привычка',
  'editor.err.name': 'Введите название привычки',
  'editor.err.start': 'Проверьте дату начала',
  'editor.err.endBeforeStart': 'Дата окончания раньше даты начала',
  'editor.err.goalMin': 'Цель должна быть не меньше 1',
  'editor.err.pickDay': 'Выберите хотя бы один день',
  'editor.err.timesPerWeek': 'Выберите количество дней в неделю',
  'editor.err.reminderTime': 'Время должно быть в формате ЧЧ:ММ',
  'editor.err.save': 'Не удалось сохранить',
  'editor.err.delete': 'Не удалось удалить',
  'editor.confirmDelete': 'Удалить вместе с историей?',
  'editor.name': 'Название',
  'editor.namePlaceholder': 'Например, стаканов воды',
  'editor.icon': 'Значок',
  'editor.iconAria': 'Значок',
  'editor.emoji': 'Эмодзи',
  'editor.color': 'Цвет',
  'editor.colorAria': 'Цвет {color}',
  'editor.track': 'Как отмечать',
  'editor.boolean': 'Да / нет',
  'editor.count': 'Счётчик',
  'editor.dailyGoal': 'Цель за день',
  'editor.unit': 'Единица',
  'editor.unitPlaceholder': 'стаканов, мин',
  'editor.note': 'Комментарий',
  'editor.notePlaceholder': 'Например: 2 стакана утром и 6 вечером',
  'editor.reminders': 'Напоминания',
  'editor.remindersHint': 'Уведомление, если к этому времени привычка не выполнена. Приложение должно быть запущено.',
  'editor.reminderAdd': 'Добавить время',
  'editor.reminderRemove': 'Убрать время',
  'editor.reminderTimeAria': 'Время напоминания',
  'editor.reminderMax': 'Не больше {max} времён',
  'editor.repeat': 'Повторение',
  'editor.everyDay': 'Каждый день',
  'editor.selectedDays': 'Выбранные дни',
  'editor.timesPerWeek': 'N раз в неделю',
  'editor.weekdays': 'Дни недели',
  'editor.weekdaysHint': 'Невыбранные дни серию не обнуляют.',
  'editor.timesLabel': 'Сколько раз в неделю',
  'editor.timesHint':
    'Серия считается неделями: сколько недель подряд выполнена квота. Текущая неделя ещё не закончилась.',
  'editor.start': 'Начало',
  'editor.endMode': 'Окончание',
  'editor.endNever': 'Бессрочно',
  'editor.endDate': 'До даты',
  'editor.endCount': 'Всего выполнений',
  'editor.endCountLabel': 'Количество выполнений',
  'editor.endCountHint': 'Считаются только запланированные дни.',
  'editor.resetStreak': 'Сбрасывать серию при пропуске',
  'editor.resetStreakHintOn': 'Пропущенный запланированный день обнуляет серию. Незапланированные дни не влияют.',
  'editor.resetStreakHintOff': 'Серия только копится и никогда не уменьшается: считается суммарное число выполненных дней.',

  'settings.title': 'Настройки',
  'settings.language': 'Язык',
  'settings.langSystem': 'Как в системе',
  'settings.langEn': 'English',
  'settings.langRu': 'Русский',
  'settings.app': 'Приложение',
  'settings.tray': 'Сворачивать в трей при закрытии окна',
  'settings.trayHint': 'Окно закрывается, приложение продолжает работать — интерфейс останется доступен с телефона.',
  'settings.reminders': 'Напоминания',
  'settings.remindersEnable': 'Напоминать о невыполненных привычках',
  'settings.remindersHint':
    'Уведомления приходят, пока приложение запущено. Включите автозапуск и сворачивание в трей, иначе они прекратятся вместе с приложением.',
  'settings.launch': 'Запускать при входе в систему',
  'settings.launchHint': 'Приложение стартует свёрнутым в трей.',
  'settings.appearance': 'Оформление',
  'settings.themeSystem': 'Как в системе',
  'settings.themeLight': 'Светлое',
  'settings.themeDark': 'Тёмное',
  'settings.weekStart': 'Первый день недели',
  'settings.monday': 'Понедельник',
  'settings.sunday': 'Воскресенье',
  'settings.remote': 'Доступ с других устройств',
  'settings.remoteEnable': 'Разрешить вход из локальной сети',
  'settings.remoteHint': 'Когда выключено, интерфейс открывается только на этом компьютере.',
  'settings.port': 'Порт',
  'settings.apply': 'Применить',
  'settings.portHint': 'После смены порта окно перезагрузится.',
  'settings.openAddress': 'Откройте адрес в браузере телефона или планшета',
  'settings.copyAddress': 'Скопировать адрес',
  'settings.addressCopied': 'Адрес скопирован',
  'settings.loginHint': 'Потребуется вход: логин {username} и пароль, который вы задали при первом запуске.',
  'settings.notConnected': 'Компьютер не подключён к домашней сети — подключите его к тому же Wi-Fi, что и телефон.',
  'settings.localOnly': 'Сейчас интерфейс доступен только на этом компьютере.',
  'settings.credentials': 'Вход с других устройств',
  'settings.username': 'Логин',
  'settings.newPassword': 'Новый пароль',
  'settings.passwordHint':
    'Не короче 8 символов, хотя бы одна буква и одна цифра. После смены другие устройства попросят войти заново.',
  'settings.update': 'Обновить',
  'settings.archive': 'В архиве',
  'settings.restore': 'Вернуть',
  'settings.archiveHint': 'История выполнения сохраняется, но в календаре и списке привычка не показывается.',
  'settings.data': 'Данные',
  'settings.export': 'Выгрузить копию',
  'settings.import': 'Загрузить копию',
  'settings.importHint': 'Загрузка заменяет текущие привычки и всю историю. Сделайте выгрузку перед заменой.',
  'settings.session': 'Сеанс',
  'settings.logout': 'Выйти',
  'settings.toast.portRange': 'Порт должен быть от 1024 до 65535',
  'settings.toast.portChanged': 'Порт изменён на {port}',
  'settings.toast.usernameShort': 'Имя не короче 2 символов',
  'settings.toast.passwordShort': 'Новый пароль не короче 8 символов',
  'settings.toast.credentialsUpdated': 'Логин и пароль обновлены',
  'settings.toast.fileError': 'Не удалось прочитать файл',
  'settings.toast.exportError': 'Не удалось выгрузить копию',

  'auth.login.title': 'Вход',
  'auth.login.body': 'Введите логин и пароль, заданные на этом компьютере.',
  'auth.login.username': 'Логин',
  'auth.login.password': 'Пароль',
  'auth.login.submit': 'Войти',
  'auth.login.busy': 'Входим…',
  'auth.login.error': 'Не удалось войти',
  'auth.offline.title': 'Нет связи с компьютером',
  'auth.offline.body':
    'Приложение хранит данные только на своём компьютере. Убедитесь, что он включён, а в настройках разрешён доступ из локальной сети, и что телефон подключён к той же сети.',
  'auth.retry': 'Повторить',
  'auth.onboard.title': 'Добро пожаловать',
  'auth.onboard.body':
    'Придумайте логин и пароль. На этом компьютере вход не потребуется, а с телефона или другого компьютера по локальной сети понадобится ввести их.',
  'auth.onboard.password': 'Пароль',
  'auth.onboard.repeat': 'Пароль ещё раз',
  'auth.onboard.hint': 'Минимум 8 символов, хотя бы одна буква и одна цифра.',
  'auth.onboard.submit': 'Начать',
  'auth.onboard.busy': 'Создаём…',
  'auth.onboard.mismatch': 'Пароли не совпадают',
  'auth.onboard.error': 'Не удалось создать учётную запись',

  'toast.setupDone': 'Готово. Привычки можно заводить.',
  'toast.imported': 'Данные заменены',
  'error.generic': 'Что-то пошло не так',
  'error.requestFailed': 'Ошибка запроса ({status})',

  'reminder.body': 'Пора выполнить «{name}»',
  'reminder.bodyWithNote': 'Пора выполнить «{name}»: {note}',

  'tray.open': 'Открыть',
  'tray.remoteOn': 'Доступ с других устройств',
  'tray.remoteOff': 'Локальный доступ выключен',
  'tray.copyUrl': '{url} — скопировать',
  'tray.urlCopied': 'Адрес скопирован: {url}',
  'tray.quit': 'Выход',
  'tray.inNetwork': 'В сети: {url}',
  'tray.localOnly': 'Только на этом компьютере',
  'tray.portBusy': 'Ошибка: порт {port} занят',
}

const DICTS: Record<Language, Record<TranslationKey, string>> = { en, ru }

export function t(lang: Language, key: TranslationKey, params?: Record<string, string | number>): string {
  let text: string = DICTS[lang][key] ?? en[key] ?? key
  if (params) {
    for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value))
  }
  return text
}

const MONTHS_NOM: Record<Language, string[]> = {
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
}

const MONTHS_GEN: Record<Language, string[]> = {
  en: MONTHS_NOM.en,
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
}

export const WEEKDAYS_MON_FIRST: Record<Language, string[]> = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
}

export function monthName(lang: Language, month0: number): string {
  return MONTHS_NOM[lang][month0] ?? ''
}

export function formatDate(lang: Language, date: DateStr, withYear = false): string {
  const d = parseDate(date)
  const month = MONTHS_GEN[lang][d.getMonth()] ?? ''
  if (lang === 'ru') {
    const base = `${d.getDate()} ${month}`
    return withYear ? `${base} ${d.getFullYear()}` : base
  }
  const base = `${month} ${d.getDate()}`
  return withYear ? `${base}, ${d.getFullYear()}` : base
}

export function dayWord(lang: Language, n: number): string {
  if (lang === 'en') return n === 1 ? 'day' : 'days'
  return pluralRu(n, 'день', 'дня', 'дней')
}

export function weekWord(lang: Language, n: number): string {
  if (lang === 'en') return n === 1 ? 'week' : 'weeks'
  return pluralRu(n, 'неделя', 'недели', 'недель')
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last > 1 && last < 5) return few
  if (last === 1) return one
  return many
}

export function describeSchedule(lang: Language, habit: Habit, weekStartsOn: 0 | 1 = 1): string {
  const schedule: Schedule = habit.schedule
  if (schedule.mode === 'daily') return t(lang, 'editor.everyDay')
  if (schedule.mode === 'timesPerWeek') {
    if (lang === 'en') return `${schedule.timesPerWeek} ${schedule.timesPerWeek === 1 ? 'time' : 'times'} a week`
    return `${schedule.timesPerWeek} ${schedule.timesPerWeek === 1 ? 'раз' : 'раза'} в неделю`
  }
  const labels = WEEKDAYS_MON_FIRST[lang]
  const days = [...schedule.days].sort((a, b) => ((a - weekStartsOn + 7) % 7) - ((b - weekStartsOn + 7) % 7))
  if (days.length === 0) return t(lang, 'editor.selectedDays')
  if (days.length === 7) return t(lang, 'editor.everyDay')
  return days.map((d) => labels[(d + 6) % 7]).join(', ')
}
