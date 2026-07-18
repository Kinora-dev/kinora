---
title: Desktop app
description: A local Playwright trace viewer plus an account dashboard, in one Electron app.
---

The kinora desktop app is two things in one shell:

- **Local trace viewer** - open any local `trace.zip` with no account and no server. A
  self-contained replacement for `playwright show-trace`.
- **Account dashboard** - sign in to a kinora server and open straight on the latest run's
  failures.

## Download

[Download for macOS](https://github.com/Kinora-dev/kinora/releases/latest) (Apple Silicon). It
auto-updates from there: new versions download in the background and install on restart.

## What you can do

From a failing test in the account dashboard:

- **Re-run it locally** with your repo's own Playwright (never auto-installs; falls back to
  `npx --no-install`), and open the resulting trace inline.
- **Jump to the source** in your editor at the failing `file:line` (`code` and forks; override
  with `KINORA_EDITOR_CMD`).
- **Copy a ready-to-paste AI prompt** describing the failure.
- **Open the full trace** inline - the same embedded Playwright trace viewer as the web
  dashboard.

## Open a local trace

Three ways, no account needed:

- **File → Open Trace…**
- **Drag-drop** a `.zip` onto the window.
- Pass a path as an argument, or open a `.zip` with the app on macOS.

## Signing in

The app signs in with the OAuth device flow: it shows a code, you approve it at
`app.kinora.dev/device` in your browser, and the app receives a token (stored in the OS keychain).
For self-host, it points at your own server instead.
