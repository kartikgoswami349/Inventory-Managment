import * as Crypto from 'expo-crypto';

import { getDatabase } from '../database/database';

export interface Department {
  id: string;
  name: string;
  active: number;
}

export interface Person {
  id: string;
  department_id: string | null;
  name: string;
  active: number;
}

export async function getDepartments() {
  const db = await getDatabase();

  return await db.getAllAsync<Department>(`
    SELECT
      id,
      name,
      active
    FROM departments
    WHERE active = 1
    ORDER BY name COLLATE NOCASE ASC
  `);
}

export async function getPeopleByDepartment(
  departmentId: string
) {
  const db = await getDatabase();

  return await db.getAllAsync<Person>(
    `
    SELECT
      id,
      department_id,
      name,
      active
    FROM people
    WHERE department_id = ?
      AND active = 1
    ORDER BY name COLLATE NOCASE ASC
    `,
    departmentId
  );
}

export async function addDepartment(
  name: string
) {
  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error(
      'Department name is required.'
    );
  }

  const db = await getDatabase();

  const existing =
    await db.getFirstAsync<Department>(
      `
      SELECT *
      FROM departments
      WHERE LOWER(name) = LOWER(?)
      `,
      cleanName
    );

  if (existing) {
    throw new Error(
      'This department already exists.'
    );
  }

  const id =
    Crypto.randomUUID();

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

export async function addPerson(
  departmentId: string,
  name: string
) {
  const cleanName =
    name.trim();

  if (!departmentId) {
    throw new Error(
      'Please select a department.'
    );
  }

  if (!cleanName) {
    throw new Error(
      'Person name is required.'
    );
  }

  const db =
    await getDatabase();

  const existing =
    await db.getFirstAsync<Person>(
      `
      SELECT *
      FROM people
      WHERE department_id = ?
        AND LOWER(name) = LOWER(?)
      `,
      departmentId,
      cleanName
    );

  if (existing) {
    throw new Error(
      'This person already exists in this department.'
    );
  }

  const id =
    Crypto.randomUUID();

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

export async function renameDepartment(
  id: string,
  newName: string
) {
  const cleanName =
    newName.trim();

  if (!cleanName) {
    throw new Error(
      'Department name cannot be empty.'
    );
  }

  const db =
    await getDatabase();

  await db.runAsync(
    `
    UPDATE departments
    SET name = ?
    WHERE id = ?
    `,
    cleanName,
    id
  );
}

export async function renamePerson(
  id: string,
  newName: string
) {
  const cleanName =
    newName.trim();

  if (!cleanName) {
    throw new Error(
      'Person name cannot be empty.'
    );
  }

  const db =
    await getDatabase();

  await db.runAsync(
    `
    UPDATE people
    SET name = ?
    WHERE id = ?
    `,
    cleanName,
    id
  );
}

export async function deactivateDepartment(
  id: string
) {
  const db = await getDatabase();

  await db.withTransactionAsync(
    async () => {
      // Hide all people belonging
      // to this department.
      await db.runAsync(
        `
        UPDATE people
        SET active = 0
        WHERE department_id = ?
        `,
        id
      );

      // Hide the department itself.
      await db.runAsync(
        `
        UPDATE departments
        SET active = 0
        WHERE id = ?
        `,
        id
      );
    }
  );
}

export async function deactivatePerson(
  id: string
) {
  const db =
    await getDatabase();

  await db.runAsync(
    `
    UPDATE people
    SET active = 0
    WHERE id = ?
    `,
    id
  );
}