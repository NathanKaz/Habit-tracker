# Habit Tracker 1.1.1

Release date: 2026-10-08 · Previous release: v1.1.0

---

## English

### Statistics fixes
- Chart bars now **fill the available width** — stretching the window no longer leaves gaps between the columns.
- **"3 months" shows every day** instead of merging days into weeks; "All time" also shows days until the history exceeds one year (weekly buckets only after that).
- Hovering anywhere over a bar column shows its tooltip, including days with 0 %.
- Heatmap cells show a tooltip on **every** cell — date, done of planned and percent — immediately on hover.

### Mobile fixes
- Period buttons (**Week / Month / 3 months / All time**) now sit in a single row on the second line, under the "Statistics" title and the **Export CSV** button, on narrow screens.
- The habit note field no longer renders black-on-black in the dark theme on phones — form controls inherit the theme text color.
- Settings explain the real reason when notifications are unavailable: system notifications require **HTTPS or localhost**, the browser blocks them over plain HTTP; reminders still appear inside the app.

---

## Русский

### Исправления статистики
- Столбцы графика теперь **заполняют доступную ширину** — при растягивении окна между ними больше не появляется пустое поле.
- **«3 месяца» показывает каждый день** вместо слияния в недели; «Всё время» тоже показывает по дням, пока история не длиннее года (только после этого — по неделям).
- Подсказка появляется при наведении на любую точку столбца, включая дни с 0 %.
- Ячейки тепловой сетки показывают подпись на **каждой** клетке — дату, «сделано из плана» и процент — сразу при наведении.

### Исправления на телефоне
- Кнопки периодов (**Неделя / Месяц / 3 месяца / Всё время**) на узких экранах выстраиваются в один ряд на второй строчке — под заголовком «Статистика» и кнопкой «Экспорт CSV».
- Поле комментария привычки больше не отображается чёрным по чёрному в тёмной теме на телефонах — элементы формы наследуют цвет текста темы.
- В настройках указана настоящая причина недоступных уведомлений: системные уведомления требуют **HTTPS или localhost**, по обычному HTTP браузер их блокирует; напоминания всё равно показываются внутри приложения.
