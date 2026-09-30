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