export const CREATE_TABLES_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY NOT NULL,
  stock_id TEXT UNIQUE NOT NULL,
  old_item_id TEXT,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  minimum_stock REAL NOT NULL DEFAULT 0,
  qr_code TEXT UNIQUE NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT UNIQUE NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY NOT NULL,
  department_id TEXT,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,

  FOREIGN KEY (department_id)
  REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  quantity REAL NOT NULL,
  stock_delta REAL NOT NULL,
  department_id TEXT,
  person_id TEXT,
  other_name TEXT,
  remark TEXT,
  timestamp TEXT NOT NULL,
  device_id TEXT NOT NULL,

  FOREIGN KEY (item_id)
  REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT NOT NULL,
  system_quantity REAL NOT NULL,
  audited_quantity REAL NOT NULL,
  variance REAL NOT NULL,
  remark TEXT,
  timestamp TEXT NOT NULL,
  device_id TEXT NOT NULL,

  FOREIGN KEY (item_id)
  REFERENCES items(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_item
ON transactions(item_id);

CREATE INDEX IF NOT EXISTS idx_transactions_timestamp
ON transactions(timestamp);

CREATE INDEX IF NOT EXISTS idx_audits_item
ON audits(item_id);
CREATE TABLE IF NOT EXISTS local_device (
  id INTEGER PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_records (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,

  revision INTEGER NOT NULL DEFAULT 1,

  modified_at TEXT NOT NULL,
  modified_by_device TEXT NOT NULL,

  deleted INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (
    entity_type,
    entity_id
  )
);

CREATE INDEX IF NOT EXISTS
idx_sync_records_modified
ON sync_records(modified_at);


CREATE TABLE IF NOT EXISTS sync_peers (
  device_id TEXT PRIMARY KEY NOT NULL,

  device_name TEXT,

  last_seen_at TEXT,
  last_sync_at TEXT
);


/*
  ITEMS
*/

CREATE TRIGGER IF NOT EXISTS
sync_item_insert
AFTER INSERT ON items

BEGIN

  INSERT INTO sync_records (
    entity_type,
    entity_id,
    revision,
    modified_at,
    modified_by_device,
    deleted
  )

  VALUES (
    'ITEM',
    NEW.id,
    1,

    COALESCE(
      NEW.updated_at,
      NEW.created_at,
      datetime('now')
    ),

    COALESCE(
      (
        SELECT device_id
        FROM local_device
        WHERE id = 1
      ),
      'UNKNOWN'
    ),

    0
  )

  ON CONFLICT(
    entity_type,
    entity_id
  )

  DO UPDATE SET

    revision =
      sync_records.revision + 1,

    modified_at =
      excluded.modified_at,

    modified_by_device =
      excluded.modified_by_device,

    deleted = 0;

END;


CREATE TRIGGER IF NOT EXISTS
sync_item_update
AFTER UPDATE ON items

BEGIN

  INSERT INTO sync_records (
    entity_type,
    entity_id,
    revision,
    modified_at,
    modified_by_device,
    deleted
  )

  VALUES (
    'ITEM',
    NEW.id,
    1,

    datetime('now'),

    COALESCE(
      (
        SELECT device_id
        FROM local_device
        WHERE id = 1
      ),
      'UNKNOWN'
    ),

    0
  )

  ON CONFLICT(
    entity_type,
    entity_id
  )

  DO UPDATE SET

    revision =
      sync_records.revision + 1,

    modified_at =
      excluded.modified_at,

    modified_by_device =
      excluded.modified_by_device,

    deleted = 0;

END;


/*
  DEPARTMENTS
*/

CREATE TRIGGER IF NOT EXISTS
sync_department_insert
AFTER INSERT ON departments

BEGIN

  INSERT INTO sync_records (
    entity_type,
    entity_id,
    revision,
    modified_at,
    modified_by_device,
    deleted
  )

  VALUES (
    'DEPARTMENT',
    NEW.id,
    1,
    datetime('now'),

    COALESCE(
      (
        SELECT device_id
        FROM local_device
        WHERE id = 1
      ),
      'UNKNOWN'
    ),

    0
  )

  ON CONFLICT(
    entity_type,
    entity_id
  )

  DO UPDATE SET

    revision =
      sync_records.revision + 1,

    modified_at =
      excluded.modified_at,

    modified_by_device =
      excluded.modified_by_device,

    deleted = 0;

END;


CREATE TRIGGER IF NOT EXISTS
sync_department_update
AFTER UPDATE ON departments

BEGIN

  INSERT INTO sync_records (
    entity_type,
    entity_id,
    revision,
    modified_at,
    modified_by_device,
    deleted
  )

  VALUES (
    'DEPARTMENT',
    NEW.id,
    1,
    datetime('now'),

    COALESCE(
      (
        SELECT device_id
        FROM local_device
        WHERE id = 1
      ),
      'UNKNOWN'
    ),

    0
  )

  ON CONFLICT(
    entity_type,
    entity_id
  )

  DO UPDATE SET

    revision =
      sync_records.revision + 1,

    modified_at =
      excluded.modified_at,

    modified_by_device =
      excluded.modified_by_device,

    deleted = 0;

END;


/*
  PEOPLE
*/

CREATE TRIGGER IF NOT EXISTS
sync_person_insert
AFTER INSERT ON people

BEGIN

  INSERT INTO sync_records (
    entity_type,
    entity_id,
    revision,
    modified_at,
    modified_by_device,
    deleted
  )

  VALUES (
    'PERSON',
    NEW.id,
    1,
    datetime('now'),

    COALESCE(
      (
        SELECT device_id
        FROM local_device
        WHERE id = 1
      ),
      'UNKNOWN'
    ),

    0
  )

  ON CONFLICT(
    entity_type,
    entity_id
  )

  DO UPDATE SET

    revision =
      sync_records.revision + 1,

    modified_at =
      excluded.modified_at,

    modified_by_device =
      excluded.modified_by_device,

    deleted = 0;

END;


CREATE TRIGGER IF NOT EXISTS
sync_person_update
AFTER UPDATE ON people

BEGIN

  INSERT INTO sync_records (
    entity_type,
    entity_id,
    revision,
    modified_at,
    modified_by_device,
    deleted
  )

  VALUES (
    'PERSON',
    NEW.id,
    1,
    datetime('now'),

    COALESCE(
      (
        SELECT device_id
        FROM local_device
        WHERE id = 1
      ),
      'UNKNOWN'
    ),

    0
  )

  ON CONFLICT(
    entity_type,
    entity_id
  )

  DO UPDATE SET

    revision =
      sync_records.revision + 1,

    modified_at =
      excluded.modified_at,

    modified_by_device =
      excluded.modified_by_device,

    deleted = 0;

END;


/*
  TRANSACTIONS
*/

CREATE TRIGGER IF NOT EXISTS
sync_transaction_insert
AFTER INSERT ON transactions

BEGIN

  INSERT INTO sync_records (
    entity_type,
    entity_id,
    revision,
    modified_at,
    modified_by_device,
    deleted
  )

  VALUES (
    'TRANSACTION',
    NEW.id,
    1,

    NEW.timestamp,

    COALESCE(
      NEW.device_id,
      'UNKNOWN'
    ),

    0
  )

  ON CONFLICT(
    entity_type,
    entity_id
  )

  DO NOTHING;

END;


/*
  AUDITS
*/

CREATE TRIGGER IF NOT EXISTS
sync_audit_insert
AFTER INSERT ON audits

BEGIN

  INSERT INTO sync_records (
    entity_type,
    entity_id,
    revision,
    modified_at,
    modified_by_device,
    deleted
  )

  VALUES (
    'AUDIT',
    NEW.id,
    1,

    NEW.timestamp,

    COALESCE(
      NEW.device_id,
      'UNKNOWN'
    ),

    0
  )

  ON CONFLICT(
    entity_type,
    entity_id
  )

  DO NOTHING;

END;
`;
