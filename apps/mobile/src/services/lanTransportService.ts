import * as Crypto from 'expo-crypto';

import TcpSocket from 'react-native-tcp-socket';

import {
    getDeviceId,
} from './deviceService';

const R58_SELF_TEST_PORT = 45859;

export interface LanSelfTestResult {
  port: number;
  roundTripMs: number;
  deviceId: string;
}

export async function runLanSelfTest():
  Promise<LanSelfTestResult> {

  const tcp: any =
    TcpSocket as any;

  /*
    Diagnose native module availability
    before attempting to create sockets.
  */

  if (
    !tcp ||
    typeof tcp.createServer !==
      'function'
  ) {
    throw new Error(
      'TCP native module is loaded incorrectly: createServer() is unavailable. Rebuild the R58 development APK after installing react-native-tcp-socket.'
    );
  }

  if (
    typeof tcp.createConnection !==
    'function'
  ) {
    throw new Error(
      'TCP native module is loaded incorrectly: createConnection() is unavailable. Rebuild the development APK.'
    );
  }

  const deviceId =
    await getDeviceId();

  const requestId =
    Crypto.randomUUID();

  const startedAt =
    Date.now();

  return new Promise(
    (
      resolve,
      reject
    ) => {

      let server: any = null;
      let client: any = null;

      let finished = false;

      const timer =
        setTimeout(
          () => {
            fail(
              new Error(
                'LAN self-test timed out after 8 seconds.'
              )
            );
          },
          8000
        );

      function cleanup() {
        clearTimeout(timer);

        try {
          if (
            client &&
            typeof client.destroy ===
              'function'
          ) {
            client.destroy();
          }
        } catch {}

        try {
          if (
            server &&
            typeof server.close ===
              'function'
          ) {
            server.close();
          }
        } catch {}
      }

      function fail(
        error: Error
      ) {
        if (finished) {
          return;
        }

        finished = true;

        cleanup();

        reject(error);
      }

      function succeed() {
        if (finished) {
          return;
        }

        finished = true;

        const elapsed =
          Date.now() -
          startedAt;

        cleanup();

        resolve({
          port:
            R58_SELF_TEST_PORT,

          roundTripMs:
            elapsed,

          deviceId,
        });
      }

      try {
        server =
          tcp.createServer(
            (
              socket: any
            ) => {

              if (
                !socket ||
                typeof socket.on !==
                  'function'
              ) {
                fail(
                  new Error(
                    'TCP server created an invalid client socket.'
                  )
                );

                return;
              }

              let buffer = '';

              socket.on(
                'data',
                (
                  data: any
                ) => {

                  buffer +=
                    data.toString();

                  if (
                    !buffer.includes(
                      '\n'
                    )
                  ) {
                    return;
                  }

                  const line =
                    buffer
                      .split('\n')[0]
                      .trim();

                  try {
                    const message =
                      JSON.parse(
                        line
                      );

                    if (
                      message.type ===
                        'PING' &&
                      message.requestId ===
                        requestId
                    ) {

                      if (
                        typeof socket.write !==
                        'function'
                      ) {
                        fail(
                          new Error(
                            'TCP socket.write() is unavailable.'
                          )
                        );

                        return;
                      }

                      socket.write(
                        JSON.stringify({
                          type:
                            'PONG',

                          requestId,

                          deviceId,
                        }) +
                          '\n'
                      );
                    }
                  } catch {
                    fail(
                      new Error(
                        'TCP server received invalid data.'
                      )
                    );
                  }
                }
              );

              socket.on(
                'error',
                (
                  error: Error
                ) => {
                  fail(error);
                }
              );
            }
          );
      } catch (error) {
        fail(
          new Error(
            `createServer failed: ${String(
              error
            )}`
          )
        );

        return;
      }

      if (
        !server ||
        typeof server.listen !==
          'function'
      ) {
        fail(
          new Error(
            'TCP server.listen() is unavailable. Native module integration is incomplete.'
          )
        );

        return;
      }

      if (
        typeof server.on ===
        'function'
      ) {
        server.on(
          'error',
          (
            error: Error
          ) => {
            fail(error);
          }
        );
      }

      server.listen(
        {
          port:
            R58_SELF_TEST_PORT,

          host:
            '127.0.0.1',

          reuseAddress:
            true,
        },

        () => {
          try {
            client =
              tcp.createConnection(
                {
                  port:
                    R58_SELF_TEST_PORT,

                  host:
                    '127.0.0.1',

                  localAddress:
                    '127.0.0.1',

                  reuseAddress:
                    true,
                },

                () => {

                  if (
                    !client ||
                    typeof client.write !==
                      'function'
                  ) {
                    fail(
                      new Error(
                        'TCP client.write() is unavailable.'
                      )
                    );

                    return;
                  }

                  client.write(
                    JSON.stringify({
                      type:
                        'PING',

                      requestId,

                      deviceId,
                    }) +
                      '\n'
                  );
                }
              );
          } catch (error) {
            fail(
              new Error(
                `createConnection failed: ${String(
                  error
                )}`
              )
            );

            return;
          }

          if (
            !client ||
            typeof client.on !==
              'function'
          ) {
            fail(
              new Error(
                'TCP client socket is invalid.'
              )
            );

            return;
          }

          let response =
            '';

          client.on(
            'data',
            (
              data: any
            ) => {

              response +=
                data.toString();

              if (
                !response.includes(
                  '\n'
                )
              ) {
                return;
              }

              try {
                const message =
                  JSON.parse(
                    response
                      .split('\n')[0]
                      .trim()
                  );

                if (
                  message.type ===
                    'PONG' &&
                  message.requestId ===
                    requestId
                ) {
                  succeed();
                }
              } catch {
                fail(
                  new Error(
                    'TCP client received an invalid response.'
                  )
                );
              }
            }
          );

          client.on(
            'error',
            (
              error: Error
            ) => {
              fail(error);
            }
          );
        }
      );
    }
  );
}