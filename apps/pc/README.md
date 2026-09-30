# R58 Inventory — Windows Phase 2B

This is the first real Windows desktop stage after the protocol compatibility test succeeded with the existing deployed Android R58 app.

## Important compatibility rule

The Android app is NOT modified or redeployed by this project.

The Windows peer uses the same protocol values verified from the existing R58 Android source:

- TCP port: `45858`
- `R58_PAIR_REQUEST` / `R58_PAIR_RESULT`
- `R58_SYNC` / `R58_SYNC_RESULT`
- sync packet format: `R58_SYNC_PACKET`
- sync packet version: `1`
- authentication proof: SHA-256 of `sharedSecret:packetId:REQUEST` or `sharedSecret:packetId:RESPONSE`
- record groups: items, departments, people, transactions, audits
- mutable merge order: departments → people → items
- immutable merge rule: transaction/audit ID already exists → skip
- mutable conflict order: revision → modified time → modified-by-device

## What this stage adds

- Windows desktop UI built with Electron + React.
- Local SQLite database using `better-sqlite3`.
- Permanent PC device ID.
- PC-side TCP server on `45858`.
- Generate a pairing code on the PC.
- Pair the PC with the existing Android app.
- Pair the PC to an Android app using the Android-generated code.
- Two-way sync with the existing Android app.
- Inventory view with search.
- Transaction history view.
- Dashboard with synced inventory totals.

## What is deliberately not included yet

- Add/edit/deactivate item UI.
- Issue/Receive/Audit workflow on PC.
- Excel export.
- Installer/production packaging.

The local database, two-way sync, nearby discovery, and automatic sync are included in this Phase 2B build.

## Run on Windows

Use Node 24+.

Open PowerShell in this project folder:

```powershell
npm.cmd install
npm.cmd run dev
```

The app should open as a Windows desktop window.

## First run

1. Start the existing Android R58 app.
2. Put PC and Android phone on the same Wi-Fi/LAN.
3. In Windows R58 open `Device & Sync`.
4. Enter the Android phone's local IP and the Android pairing code.
5. Click `Pair with Android R58`.
6. After pairing, click `Sync Now`.
7. The inventory, departments, people, transactions and audits received from Android should appear in the Windows app.

## Windows Firewall

When Windows asks whether to allow Node/Electron through the firewall, allow it on your **Private network**. The PC peer listens on TCP `45858` so another R58 device can reach it.

## Connection note

The manual Android IP field remains available as a fallback. In Phase 2B, the PC also discovers nearby R58 peers and prefers the IPv4 address that matches the Windows PC's local subnet. When several addresses are advertised, automatic sync tries them in order before falling back to the last successful host.

## Phase 2B — Nearby Devices + Automatic Sync

This build keeps the existing R58 TCP protocol on port 45858 and adds Windows-side LAN discovery using mDNS/Zeroconf. The PC advertises itself as `_r58inventory._tcp.local` with the same TXT fields used by the Android R58 discovery service (`deviceId`, `deviceName`, `protocol=1`). The PC prefers discovered IPv4 addresses that are on the same local subnet as the Windows PC, and it avoids carrier-grade shared space (`100.64.0.0/10`). If mDNS exposes multiple IPv4 addresses, automatic sync tries the available candidates until one responds.

Automatic sync runs in the Electron main process:
- starts LAN discovery when the app opens;
- checks trusted R58 devices about every 30 seconds;
- prefers the currently discovered IPv4 address and falls back to the last known host;
- runs network synchronization in the background so UI/local database work is not blocked;
- keeps the existing **Sync Now** manual fallback;
- automatically queues a background sync after a successful pairing.

### Additional dependency

Run:

```powershell
npm.cmd install
```

This installs `bonjour-service@1.4.4`.

### Windows firewall

The existing R58 TCP sync server uses TCP `45858`. Nearby discovery uses multicast DNS (mDNS), UDP `5353`, on the local network. Windows may show a firewall prompt the first time the desktop app uses these sockets. Allow access on **Private networks** for the R58 Inventory app. Public-network access is not required for normal home/office LAN use.

### Important behavior

Discovery only finds devices on the same LAN. A device is **not automatically trusted** merely because it is nearby. Automatic syncing is attempted only with devices already present in `trusted_devices`.

If mDNS discovery is unavailable on a particular Wi-Fi/router, manual IP pairing/sync remains available and the PC can also use the last known host as an automatic-sync fallback.

## Trusted device management

The Device & Sync page now includes **Forget trusted device**. Forgetting a device removes its local trust record and sync-peer entry on the PC, so automatic sync will no longer run for that device. Inventory, item, transaction, and audit data already stored on the PC are not deleted.

Forgetting on the PC does **not** erase the PC from the Android device's trusted-device list; the two sides can be paired again later.
