R58 Inventory — AI Handoff

Status: Active PC parity work. The owner explicitly requested the inventory and transaction UI work recorded below; future work must continue to follow the compatibility constraints in this document.

Current progress:

The PC now has a separate Add New Item screen with sequential Stock ID generation, optional opening stock, and local transactional persistence. Its Issue / Receive workflow supports per-item Add One, Remove One, and Remove All controls, department/person selection, and atomic ledger writes with final stock validation. The Departments management screen supports adding departments and people, removing people from future selections, and deactivating departments together with their people while preserving transaction history; changes update R58 sync metadata and request background sync. Phase 4 (Audit parity) supports active-item search, physical count and remark entry, variance review, immutable audit-only saves or explicit stock adjustment through an immutable `AUDIT_ADJUSTMENT` ledger entry, and audit history. Phase 5 (Dashboard parity) presents Mobile-equivalent inventory health categories and today's transaction/audit activity. Phase 6 (Backup / restore / data tools) provides SQLite backup-to-file and replace-restore with an automatic recovery copy in the PC app data folder, additive SQLite import using R58 revision rules, Excel export with Inventory/Transactions/Audits sheets, and manual JSON sync-packet import/export. Restore/import preserve the PC device identity and trusted-device configuration. Restore collapses duplicate source sync metadata by the established revision/time/device conflict ordering and upserts metadata after business records so any pre-existing source-style triggers cannot cause a unique-key collision. Manual packet application validates Stock ID/QR identity conflicts and handles transaction fields absent from older/mobile packets without changing packet format. Windows production support now defines x64 NSIS and MSI installers, Electron ABI rebuild/unpacked packaging for `better-sqlite3`, GitHub-release auto-update for NSIS only, and per-user diagnostic logs accessible from Device & Sync. Both installer builds and packaged startup/native-module loading have been verified. MSI updates are manual. Installer signing, a published update release/live update test, and clean-machine installation/sync validation remain release-time gates. All changes remain PC-only and the sync packet format and port are unchanged.

Dashboard health counts include active items only: in-stock means current stock is above minimum stock; low-stock means current stock is positive and at or below minimum; out-of-stock means current stock is zero or less. Today's transaction count includes all ledger transaction types, while Issue and Receive counts include their respective types. Day boundaries use local midnight converted to ISO timestamps, matching the Mobile dashboard. Desktop audit item selection uses search instead of the Mobile-only camera scanner.

Prompt for the Next AI

This is my R58 Inventory project. The project contains a handoff folder. Read the handoff documents carefully before doing anything.

My Mobile version is already working and deployed. We must preserve it.

The PC version is now being built.

Important current state:

Mobile version is already working and deployed.

PC ↔ Android synchronization is already implemented and tested.

Automatic synchronization is working.

Nearby-device discovery is working.

Pairing is working.

Trusted devices are supported.

Forget Trusted Device has been added on the PC side.

The PC side must now be completed with the same functional behavior as the Mobile version.

Do not make changes to the Mobile version unless I explicitly request them or a proven protocol-compatibility bug requires it.

We should reuse business logic, types, validation rules, transaction rules, and behavior from the Mobile version whenever that is technically appropriate. The goal is to reduce inconsistent behavior between Mobile and PC.

Do not rewrite working synchronization, pairing, discovery, or authentication just for architectural cleanliness.

Do not implement anything immediately. First inspect the actual source code and produce a complete roadmap through production.

First task after reading this handoff

Inspect the entire project, including the Mobile and PC applications.

Inspect the handoff documents.

Identify the exact current implementation and the responsibilities of important files.

Build a feature parity matrix: Mobile feature → current PC status → files involved → whether code can be reused/shared → implementation plan.

Build a dependency and architecture map.

Identify anything that could accidentally break the already-deployed Mobile app.

Produce a phased roadmap all the way to a production-ready Windows PC version.

Include testing gates for each phase.

Do not modify files or write implementation code yet.

Stop after presenting the roadmap and wait for my approval.

Source of truth

The actual source code is the final source of truth. The handoff documents describe requirements and known project history, but they do not replace source inspection.

Do not assume a feature is implemented merely because it is described here. Verify it in the code.

Current project layout

The combined project is intended to contain two independent applications:

R58-Inventory/
├── apps/
│   ├── mobile/    # Expo / React Native Android application
│   └── pc/        # Electron / Vite Windows application
└── docs/
    └── handoff/

Do not merge the two dependency trees into one indiscriminate package configuration. Mobile and PC have different runtimes and native modules.

Mobile requirements

The Mobile app is the established behavior reference for the PC app.

Whenever PC functionality is equivalent to an existing Mobile function, prefer one of these approaches, in order:

Reuse the same platform-independent module directly if it is truly compatible.

Extract a small shared module containing pure business logic/types/validation without changing behavior.

Reimplement only the UI or platform adapter on PC while keeping the same rules and data contracts.

Do not alter Mobile behavior merely to make reuse easier.

PC goal

Build a complete Windows desktop version of the R58 Inventory system with functional parity with Mobile wherever the feature makes sense on Windows.

The PC version should feel native to desktop while preserving the same inventory rules, transaction rules, data model, sync behavior, and user-visible business behavior.

Sync compatibility rules

The existing Mobile-to-PC protocol is already working. Preserve compatibility.

Known protocol characteristics:

TCP port: 45858

mDNS / Zeroconf nearby discovery

temporary 6-digit pairing code

trusted-device model

shared-secret authentication

SHA-256 authentication proof based on shared secret, packet ID, and direction

synchronization packets with versioned format

immutable transaction/audit records

mutable records with revision/modified-time conflict rules

automatic sync and manual Sync Now fallback

Do not redesign these pieces unless a concrete bug or an explicitly approved requirement calls for it.

Offline-first requirement

Both applications must continue to work locally when the network is unavailable.

A network failure must not prevent a successful local inventory operation.

Sync should be non-blocking relative to the local write path.

Inventory/business rules that must remain consistent

These must be verified from the Mobile code before the PC implementation is considered complete:

Item identity / Stock ID rules

QR code behavior

sequential new-item creation rules

inactive item behavior / no silent ID reuse

current stock calculation

Issue vs Receive behavior

insufficient-stock protection for Issue

Department → Person dependency

Other person/name handling

transaction remarks

transaction history

audit behavior and stock adjustment rules

backup/restore behavior

dashboard metrics

search behavior

scanner behavior where applicable

Transaction behavior reference

The established transaction workflow has these principles:

User selects Issue or Receive before scanning.

Department and recipient/person are selected once for the transaction session.

One successful QR scan represents one item.

No manual quantity entry is used in the scanner workflow.

Repeated scans of the same QR increase the count.

Different items appear as separate transaction lines.

Each item has its own Remove One control.

A short post-scan delay helps prevent accidental double scans.

The transaction save must preserve stock integrity and remain atomic where multiple records are involved.

These points are requirements to verify against the actual Mobile source before reusing them on PC.

Code-quality rules

Make the smallest safe change.

Preserve working code.

Do not refactor unrelated areas during feature work.

Do not change database schema without a migration/compatibility plan.

Do not change sync packet contracts casually.

Do not remove manual Sync Now just because automatic sync exists.

Do not store a transient LAN IP as the permanent identity of a device.

Do not use device-specific Stock ID ranges.

Do not copy node_modules, build output, caches, or secrets into handoff archives.

Production safety

Before any production release, verify at minimum:

TypeScript/build has no errors.

Mobile remains unchanged and functional.

PC starts cleanly on a fresh machine/build.

SQLite native modules are packaged correctly for Electron.

Existing data opens successfully.

Existing Android devices can still sync.

New PC can pair with Android without mobile redeployment.

Automatic discovery and automatic sync work on the same LAN.

Offline changes synchronize after reconnection.

Trusted-device removal works as intended.

Multiple devices do not create duplicate immutable records.

Backup/restore is tested.

Production packaging/signing is tested without destroying existing mobile data.

Do not do this on takeover

Do not:

rewrite the Mobile application;

replace the sync engine without evidence;

replace SQLite without a migration plan;

merge mobile and PC package dependencies blindly;

rename database columns casually;

change the sync protocol version without a compatibility plan;

remove currently working features to simplify the PC build;

generate implementation code before presenting the roadmap.