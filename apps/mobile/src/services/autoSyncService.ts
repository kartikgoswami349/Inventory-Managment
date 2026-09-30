import {
    AppState,
} from 'react-native';

import {
    getR58Device,
} from './deviceService';

import {
    getTrustedDevices,
} from './pairingService';

import {
    NearbyR58Device,
    refreshNearbyDiscovery,
    startNearbyDiscovery,
    stopNearbyScan,
    subscribeNearbyDevices,
} from './nearbyDeviceService';

import {
    syncWithDevice,
} from './lanSyncService';


/*
  Normal safety sync every 30 seconds.
*/

const AUTO_SYNC_INTERVAL_MS =
  30 * 1000;


/*
  Prevent unnecessary repeated
  background syncs with the same phone.
*/

const DEVICE_COOLDOWN_MS =
  20 * 1000;


let started =
  false;

let autoSyncRunning =
  false;

let nearbyDevices:
  NearbyR58Device[] =
  [];


let intervalTimer:
  ReturnType<typeof setInterval> |
  null =
  null;


let pendingTimer:
  ReturnType<typeof setTimeout> |
  null =
  null;


let unsubscribeNearby:
  (() => void) |
  null =
  null;


let appStateSubscription:
  {
    remove: () => void;
  } |
  null =
  null;


/*
  If true, the next sync was requested
  because inventory actually changed.

  This bypasses the normal 20-second
  cooldown and leader check.
*/

let pendingForceSync =
  false;


const lastAttempt =
  new Map<
    string,
    number
  >();


function queueAutoSync(
  delayMs = 1800,
  force = false
) {

  if (!started) {
    return;
  }


  /*
    An immediate sync has priority over
    an already scheduled normal sync.
  */

  if (force) {

    pendingForceSync =
      true;


    if (pendingTimer) {

      clearTimeout(
        pendingTimer
      );

      pendingTimer =
        null;
    }

  } else {

    /*
      Don't keep postponing an already
      scheduled sync.
    */

    if (pendingTimer) {
      return;
    }
  }


  pendingTimer =
    setTimeout(
      () => {

        pendingTimer =
          null;


        const forceThisRun =
          pendingForceSync;


        pendingForceSync =
          false;


        runAutoSync(
          forceThisRun
        )
          .catch(
            error => {

              console.warn(
                'R58 AUTO SYNC ERROR:',
                error
              );
            }
          );

      },

      delayMs
    );
}


/*
  For normal periodic synchronization,
  only one phone should initiate.

  This reduces unnecessary simultaneous
  sync attempts.
*/

async function
  shouldThisPhoneLead(
    peers:
      NearbyR58Device[]
  ) {

  const localDevice =
    await getR58Device();


  const ids = [
    localDevice.id,

    ...peers.map(
      device =>
        device.deviceId
    ),
  ];


  ids.sort(
    (
      a,
      b
    ) =>
      a.localeCompare(b)
  );


  return (
    ids[0] ===
    localDevice.id
  );
}


async function runAutoSync(
  force = false
) {

  if (
    !started ||
    AppState.currentState !==
      'active'
  ) {
    return;
  }


  /*
    Never allow this phone to start
    two outgoing auto-sync cycles
    simultaneously.
  */

  if (autoSyncRunning) {

    /*
      If this was caused by an actual
      stock change, retry shortly
      instead of losing the request.
    */

    if (force) {

      queueAutoSync(
        1000,
        true
      );
    }


    return;
  }


  const trusted =
    await getTrustedDevices();


  if (
    trusted.length === 0
  ) {
    return;
  }


  const trustedIds =
    new Set(
      trusted.map(
        device =>
          device.device_id
      )
    );


  const peers =
    nearbyDevices.filter(
      device =>
        trustedIds.has(
          device.deviceId
        )
    );


  if (
    peers.length === 0
  ) {

    /*
      No device currently known.

      Discovery will continue and the
      normal 30-second cycle remains.
    */

    return;
  }


  /*
    Normal background sync:
    use leader system.

    Immediate stock-change sync:
    originating phone may initiate
    directly.
  */

  if (!force) {

    const leader =
      await shouldThisPhoneLead(
        peers
      );


    if (!leader) {
      return;
    }
  }


  autoSyncRunning =
    true;


  try {

    /*
      Always sync devices one at a time.
    */

    const orderedPeers =
      [...peers].sort(
        (
          a,
          b
        ) =>
          a.deviceId
            .localeCompare(
              b.deviceId
            )
      );


    for (
      const device
      of orderedPeers
    ) {

      const now =
        Date.now();


      const previousAttempt =
        lastAttempt.get(
          device.deviceId
        ) ?? 0;


      /*
        Forced sync means inventory
        just changed, so don't wait for
        the normal cooldown.
      */

      if (
        !force &&
        now -
          previousAttempt <
          DEVICE_COOLDOWN_MS
      ) {
        continue;
      }


      lastAttempt.set(
        device.deviceId,
        now
      );


      try {

        console.log(
          force
            ? 'R58 IMMEDIATE SYNC →'
            : 'R58 AUTO SYNC →',
          device.deviceName
        );


        const result =
          await syncWithDevice(
            device.address,
            device.deviceId
          );


        console.log(
          force
            ? 'R58 IMMEDIATE SYNC COMPLETE:'
            : 'R58 AUTO SYNC COMPLETE:',
          device.deviceName,
          result
        );


      } catch (error) {

        /*
          A networking failure must NEVER
          affect the locally saved
          transaction.

          The 30-second sync remains as
          a fallback.
        */

        console.warn(
          'R58 AUTO SYNC PEER FAILED:',
          device.deviceName,
          error
        );
      }
    }

  } finally {

    autoSyncRunning =
      false;
  }
}


/*
  Call this after a successful
  Issue / Receive / Audit.

  If nearby devices are already known,
  sync almost immediately.

  Otherwise restart discovery and allow
  the normal sync cycle to catch it.
*/

export function
  requestImmediateSync() {

  if (
    !started ||
    AppState.currentState !==
      'active'
  ) {
    return;
  }


  /*
    In normal use the peer will already
    be discovered, so this begins in
    about 250 ms.
  */

  if (
    nearbyDevices.length >
    0
  ) {

    queueAutoSync(
      250,
      true
    );

    return;
  }


  /*
    If discovery currently has no peer,
    refresh it.

    Do not block the inventory operation.
  */

  try {

    refreshNearbyDiscovery();

  } catch (error) {

    console.warn(
      'R58 IMMEDIATE DISCOVERY ERROR:',
      error
    );
  }


  /*
    Give mDNS some time to rediscover
    the other phone.
  */

  queueAutoSync(
    1500,
    true
  );
}


export async function
  startAutoSync() {

  if (started) {
    return;
  }


  started =
    true;


  try {

    unsubscribeNearby =
      subscribeNearbyDevices(
        devices => {

          nearbyDevices =
            devices;


          /*
            Newly discovered devices may
            be synchronized without
            waiting 30 seconds.
          */

          queueAutoSync(
            1800
          );
        }
      );


    await startNearbyDiscovery();


    queueAutoSync(
      2500
    );


    intervalTimer =
      setInterval(
        () => {

          if (
            AppState.currentState !==
              'active'
          ) {
            return;
          }


          try {

            refreshNearbyDiscovery();

          } catch (error) {

            console.warn(
              'R58 DISCOVERY REFRESH ERROR:',
              error
            );
          }


          queueAutoSync(
            2500
          );

        },

        AUTO_SYNC_INTERVAL_MS
      );


    appStateSubscription =
      AppState.addEventListener(
        'change',

        state => {

          if (
            state ===
            'active'
          ) {

            startNearbyDiscovery()
              .then(
                () => {

                  queueAutoSync(
                    2500
                  );
                }
              )
              .catch(
                error => {

                  console.warn(
                    'R58 AUTO DISCOVERY START ERROR:',
                    error
                  );
                }
              );

          } else {

            try {

              stopNearbyScan();

            } catch {}
          }
        }
      );


    console.log(
      'R58 automatic sync started.'
    );


  } catch (error) {

    started =
      false;

    throw error;
  }
}


export function
  stopAutoSync() {

  started =
    false;

  autoSyncRunning =
    false;

  pendingForceSync =
    false;


  if (
    intervalTimer
  ) {

    clearInterval(
      intervalTimer
    );

    intervalTimer =
      null;
  }


  if (
    pendingTimer
  ) {

    clearTimeout(
      pendingTimer
    );

    pendingTimer =
      null;
  }


  if (
    unsubscribeNearby
  ) {

    unsubscribeNearby();

    unsubscribeNearby =
      null;
  }


  if (
    appStateSubscription
  ) {

    appStateSubscription
      .remove();

    appStateSubscription =
      null;
  }


  try {

    stopNearbyScan();

  } catch {}


  nearbyDevices =
    [];


  console.log(
    'R58 automatic sync stopped.'
  );
}