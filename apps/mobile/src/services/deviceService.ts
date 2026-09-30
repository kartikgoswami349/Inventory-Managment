import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import Storage from 'expo-sqlite/kv-store';
import {
    getDatabase,
} from '../database/database';

const DEVICE_ID_KEY =
  'r58_device_id';

const DEVICE_NAME_KEY =
  'r58_device_name';

export interface R58Device {
  id: string;
  name: string;
}


export async function getDeviceId():
  Promise<string> {

  let id =
    await Storage.getItem(
      DEVICE_ID_KEY
    );

  if (!id) {
    id =
      Crypto.randomUUID();

    await Storage.setItem(
      DEVICE_ID_KEY,
      id
    );
  }

  await mirrorDeviceIdToDatabase(
    id
  );

  return id;
}

export async function getDeviceName():
  Promise<string> {

  let savedName =
    await Storage.getItem(
      DEVICE_NAME_KEY
    );

  if (savedName) {
    return savedName;
  }

  const detected =
    Device.deviceName ||
    Device.modelName ||
    'R58 Device';

  await Storage.setItem(
    DEVICE_NAME_KEY,
    detected
  );

  return detected;
}

export async function setDeviceName(
  name: string
) {
  const clean =
    name.trim();

  if (!clean) {
    throw new Error(
      'Device name cannot be empty.'
    );
  }

  await Storage.setItem(
    DEVICE_NAME_KEY,
    clean
  );
}

export async function getR58Device():
  Promise<R58Device> {

  const [
    id,
    name,
  ] = await Promise.all([
    getDeviceId(),
    getDeviceName(),
  ]);

  return {
    id,
    name,
  };
}
async function mirrorDeviceIdToDatabase(
  deviceId: string
) {
  const db =
    await getDatabase();

  await db.runAsync(
    `
    INSERT INTO local_device (
      id,
      device_id
    )

    VALUES (
      1,
      ?
    )

    ON CONFLICT(id)

    DO UPDATE SET

      device_id =
        excluded.device_id
    `,
    deviceId
  );
}