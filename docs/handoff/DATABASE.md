R58 Inventory — Database and Data Model Handoff

Purpose

The PC application must reach functional parity with Mobile without creating a second, incompatible interpretation of inventory data.

The actual deployed Mobile source is the primary schema/behavior reference. Inspect its current database initialization, migrations, repositories, triggers, and queries before making any schema change.

Core entities

The project currently uses these major logical entities:

Items

Departments

People

Transactions

Audits

Synchronization metadata

Trusted devices

Local device identity

Items

Known fields include concepts equivalent to:

id
stock_id
old_item_id
item_name
unit
minimum_stock
qr_code
active
created_at
updated_at

The item identity and Stock ID rules must remain consistent with Mobile.

Important business rule:

Stock IDs are sequential.

Inactive/deactivated IDs are not silently reused.

New item creation is intended to remain controlled to avoid duplicate sequential IDs across offline phones.

Do not introduce device-specific Stock ID ranges unless the owner explicitly changes this requirement.

Transactions

Known transaction fields include concepts equivalent to:

id
item_id
transaction_type
quantity
stock_delta
department_id
person_id
other_name
remark
timestamp
device_id

The project uses a ledger-style stock model in which stock is derived from transaction stock_delta.

General behavior:

RECEIVED adds stock.

ISSUED removes stock.

ISSUED must not take stock below the available quantity.

Transactions are immutable records by ID for synchronization purposes.

Current stock

Current item quantity is derived from transaction stock deltas rather than a separately edited authoritative quantity field.

A typical conceptual query is:

SELECT COALESCE(SUM(stock_delta), 0)
FROM transactions
WHERE item_id = ?;

Do not replace this model with a second independent stock counter without a migration and reconciliation strategy.

Stock before / after

Transaction history can derive stock-before and stock-after values from ordered transaction deltas.

The displayed sign of an Issue transaction must reflect the signed stock_delta rather than assuming all transaction quantities are positive in every context.

Audits

Audits record an observed physical quantity and compare it with the system quantity.

Known concepts include:

id
item_id
system_quantity
audited_quantity
variance
remark
timestamp
device_id

If an audit causes a stock adjustment, the adjustment must follow the same stock-integrity rules and must synchronize correctly.

Departments and People

Departments and people are separate logical entities.

People are associated with departments, and the UI filters person choices based on the selected department.

The existing Department → Person behavior is considered working and should not be redesigned without a real requirement.

Sync metadata

Synchronization uses a metadata index for mutable/immutable records.

Known concepts include:

entityType
entityId
revision
modifiedAt
modifiedByDevice
deleted

The metadata is used to decide whether an incoming mutable record should replace local state.

Do not remove the sync metadata tables/triggers simply because the PC UI does not expose them.

Trusted devices

The PC also stores trusted-device information, including concepts equivalent to:

device_id
device_name
shared_secret
paired_at
last_seen_at
last_sync_at

This data controls authenticated peer synchronization.

Forgetting a trusted device must remove the trust relationship without deleting business data.

Local device identity

Each installation has a persistent local device identity used by:

synchronization metadata;

audit/transaction provenance;

pairing;

trusted device records;

authentication.

Do not hard-code a fixed device ID.

Database compatibility rules

Before making any database change:

inspect Mobile schema and migrations;

inspect PC schema and migrations;

compare column names/types;

identify whether the change affects the sync packet;

create a migration if required;

test old data;

test sync before and after the change.

Never solve a schema mismatch by deleting the database during normal development/testing unless the test explicitly concerns a fresh install.

Data integrity priorities

Highest priority:

never lose inventory data;

never lose immutable transaction/audit records;

never corrupt stock calculations;

preserve device provenance;

preserve sync idempotency;

keep offline operation working.