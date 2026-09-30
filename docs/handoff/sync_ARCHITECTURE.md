R58 Inventory — Synchronization Architecture

Purpose

This document describes the current synchronization model that the PC implementation must preserve for compatibility with the already-deployed Mobile application.

High-level architecture

Android R58                         Windows R58 PC
─────────────                       ───────────────
Local SQLite                       Local SQLite
      │                                   │
      │       mDNS / Zeroconf             │
      ├───────────────────────────────────┤
      │                                   │
      │       TCP :45858                  │
      ├───────────────────────────────────┤
      │                                   │
      │   Pairing / Trusted Device        │
      │   Shared Secret / Auth Proof      │
      ├───────────────────────────────────┤
      │                                   │
      │        Sync Packet Exchange       │
      ├───────────────────────────────────┤
      │                                   │
      ▼                                   ▼
   Apply local                         Apply local
   changes                             changes

Current transport

TCP port: 45858

newline-delimited JSON messages are used by the TCP layer

each device runs a sync server so either side can initiate communication

the current protocol must remain compatible with the already-deployed Android app

Nearby discovery

The PC uses bonjour-service for mDNS / Zeroconf discovery.

R58 services use:

service type: r58inventory

protocol: tcp

port: 45858

TXT metadata includes the device identity, device name, and protocol version.

The PC should select a usable LAN IPv4 address when available. The transient IP is a connection address, not the permanent identity of the trusted device.

Pairing

Pairing establishes trust between two R58 devices.

Current concept:

PC discovers Android
       ↓
PC obtains current LAN address
       ↓
Pairing request sent to Android
       ↓
Android validates temporary 6-digit code
       ↓
Shared secret created
       ↓
Device is stored as trusted
       ↓
Normal authenticated synchronization becomes available

The pairing code is temporary and expires after a short session. The trusted-device relationship is persistent until explicitly forgotten/removed.

Authentication

The existing authentication model uses a shared secret and an authentication proof.

The proof is SHA-256 of:

sharedSecret:packetId:direction

The direction is either:

REQUEST

RESPONSE

Do not alter this formula without an explicit protocol versioning and migration plan.

Sync packet

The current packet is conceptually:

R58_SYNC_PACKET
version: 1
packetId
sourceDevice
records:
  items
  departments
  people
  transactions
  audits

Each record entry carries synchronization metadata such as:

entity type

entity ID

revision

modified time

modifying device

deleted flag

Transactions and audits are treated as immutable by record ID. Mutable entities use conflict-resolution metadata.

Conflict behavior

The established mutable-record rule is based on:

record existence

higher revision wins

lower revision is ignored

equal revision compares modified time

equal time uses a deterministic device-ID comparison

The PC implementation must preserve this behavior for compatibility.

Import/apply behavior

The current model applies mutable records before immutable records, within a database transaction, and restores the local trigger/device context before completion.

The sync process should be atomic from the local database's point of view: a partially imported packet should not leave the database in an inconsistent state.

Automatic synchronization

Automatic synchronization is currently working.

The intended behavior is:

discovery keeps the local network peer list current;

only trusted devices are eligible for automatic sync;

periodic synchronization occurs in the background while the application is available;

a local write can request an immediate non-blocking synchronization attempt;

the local write must succeed even when no peer or network is available;

manual Sync Now remains as a fallback.

PC-specific expectations

The PC must behave as a full R58 peer, not merely as a one-way receiver.

It must:

advertise itself;

discover Android R58 devices;

accept Android-initiated synchronization;

initiate synchronization with trusted Android devices;

validate request authentication;

return authenticated responses;

import remote data;

export its own current sync state;

continue local operation while offline.

Forget Trusted Device

Forgetting a trusted device removes the local trusted relationship on the PC side and therefore prevents normal authenticated automatic synchronization with that device until pairing is established again.

Forgetting a device must not delete inventory, transaction, or audit data.

Sync safety checklist

Before changing synchronization code:

identify the exact Mobile implementation currently deployed;

identify the exact PC implementation currently working;

compare packet types and field names;

compare authentication proof generation and verification;

compare conflict-resolution rules;

compare immutable record handling;

test both Android → PC and PC → Android;

test offline/reconnect;

test repeated sync for idempotency;

test multiple trusted devices.