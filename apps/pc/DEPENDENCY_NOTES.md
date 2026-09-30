Dependency choices were checked on 2026-09-29.

- Electron 44.4.5 is current on npm at the time of preparation.
- better-sqlite3 13.0.3 is current on npm at the time of preparation and supports current Node major lines; the user's Node 24.x environment is appropriate.
- electron-vite 5.0.0 and React 19.3.0 are used for the desktop UI.

These versions may move after this package is prepared. The Android R58 protocol itself is independent of these UI/build dependencies.


Phase 2B adds `bonjour-service@1.4.4` for Windows mDNS/Zeroconf discovery. Run `npm.cmd install` before starting the app.
