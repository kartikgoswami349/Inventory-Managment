import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database/database';

export interface Department {
  id: string;
  name: string;
}

export interface Person {
  id: string;
  department_id: string;
  name: string;
}

export async function getDepartments(): Promise<Department[]> {
  const db = await getDatabase();

  return db.getAllAsync<Department>(`
    SELECT id, name
    FROM departments
    WHERE active = 1
    ORDER BY name COLLATE NOCASE
  `);
}

export async function addDepartment(name: string) {
  const db = await getDatabase();

  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error('Department name is required.');
  }

  const existing = await db.getFirstAsync<Department>(
    `SELECT id, name FROM departments WHERE name = ?`,
    cleanName
  );

  if (existing) {
    return existing.id;
  }

  const id = Crypto.randomUUID();

  await db.runAsync(
    `
    INSERT INTO departments (
      id,
      name,
      active
    )
    VALUES (?, ?, 1)
    `,
    id,
    cleanName
  );

  return id;
}

export async function getPeopleByDepartment(
  departmentId: string
): Promise<Person[]> {
  const db = await getDatabase();

  return db.getAllAsync<Person>(
    `
    SELECT
      id,
      department_id,
      name
    FROM people
    WHERE department_id = ?
      AND active = 1
    ORDER BY name COLLATE NOCASE
    `,
    departmentId
  );
}

export async function addPerson(
  departmentId: string,
  name: string
) {
  const db = await getDatabase();

  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error('Person name is required.');
  }

  const id = Crypto.randomUUID();

  await db.runAsync(
    `
    INSERT INTO people (
      id,
      department_id,
      name,
      active
    )
    VALUES (?, ?, ?, 1)
    `,
    id,
    departmentId,
    cleanName
  );

  return id;
}
