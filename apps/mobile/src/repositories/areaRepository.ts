import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database/database';

export interface Area {
  id: string;
  name: string;
  active: number;
}

const AREA_REQUIRED_KEY = 'area_required';

export async function getAreas(): Promise<Area[]> {
  const db = await getDatabase();
  return db.getAllAsync<Area>(`
    SELECT id, name, active
    FROM areas
    WHERE active = 1
    ORDER BY name COLLATE NOCASE
  `);
}

export async function addArea(name: string) {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Area name is required.');
  const db = await getDatabase();
  const existing = await db.getFirstAsync<Area>(
    `SELECT id, name, active FROM areas WHERE LOWER(name) = LOWER(?)`,
    cleanName
  );
  if (existing) {
    if (!existing.active) {
      await db.runAsync('UPDATE areas SET active = 1 WHERE id = ?', existing.id);
      return existing.id;
    }
    throw new Error('This area already exists.');
  }
  const id = Crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO areas (id, name, active) VALUES (?, ?, 1)`,
    id,
    cleanName
  );
  return id;
}

export async function deactivateArea(id: string) {
  if (!id.trim()) throw new Error('Select an area to deactivate.');
  const db = await getDatabase();
  await db.runAsync('UPDATE areas SET active = 0 WHERE id = ?', id);
}

export async function isAreaRequired(): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    AREA_REQUIRED_KEY
  );
  return row?.value === '1';
}

export async function setAreaRequired(required: boolean) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    AREA_REQUIRED_KEY,
    required ? '1' : '0'
  );
}
