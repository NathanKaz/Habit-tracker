# Habit Tracker 1.1.0

Release date: 2026-10-07 · Previous release: v1.0.3

---

## English

### Statistics tab
- New **Statistics** tab: completion rate, current streak vs. record, active habits and total marks for week / month / 3 months / all time.
- Completion chart by day or by week, plus a 12-week heatmap of planned vs. done.
- Filter everything by a single habit — the chart and the accent color follow the selection.
- CSV export respects the habit filter.

### Habit notes and reminders
- Every habit has a free-form note: it shows on the card and is included in reminder text.
- Per-habit reminder times (up to 8, `HH:MM`) with desktop notifications while the app is open.

### Everyday improvements
- Reorder habits with **▲ / ▼** buttons; the order syncs to every connected device.
- Counter habits get a direct value input — type `77` instead of tapping +77 times.
- Archive a habit from the editor; archived habits keep their full history and are restorable in Settings.
- Future dates are disabled in the calendar and rejected by the API, so a habit can't be marked ahead of time.

### Reminders and sign-ins
- Due reminders also appear as an **in-app toast with an "Open" button**, so they work from other devices over the local network even when the OS blocks notifications; duplicates are suppressed per day.
- Settings → **Devices**: list of active sign-ins with browser, OS and last activity; end any other sign-in with one click (the current device is marked and cannot be removed from the list).
- Browser notification permission is requested explicitly from Settings.

### Data reliability
- **Daily data backup**: one copy per day into the `backups/` folder next to `data.json`, up to 30 copies; toggle in Settings.
- **Import preview**: a dialog shows "X habits, Y marks" and an optional "restore settings from the file" checkbox before anything is replaced.
- **Undo for deletion**: deleting a habit shows an "Undo" toast; the server keeps a snapshot of the habit and its marks, so restore works even after a reload.

### Fixes
- Marks for future dates now return `400` from the API.
- Statistics "Record" shows the best streak instead of the current one.

### Artifacts
- Linux: `habit-tracker-1.1.0-x86_64.AppImage`, `habit-tracker-1.1.0-amd64.deb`
- Windows / macOS builds are produced by the release workflow when the `v1.1.0` tag is pushed.

---

## Русский

### Вкладка «Статистика»
- Новая вкладка **Статистика**: выполнение, текущая серия и рекорд, число активных привычек и отметок за неделю / месяц / 3 месяца / всё время.
- График выполнения по дням и по неделям, тепловая карта последних 12 недель «план vs. сделано».
- Фильтр по одной привычке — график и акцентный цвет следуют выбору.
- Экспорт CSV учитывает фильтр.

### Комментарии и напоминания
- У каждой привычки есть свободный комментарий: он виден на карточке и попадает в текст напоминания.
- Время напоминаний у каждой привычки (до 8, `ЧЧ:ММ`) с системными уведомлениями, пока приложение открыто.

### Повседневные улучшения
- Перестановка привычек кнопками **▲ / ▼**; порядок синхронизируется на всех устройствах.
- У счётчиков появилось поле значения: впишите `77`, а не нажимайте +77 раз.
- Архивирование привычки из редактора: история сохраняется, вернуть можно в настройках.
- Будущие даты отключены в календаре и отклоняются API — отметить день наперёд нельзя.

### Напоминания и входы
- Наступившее напоминание показывается и **тостом с кнопкой «Открыть»** — работает с других устройств по локальной сети, даже когда система запрещает уведомления; повторы за день подавляются.
- Настройки → **Устройства**: список активных входов с браузером, системой и последней активностью; любой чужой вход завершается в один клик (текущее устройство помечено и из списка не удаляется).
- Разрешение на уведомления в браузере запрашивается явно в настройках.

### Надёжность данных
- **Ежесуточная копия данных**: один раз в сутки файл копируется в папку `backups` рядом с `data.json`, хранится до 30 копий; переключатель в настройках.
- **Предпросмотр импорта**: диалог показывает «X привычек, Y отметок» и галочку «восстановить настройки из файла» до какой-либо замены.
- **Отмена удаления**: после удаления привычки появляется тост «Отменить»; сервер хранит снимок привычки с отметками, поэтому восстановление работает даже после перезагрузки.

### Исправления
- Отметки на будущие даты API теперь отвечает `400`.
- «Рекорд» в статистике показывает лучшую серию, а не текущую.

### Артефакты
- Linux: `habit-tracker-1.1.0-x86_64.AppImage`, `habit-tracker-1.1.0-amd64.deb`
- Сборки для Windows / macOS создаются релизным workflow при отправке тега `v1.1.0`.
