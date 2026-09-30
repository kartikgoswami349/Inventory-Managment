import TcpSocket from 'react-native-tcp-socket';

import {
    clearPairingCode,
    createAuthProof,
    createSharedSecret,
    getTrustedDevice,
    markTrustedDeviceSynced,
    touchTrustedDevice,
    trustDevice,
    validatePairingCode,
    verifyAuthProof,
} from './pairingService';

import {
    applySyncPacketData,
    buildSyncPacketData,
    SyncImportResult,
    SyncPacket,
} from './syncPacketService';

import {
    getR58Device,
} from './deviceService';

const R58_SYNC_PORT = 45858;
let syncServer: any = null;

interface PairRequest {
  type: 'R58_PAIR_REQUEST';
  code: string;
  sourceDevice: {
    id: string;
    name: string;
  };
}

interface PairResponse {
  type: 'R58_PAIR_RESULT';
  success: boolean;
  receiverDevice?: {
    id: string;
    name: string;
  };
  sharedSecret?: string;
  message?: string;
}

interface SyncRequest {
  type: 'R58_SYNC';
  sourceDevice: {
    id: string;
    name: string;
  };
  packet: SyncPacket;
  auth?: {
    proof: string;
  };
}

interface SyncResponse {
  type: 'R58_SYNC_RESULT';
  success: boolean;
  receiverDevice?: {
    id: string;
    name: string;
  };
  remoteApplyResult?: SyncImportResult;
  receiverPacket?: SyncPacket;
  auth?: {
    proof: string;
  };
  message?: string;
}

export interface LanSyncResult {
  remoteDeviceId: string;
  remoteDeviceName: string;
  sent: {
    applied: number;
    skipped: number;
  };
  received: {
    applied: number;
    skipped: number;
    items: number;
    departments: number;
    people: number;
    transactions: number;
    audits: number;
  };
}

export async function startLanSyncServer() {
  if (syncServer) {
    return;
  }

  const Tcp: any = TcpSocket as any;

  if (!Tcp || typeof Tcp.createServer !== 'function') {
    throw new Error('TCP native module is unavailable.');
  }

  const server = Tcp.createServer((socket: any) => {
    let buffer = '';
    let processing = false;

    socket.on('data', async (data: any) => {
      buffer += data.toString();

      const newline = buffer.indexOf('\n');

      if (newline === -1 || processing) {
        return;
      }

      processing = true;

      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);

      try {
        const rawRequest = JSON.parse(line);

        // Pairing request
        if (rawRequest.type === 'R58_PAIR_REQUEST') {
          const pairRequest = rawRequest as PairRequest;

          const valid = await validatePairingCode(pairRequest.code);

          if (!valid) {
            const response: PairResponse = {
              type: 'R58_PAIR_RESULT',
              success: false,
              message: 'Incorrect or expired pairing code.',
            };

            socket.write(JSON.stringify(response) + '\n');
            return;
          }

          const localDevice = await getR58Device();

          if (pairRequest.sourceDevice.id === localDevice.id) {
            throw new Error('A device cannot pair with itself.');
          }

          const sharedSecret = createSharedSecret();

          await trustDevice(
            pairRequest.sourceDevice.id,
            pairRequest.sourceDevice.name,
            sharedSecret
          );

          await clearPairingCode();

          const response: PairResponse = {
            type: 'R58_PAIR_RESULT',
            success: true,
            receiverDevice: {
              id: localDevice.id,
              name: localDevice.name,
            },
            sharedSecret,
          };

          socket.write(JSON.stringify(response) + '\n');
          return;
        }

        // Normal sync request
        if (rawRequest.type !== 'R58_SYNC') {
          throw new Error('Invalid R58 sync request.');
        }

        const request = rawRequest as SyncRequest;
        const localDevice = await getR58Device();
        const isLoopback = request.sourceDevice.id === localDevice.id;

        // Authenticate before applying any data.
        if (!isLoopback) {
          const trusted = await getTrustedDevice(request.sourceDevice.id);

          if (!trusted) {
            throw new Error('This R58 device is not paired.');
          }

          if (!request.auth?.proof) {
            throw new Error('Missing sync authentication.');
          }

          const authenticated = await verifyAuthProof(
            request.sourceDevice.id,
            request.packet.packetId,
            'REQUEST',
            request.auth.proof
          );

          if (!authenticated) {
            throw new Error('R58 sync authentication failed.');
          }

          await touchTrustedDevice(request.sourceDevice.id);
        }
        if (!isLoopback) {
  await markTrustedDeviceSynced(
    request.sourceDevice.id
  );
}

        const remoteApplyResult = await applySyncPacketData(request.packet);
        const receiverPacket = await buildSyncPacketData();

        let responseProof: string | undefined;

        if (!isLoopback) {
          const trusted = await getTrustedDevice(request.sourceDevice.id);

          if (!trusted) {
            throw new Error('Trusted device information was lost during sync.');
          }

          responseProof = await createAuthProof(
            trusted.shared_secret,
            request.packet.packetId,
            'RESPONSE'
          );
        }

        const response: SyncResponse = {
          type: 'R58_SYNC_RESULT',
          success: true,
          receiverDevice: {
            id: localDevice.id,
            name: localDevice.name,
          },
          remoteApplyResult,
          receiverPacket,
          auth: responseProof ? { proof: responseProof } : undefined,
        };

        socket.write(JSON.stringify(response) + '\n');
      } catch (error) {
        const response: SyncResponse = {
          type: 'R58_SYNC_RESULT',
          success: false,
          message: error instanceof Error ? error.message : String(error),
        };

        socket.write(JSON.stringify(response) + '\n');
      } finally {
        processing = false;
      }
    });

    socket.on('error', (error: Error) => {
      console.error('R58 LAN CLIENT ERROR:', error);
    });
  });

  syncServer = server;

  server.on('error', (error: Error) => {
    console.error('R58 LAN SERVER ERROR:', error);
  });

  try {
    await new Promise<void>((resolve, reject) => {
      try {
        server.listen(
          {
            port: R58_SYNC_PORT,
            host: '0.0.0.0',
            reuseAddress: true,
          },
          () => {
            console.log(`R58 LAN server ready on ${R58_SYNC_PORT}`);
            resolve();
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    try {
      server.close();
    } catch {}

    syncServer = null;
    throw error;
  }
}

export async function pairWithDevice(
  host: string,
  code: string
) {
  await startLanSyncServer();

  const Tcp: any = TcpSocket as any;
  const localDevice = await getR58Device();

  const request: PairRequest = {
    type: 'R58_PAIR_REQUEST',
    code: code.trim(),
    sourceDevice: {
      id: localDevice.id,
      name: localDevice.name,
    },
  };

  return new Promise<{
    deviceId: string;
    deviceName: string;
  }>((resolve, reject) => {
    let client: any;
    let finished = false;

    const timeout = setTimeout(() => {
      fail(new Error('Pairing timed out.'));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);

      try {
        client?.destroy();
      } catch {}
    }

    function fail(error: Error) {
      if (finished) {
        return;
      }

      finished = true;
      cleanup();
      reject(error);
    }

    client = Tcp.createConnection(
      {
        host,
        port: R58_SYNC_PORT,
        reuseAddress: true,
      },
      () => {
        client.write(JSON.stringify(request) + '\n');
      }
    );

    let buffer = '';

    client.on('data', async (data: any) => {
      buffer += data.toString();

      const newline = buffer.indexOf('\n');

      if (newline === -1 || finished) {
        return;
      }

      try {
        const response: PairResponse = JSON.parse(
          buffer.slice(0, newline).trim()
        );

        if (response.type !== 'R58_PAIR_RESULT') {
          throw new Error('Invalid pairing response.');
        }

        if (!response.success) {
          throw new Error(response.message || 'Pairing failed.');
        }

        if (!response.receiverDevice || !response.sharedSecret) {
          throw new Error('Pairing response is incomplete.');
        }

        await trustDevice(
          response.receiverDevice.id,
          response.receiverDevice.name,
          response.sharedSecret
        );

        finished = true;
        cleanup();

        resolve({
          deviceId: response.receiverDevice.id,
          deviceName: response.receiverDevice.name,
        });
      } catch (error) {
        fail(
          error instanceof Error
            ? error
            : new Error(String(error))
        );
      }
    });

    client.on('error', (error: Error) => {
      fail(error);
    });
  });
}

export async function syncWithDevice(
  host: string,
  remoteDeviceId?: string
): Promise<LanSyncResult> {
  await startLanSyncServer();

  const Tcp: any = TcpSocket as any;
  const packet = await buildSyncPacketData();
  const localDevice = await getR58Device();

  let requestProof: string | undefined;

  if (remoteDeviceId && remoteDeviceId !== localDevice.id) {
    const trusted = await getTrustedDevice(remoteDeviceId);

    if (!trusted) {
      throw new Error('Pair this device before syncing.');
    }

    requestProof = await createAuthProof(
      trusted.shared_secret,
      packet.packetId,
      'REQUEST'
    );
  }

  const request: SyncRequest = {
    type: 'R58_SYNC',
    sourceDevice: {
      id: localDevice.id,
      name: localDevice.name,
    },
    packet,
    auth: requestProof ? { proof: requestProof } : undefined,
  };

  return new Promise((resolve, reject) => {
    let finished = false;
    let client: any;

    const timeout = setTimeout(() => {
      fail(new Error('R58 synchronization timed out.'));
    }, 30000);

    function cleanup() {
      clearTimeout(timeout);

      try {
        client?.destroy();
      } catch {}
    }

    function fail(error: Error) {
      if (finished) {
        return;
      }

      finished = true;
      cleanup();
      reject(error);
    }

    client = Tcp.createConnection(
      {
        host,
        port: R58_SYNC_PORT,
        reuseAddress: true,
      },
      () => {
        client.write(JSON.stringify(request) + '\n');
      }
    );

    let responseBuffer = '';

    client.on('data', async (data: any) => {
      responseBuffer += data.toString();

      const newline = responseBuffer.indexOf('\n');

      if (newline === -1 || finished) {
        return;
      }

      try {
        const response: SyncResponse = JSON.parse(
          responseBuffer.slice(0, newline).trim()
        );

        if (response.type !== 'R58_SYNC_RESULT') {
          throw new Error('Invalid R58 sync response.');
        }

        if (!response.success) {
          throw new Error(
            response.message ||
              'Remote synchronization failed.'
          );
        }

        if (
          !response.receiverDevice ||
          !response.receiverPacket ||
          !response.remoteApplyResult
        ) {
          throw new Error(
            'Remote R58 device returned incomplete data.'
          );
        }

        if (
          remoteDeviceId &&
          response.receiverDevice.id !== remoteDeviceId
        ) {
          throw new Error(
            'The responding R58 device does not match the selected device.'
          );
        }

        if (remoteDeviceId && remoteDeviceId !== localDevice.id) {
          if (!response.auth?.proof) {
            throw new Error(
              'Remote device did not authenticate its response.'
            );
          }

          const verified = await verifyAuthProof(
            remoteDeviceId,
            packet.packetId,
            'RESPONSE',
            response.auth.proof
          );

          if (!verified) {
            throw new Error(
              'Remote R58 device authentication failed.'
            );
          }

          await touchTrustedDevice(remoteDeviceId);
        }

        if (
  remoteDeviceId &&
  remoteDeviceId !==
    localDevice.id
) {
  await markTrustedDeviceSynced(
    remoteDeviceId
  );
}

        const localApplyResult = await applySyncPacketData(
          response.receiverPacket
        );

        finished = true;
        cleanup();

        resolve({
          remoteDeviceId: response.receiverDevice.id,
          remoteDeviceName: response.receiverDevice.name,
          sent: {
            applied: response.remoteApplyResult.applied,
            skipped: response.remoteApplyResult.skipped,
          },
          received: {
            applied: localApplyResult.applied,
            skipped: localApplyResult.skipped,
            items: localApplyResult.items,
            departments: localApplyResult.departments,
            people: localApplyResult.people,
            transactions: localApplyResult.transactions,
            audits: localApplyResult.audits,
          },
        });
      } catch (error) {
        fail(
          error instanceof Error
            ? error
            : new Error(String(error))
        );
      }
    });

    client.on('error', (error: Error) => {
      fail(error);
    });
  });
}

export function stopLanSyncServer() {
  try {
    syncServer?.close();
  } catch {}

  syncServer = null;
}