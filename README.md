# Habit Tracker

A desktop habit tracker with a calendar, streaks, and access from your phone over the local network.

**English** · [Русский](README.ru.md)

## Features

- Two habit types: yes/no and counters with a daily target (e.g. 8 glasses of water).
- Flexible schedules: every day, selected weekdays, or N times per week.
- Streaks with current and best values, plus weekly, monthly, and total progress.
- Optional per-habit "reset streak on miss" behaviour.
- Today view and a month calendar for looking back and filling in missed days.
- Access from your phone or another computer on the same Wi-Fi (QR code to connect).
- English and Russian interface, or follow the system language.
- Light, dark, and system themes; week can start on Monday or Sunday.
- System tray, launch at login, and JSON export/import for backups.

## Tech stack

Electron 44 · React 19 · Vite 8 · Express 5 · WebSocket (`ws`) · Zod 4 · TypeScript. Unit tests run on Vitest.

## Requirements

- Node.js 20+ (22 LTS recommended) and npm.
- To build installers locally: Linux or macOS; Windows builds from Linux need Wine.

## Development

```bash
npm install
npm run dev        # Vite on :5173, API on :47821, Electron window
npm run typecheck  # TypeScript checks for main and renderer
npm test           # Vitest
npm run build      # compile main process and renderer
```

## Packaging

```bash
npm run package       # Linux: AppImage + .deb
npm run package:win   # Windows: NSIS installer + portable .exe
npm run package:mac   # macOS: .dmg + .zip (must run on macOS)
npm run package:all   # all of the above
```

Artifacts are written to `release/`.

## Downloads

Grab the latest build from the [Releases](https://github.com/NathanKaz/Habit-tracker/releases) page:

- **Linux** — `habit-tracker-<version>-x86_64.AppImage` (`chmod +x` and run) or `habit-tracker-<version>-amd64.deb`.
- **Windows** — `habit-tracker-<version>-setup.exe` (installer) or `...-portable.exe`.
- **macOS** — `habit-tracker-<version>-<arch>.dmg` or `.zip` (Intel `x64`, Apple Silicon `arm64`).

The builds are currently unsigned, so Windows SmartScreen and macOS Gatekeeper may warn you. On macOS, right-click the app and choose **Open** the first time. Only 64-bit builds are provided.

## Access from your phone

1. Open **Settings** and enable **Remote access**.
2. Connect the phone to the same Wi-Fi network.
3. Scan the QR code, or open the shown `http://<local-ip>:47821` address in the phone browser.
4. Sign in with the account created on the computer.

The server listens on `127.0.0.1:47821` by default and only opens to the local network when remote access is enabled. Account creation is allowed only from the computer itself.

## Data and backup

All data lives in a single JSON file inside Electron's `userData` directory:

| OS | Path |
|----|------|
| Linux | `~/.config/Habit Tracker/data.json` |
| macOS | `~/Library/Application Support/Habit Tracker/data.json` |
| Windows | `%APPDATA%\Habit Tracker\data.json` |

Use **Settings → Export / Import** for backups. Passwords are stored as salted [scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback) hashes; session tokens are stored only as SHA-256 hashes.

## Project structure

```
src/
  main/       Electron main process: window, tray, HTTP server, storage, domain logic
    api/      Express routes, validation schemas, state builder
    domain/   schedules, streaks, dates, types
  renderer/   React UI (views, components, state, i18n)
  shared/     code shared between main and renderer
  i18n/       server-side translations
tests/        Vitest unit tests
scripts/      icon generation
```

## License

Not specified yet.
