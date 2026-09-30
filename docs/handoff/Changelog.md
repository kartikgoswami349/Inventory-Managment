R58 Inventory — Handoff Changelog / Project History

This document records important development history that the next AI should understand before changing the project.

Established project direction

Mobile first

The Mobile application is the established and already-deployed application. Its behavior is the reference implementation for the PC version.

PC application added

A Windows Electron version was introduced as a companion to the Android application.

The goal is a full-featured PC inventory application, not a separate product with different business rules.

Important PC milestones

Phase 1 — PC sync prototype

A command-line PC prototype successfully communicated with an existing Android R58 device.

This proved that the PC could join the existing R58 sync ecosystem without requiring a Mobile redeployment.

Phase 2A — Electron PC application

The prototype was converted into an Electron desktop application.

During setup, several compatibility issues were resolved, including Electron/native-module setup and preload configuration.

IPv4 discovery/connection correction

An early connection attempt selected an IPv6 address that was not usable for the Android TCP server.

The working configuration uses IPv4 for the Android TCP connection path.

Do not regress by preferring an unusable IPv6 address when a valid local IPv4 address exists.

Automatic discovery

mDNS / Zeroconf discovery was added so the PC can find nearby R58 devices without requiring the user to type an Android IP address as the normal workflow.

Automatic synchronization

Automatic background synchronization was added and has been confirmed working.

Manual Sync Now must remain available as a fallback.

Trusted-device removal

The PC gained the ability to forget a trusted device. This removes the local trust relationship and stops normal authenticated automatic synchronization with that peer until it is paired again.

Mobile protection rule

The following rule is critical for all future work:

Do not modify the Mobile application while building PC parity unless the owner explicitly requests it or a verified protocol/security compatibility defect requires it.

The PC application should adapt to the existing Mobile protocol rather than forcing a Mobile redesign for convenience.

Current development objective

Complete the PC application so that its supported feature set and business behavior match the Mobile application as closely as practical on Windows.

Current implementation checkpoint

The PC inventory screen now opens a dedicated Add New Item form rather than embedding item creation in the inventory sheet. It follows the Mobile sequential Stock ID and opening-ledger behavior.

The PC transaction workflow now supports Issue and Receive, department/person selection (including Other), remarks, and per-item Add One / Remove One / Remove All quantity controls. A transaction batch is committed atomically after active-item and current-stock checks; local writes remain successful without waiting for synchronization.

No Mobile files, database schema, sync packet fields/version, transport, port, pairing/authentication rules, or immutable transaction/audit semantics were changed. The repository root package manifest's UTF-8 BOM was removed because Vite's PostCSS config discovery rejected it and could not complete the PC build.

The roadmap below lists proposed milestones without assigning phase numbers. Per owner direction, this work treats the next named milestone, Audit parity, as Phase 4.

Phase 4 — PC audit parity

The PC can search/select an active inventory item, record physical quantity and an optional remark, display the system quantity and live variance, save an audit without adjusting stock, or explicitly save and adjust stock. Audit plus optional `AUDIT_ADJUSTMENT` transaction are committed in one local database transaction. The PC exposes audit history, and successful local audit writes request background synchronization. This uses the existing immutable audit and transaction record IDs and packet format; no schema or protocol change was made. Desktop uses search-based item selection rather than the Mobile camera scanner.

Phase 5 — PC dashboard parity

The dashboard now mirrors the Mobile dashboard's inventory health counts (in stock, low stock, and out of stock), today's transaction/issue/receive/audit activity, and Inventory/Audit/Transactions/Device & Sync quick actions. Health is computed for active items from the transaction ledger using the same category boundaries as Mobile. Today's activity uses local-calendar-day boundaries converted to ISO timestamps; total transactions include all ledger transaction types, while issued/received count only matching transaction types. Existing PC total stock, total lifetime transaction/audit counts, and inventory/recent-transaction snapshots remain available.

Phase 6 — PC backup, restore, and data tools

The PC offers a portable SQLite backup-to-file, validated SQLite restore with an automatic pre-restore recovery backup in the PC app data folder, SQLite merge import that applies existing R58 mutable revision and immutable-ID rules, an Excel workbook with Inventory/Transactions/Audits worksheets, and manual JSON sync-packet import/export using the existing version-1 packet. Restore deduplicates source sync metadata using the established revision/time/device conflict ordering and upserts it after business records, so pre-existing source-style triggers cannot cause metadata-key collisions. Manual packet application rejects conflicting Stock IDs/QR codes and accepts transaction packets that omit PC-only optional fields. SQLite restore/import preserve the PC's local device identity and trusted-device settings. Restore is replacement; SQLite import and JSON import are merge operations. Manual JSON transfers do not authenticate their source, unlike paired LAN sync. No schema or packet-format changes were made.

PC department and people management

The PC now has a dedicated Departments screen to add departments and their people, remove people from future selections, and deactivate a department together with its people. Deactivation is soft: historical transaction records are retained. New and changed master records update the existing R58 sync metadata and request background sync; no schema or protocol changes were made.

Windows production packaging, updating, and diagnostics

Added x64 NSIS and MSI installer targets. `better-sqlite3` is rebuilt for Electron during packaging and unpacked from ASAR. NSIS installs support GitHub-release auto-update checks/downloads; MSI installs deliberately disable that updater because the updater is for NSIS and require installing a newer MSI manually. Main-process output, IPC failures, unhandled errors, updater events, and renderer crashes/load failures are persisted with `electron-log`, and the Device & Sync page can open the log folder. Both installers built successfully; the packaged app launched and its Electron-native SQLite binary was present. The NSIS update manifest was checked against the generated installer name. Release publishing requires a configured GitHub release and `GH_TOKEN`; live update testing, code signing, and clean-machine Windows installation/sync validation remain release gates.

Known engineering preferences

preserve working behavior;

make minimal changes;

avoid unnecessary rewrites;

keep offline-first behavior;

preserve manual sync fallback;

automatic sync must not block local writes;

do not use device-specific Stock ID ranges;

new sequential item creation remains controlled to avoid duplicate IDs across offline phones;

do not casually change pairing, discovery, authentication, or sync packets;

prefer direct reuse of Mobile business logic where technically safe.

Next phases proposed for the next AI

Code audit and parity inventory

inspect Mobile and PC source;

map every Mobile feature;

map each feature to PC status;

identify reusable modules.

PC shell and navigation completion

finish desktop navigation and layout;

establish a stable page/component structure.

Inventory parity

implement/verify item listing, search, create, edit, deactivate, QR handling and stock views using Mobile rules.

Transaction parity

implement/verify Issue/Receive workflow, Department/Person selection, scan/search behavior, remarks, summaries, stock validation, history and transaction details.

Audit parity

implement/verify physical stock audit, variance, adjustments, history and synchronization.

Dashboard parity

reproduce Mobile dashboard metrics and business definitions on PC.

Backup / restore / data tools

reproduce supported Mobile data-management behavior safely on PC.

Device & Sync management

finish polished nearby-device UI, pairing, trusted devices, forget-device flow, last-seen/last-sync status and manual Sync Now.

Cross-platform business-logic consolidation

only after parity is stable, extract safe shared pure logic/types/validation to reduce future inconsistency.

Testing and hardening

fresh PC install;

existing-data upgrade;

Android compatibility;

offline/online transitions;

multi-device testing;

repeated/idempotent sync;

error handling;

database recovery.

Production packaging

Windows production build;

SQLite native module packaging;

installer/update strategy;

first-run database initialization;

logging/error recovery;

release checklist.

Roadmap rule

No implementation should begin from this changelog alone. The next AI must compare the roadmap against the actual source tree and convert it into a file-by-file implementation plan before coding.