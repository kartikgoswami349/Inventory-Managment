import Zeroconf from 'react-native-zeroconf';

import {
    getR58Device,
} from './deviceService';

import {
    startLanSyncServer,
} from './lanSyncService';


const SERVICE_TYPE =
  'r58inventory';

const SERVICE_PROTOCOL =
  'tcp';

const SERVICE_DOMAIN =
  'local.';

const SERVICE_PORT =
  45858;

const IMPLEMENTATION =
  'DNSSD';


export interface NearbyR58Device {
  deviceId: string;
  deviceName: string;

  serviceName: string;

  address: string;

  port: number;

  lastSeenAt: string;
}


const zeroconf: any =
  new Zeroconf();


const devices =
  new Map<
    string,
    NearbyR58Device
  >();


const subscribers =
  new Set<
    (
      devices:
        NearbyR58Device[]
    ) => void
  >();


let listenersReady =
  false;

let scanning =
  false;

let published =
  false;

let localDeviceId =
  '';

let publishedServiceName =
  '';


function emitDevices() {

  const list =
    Array.from(
      devices.values()
    ).sort(
      (
        a,
        b
      ) =>
        a.deviceName
          .localeCompare(
            b.deviceName
          )
    );


  for (
    const subscriber
    of subscribers
  ) {
    subscriber(list);
  }
}


function txtValue(
  value: any
): string {

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }


  return String(value);
}


function chooseAddress(
  addresses: any
): string | null {

  if (
    !Array.isArray(addresses)
  ) {
    return null;
  }


  /*
    Prefer IPv4 LAN address.
  */

  const ipv4Candidates =
    addresses
      .map((address: any) => String(address).trim().replace(/^::ffff:/i, ''))
      .filter((value: string) => {
        const parts = value.split('.').map(Number);
        return parts.length === 4 &&
          parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255) &&
          value !== '127.0.0.1' &&
          !value.startsWith('169.254.') &&
          !(parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
      });

  const ipv4 =
    ipv4Candidates.find(
      (
        address: any
      ) => {
        const value = String(address);
        return value.startsWith('10.') ||
          value.startsWith('192.168.') ||
          (value.startsWith('172.') &&
            Number(value.split('.')[1]) >= 16 &&
            Number(value.split('.')[1]) <= 31);
      }
    ) ?? ipv4Candidates[0];


  if (ipv4) {
    return String(ipv4);
  }


  /*
    Fallback if only IPv6 exists.
  */

  return null;
}


function setupListeners() {

  if (listenersReady) {
    return;
  }


  listenersReady = true;


  zeroconf.on(
    'resolved',
    (
      service: any
    ) => {

      try {

        const deviceId =
          txtValue(
            service?.txt
              ?.deviceId
          );


        const deviceName =
          txtValue(
            service?.txt
              ?.deviceName
          ) ||
          service?.name ||
          'R58 Device';


        /*
          Ignore ourselves.
        */

        if (
          !deviceId ||
          deviceId ===
            localDeviceId
        ) {
          return;
        }


        const address =
          chooseAddress(
            service.addresses
          );


        if (!address) {
          return;
        }


        devices.set(
          deviceId,
          {
            deviceId,

            deviceName,

            serviceName:
              service.name,

            address,

            port:
              Number(
                service.port ||
                SERVICE_PORT
              ),

            lastSeenAt:
              new Date()
                .toISOString(),
          }
        );


        emitDevices();

      } catch (error) {

        console.error(
          'R58 DISCOVERY RESOLVE ERROR:',
          error
        );
      }
    }
  );


  zeroconf.on(
    'remove',
    (
      serviceName: string
    ) => {

      for (
        const [
          id,
          device
        ]
        of devices.entries()
      ) {

        if (
          device.serviceName ===
          serviceName
        ) {
          devices.delete(id);
        }
      }


      emitDevices();
    }
  );


  zeroconf.on(
    'error',
    (
      error: any
    ) => {

      console.error(
        'R58 ZEROCONF ERROR:',
        error
      );
    }
  );
}


export function subscribeNearbyDevices(
  callback:
    (
      devices:
        NearbyR58Device[]
    ) => void
) {

  subscribers.add(
    callback
  );


  callback(
    Array.from(
      devices.values()
    )
  );


  return () => {
    subscribers.delete(
      callback
    );
  };
}



export async function startNearbyDiscovery() {
  setupListeners();

  /**
    Actual TCP sync server must already
    be listening before advertising it.
  */
  await startLanSyncServer();

  const device =
    await getR58Device();

  localDeviceId =
    device.id;

  /**
    Unique mDNS service name.
  */
  const safeName =
    device.name
      .replace(
        /[^a-zA-Z0-9-_ ]/g,
        ''
      )
      .trim()
      .slice(
        0,
        30
      ) ||
    'R58';

  publishedServiceName =
    `R58-${safeName}-${device.id.slice(
      0,
      6
    )}`;

  if (!published) {
    try {
      zeroconf.publishService(
        SERVICE_TYPE,
        SERVICE_PROTOCOL,
        SERVICE_DOMAIN,
        publishedServiceName,
        SERVICE_PORT,
        {
          deviceId:
            device.id,
          deviceName:
            device.name,
          protocol:
            '1',
        },
        IMPLEMENTATION
      );

      published = true;
    } catch (error) {
      console.error(
        'R58 PUBLISH ERROR:',
        error
      );
    }
  }

  /**
    Restart scanning.
  */
  if (scanning) {
    try {
      zeroconf.stop(
        IMPLEMENTATION
      );
    } catch {}
    scanning = false;
  }

  devices.clear();
  emitDevices();

  zeroconf.scan(
    SERVICE_TYPE,
    SERVICE_PROTOCOL,
    SERVICE_DOMAIN,
    IMPLEMENTATION
  );

  scanning = true;
}


export function refreshNearbyDiscovery() {

  if (scanning) {

    try {
      zeroconf.stop(
        IMPLEMENTATION
      );
    } catch {}
    scanning = false;
  }


  devices.clear();

  emitDevices();


  zeroconf.scan(
    SERVICE_TYPE,
    SERVICE_PROTOCOL,
    SERVICE_DOMAIN,
    IMPLEMENTATION
  );


  scanning = true;
}


export function stopNearbyScan() {

  if (scanning) {
    try {
      zeroconf.stop(
        IMPLEMENTATION
      );
    } catch {}
  }
  scanning = false;
  devices.clear();
  emitDevices();
}