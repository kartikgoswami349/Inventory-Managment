import {
    useCallback,
    useEffect,
    useState,
} from 'react';


import {
    NearbyR58Device,
    startNearbyDiscovery,
    stopNearbyScan,
    subscribeNearbyDevices,
} from '../services/nearbyDeviceService';

import {
    createPairingCode,
    getActivePairingCode,
    getTrustedDevices,
    removeTrustedDevice,
    TrustedDevice,
} from '../services/pairingService';

import {
    pairWithDevice,
} from '../services/lanSyncService';


import {
    runLanSelfTest,
} from '../services/lanTransportService';
import {
    exportSyncPacket,
    importSyncPacket,
} from '../services/syncPacketService';

import {
    syncWithDevice,
} from '../services/lanSyncService';

import {
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import {
    router,
    useFocusEffect,
} from 'expo-router';

import {
    getR58Device,
    setDeviceName,
} from '../services/deviceService';

import {
    bootstrapSyncIndex,
    getSyncStats,
    SyncStats,
} from '../repositories/syncRepository';
const SHOW_SYNC_DIAGNOSTICS =
  false;

const EMPTY_STATS: SyncStats = {
  items: 0,
  departments: 0,
  people: 0,
  transactions: 0,
  audits: 0,
  total: 0,
};

export default function DeviceSyncScreen() {
  const [
    deviceId,
    setDeviceId,
  ] = useState('');

  const [
  nearbyDevices,
  setNearbyDevices,
] = useState<NearbyR58Device[]>([]);
const [
  activePairingCode,
  setActivePairingCode,
] = useState<string | null>(null);

const [
  pairingExpiresAt,
  setPairingExpiresAt,
] = useState<string | null>(null);

const [
  trustedDevices,
  setTrustedDevices,
] = useState<TrustedDevice[]>([]);

const [
  pairingInputs,
  setPairingInputs,
] = useState<
  Record<string, string>
>({});



const [
  discovering,
  setDiscovering,
] = useState(false);

useEffect(() => {
  const unsubscribe =
    subscribeNearbyDevices(
      devices => {
        setNearbyDevices(devices);
      }
    );

  return () => {
    unsubscribe();
    stopNearbyScan();
  };
}, []);

async function handleFindDevices() {
  try {
    setDiscovering(true);

    await startNearbyDiscovery();

    setTimeout(() => {
      setDiscovering(false);
    }, 6000);

  } catch (error) {
    setDiscovering(false);

    console.error(
      'DEVICE DISCOVERY ERROR:',
      error
    );

    Alert.alert(
      'Discovery Failed',
      String(error)
    );
  }
}

async function loadPairingData() {
  try {
    const active =
      await getActivePairingCode();

    if (active) {
      setActivePairingCode(
        active.code
      );

      setPairingExpiresAt(
        active.expiresAt
      );
    } else {
      setActivePairingCode(
        null
      );

      setPairingExpiresAt(
        null
      );
    }

    const trusted =
      await getTrustedDevices();

    setTrustedDevices(
      trusted
    );

  } catch (error) {
    console.error(
      'PAIRING LOAD ERROR:',
      error
    );
  }
}

useEffect(() => {
  loadPairingData();
}, []);

async function handleGeneratePairingCode() {
  try {
    const result =
      await createPairingCode();

    setActivePairingCode(
      result.code
    );

    setPairingExpiresAt(
      result.expiresAt
    );

  } catch (error) {
    Alert.alert(
      'Pairing Error',
      String(error)
    );
  }
}

async function handlePairDevice(
  device: NearbyR58Device
) {
  try {
    const code =
      pairingInputs[
        device.deviceId
      ]?.trim();

    if (!code) {
      Alert.alert(
        'Pairing Code Required',
        'Enter the 6-digit code shown on the other R58 phone.'
      );

      return;
    }

    if (code.length !== 6) {
      Alert.alert(
        'Invalid Code',
        'The pairing code must contain 6 digits.'
      );

      return;
    }

    const result =
      await pairWithDevice(
        device.address,
        code
      );

    await loadPairingData();

    setPairingInputs(
      current => ({
        ...current,

        [device.deviceId]:
          '',
      })
    );

    Alert.alert(
      'Device Paired',
      `${result.deviceName} is now trusted.`
    );

  } catch (error) {
    console.error(
      'PAIRING ERROR:',
      error
    );

    Alert.alert(
      'Pairing Failed',
      error instanceof Error
        ? error.message
        : String(error)
    );
  }
}

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return 'Never';
  }

  return new Date(
    value
  ).toLocaleString();
}

function handleForgetDevice(
  deviceId: string,
  deviceName: string
) {
  Alert.alert(
    'Forget Device',
    `Remove ${deviceName} from trusted R58 devices?`,

    [
      {
        text:
          'Cancel',

        style:
          'cancel',
      },

      {
        text:
          'Forget',

        style:
          'destructive',

        onPress:
          async () => {
            await removeTrustedDevice(
              deviceId
            );

            await loadPairingData();
          },
      },
    ]
  );
}


async function handleSyncNearbyDevice(
  device: NearbyR58Device
) {
  try {
    setPacketWorking(true);

    const result =
      await syncWithDevice(
        device.address,
        device.deviceId
      );

    await loadScreen();

    Alert.alert(
      'Sync Complete',
      `Connected to:
${result.remoteDeviceName}

Sent:
Applied: ${result.sent.applied}
Skipped: ${result.sent.skipped}

Received:
Applied: ${result.received.applied}
Skipped: ${result.received.skipped}

Items: ${result.received.items}
Departments: ${result.received.departments}
People: ${result.received.people}
Transactions: ${result.received.transactions}
Audits: ${result.received.audits}`
    );

  } catch (error) {
    console.error(
      'NEARBY SYNC ERROR:',
      error
    );

    Alert.alert(
      'Sync Failed',
      String(error)
    );

  } finally {
    setPacketWorking(false);
  }
}

  const [
  packetWorking,
  setPacketWorking,
] = useState(false);
async function handleExportPacket() {
  try {
    setPacketWorking(true);

    const result =
      await exportSyncPacket();

    Alert.alert(
      'Sync Packet Ready',
      `${result.counts.total} records exported.

Items: ${result.counts.items}
Departments: ${result.counts.departments}
People: ${result.counts.people}
Transactions: ${result.counts.transactions}
Audits: ${result.counts.audits}

File:
${result.fileName}`
    );
  } catch (error) {
    Alert.alert(
      'Export Failed',
      String(error)
    );
  } finally {
    setPacketWorking(false);
  }
}



async function handleImportPacket() {
  try {
    setPacketWorking(true);

    const result =
      await importSyncPacket();

    if (!result) {
      return;
    }

    await loadScreen();

    Alert.alert(
      'Sync Packet Processed',
      `Source:
${result.sourceDeviceName}

Applied: ${result.applied}
Already present / skipped: ${result.skipped}

Items added/updated: ${result.items}
Departments added/updated: ${result.departments}
People added/updated: ${result.people}
Transactions added: ${result.transactions}
Audits added: ${result.audits}`
    );
  } catch (error) {
    console.error(
      'PACKET IMPORT ERROR:',
      error
    );

    Alert.alert(
      'Import Failed',
      String(error)
    );
  } finally {
    setPacketWorking(false);
  }
}

  const [
    deviceName,
    setDeviceNameState,
  ] = useState('');
  const [
  lanTesting,
  setLanTesting,
] = useState(false);

const [
  lanStatus,
  setLanStatus,
] = useState(
  'Not tested'
);
async function handleLoopbackSync() {
  try {
    setPacketWorking(true);

    const result =
      await syncWithDevice(
        '127.0.0.1'
      );

    await loadScreen();

    Alert.alert(
      'Real LAN Sync Working',
      `Connected to:
${result.remoteDeviceName}

Sent to remote:
Applied: ${result.sent.applied}
Skipped: ${result.sent.skipped}

Received back:
Applied: ${result.received.applied}
Skipped: ${result.received.skipped}

Items: ${result.received.items}
Departments: ${result.received.departments}
People: ${result.received.people}
Transactions: ${result.received.transactions}
Audits: ${result.received.audits}`
    );

  } catch (error) {
    console.error(
      'REAL LAN SYNC ERROR:',
      error
    );

    Alert.alert(
      'LAN Sync Failed',
      String(error)
    );

  } finally {
    setPacketWorking(false);
  }
}

async function handleLanSelfTest() {
  try {
    setLanTesting(true);

    setLanStatus(
      'Testing...'
    );

    const result =
      await runLanSelfTest();

    setLanStatus(
      `Ready • ${result.roundTripMs} ms`
    );

    Alert.alert(
      'LAN Transport Working',
      `TCP server and client are working correctly.

Port:
${result.port}

Round trip:
${result.roundTripMs} ms

This phone is ready for R58 LAN synchronization.`
    );
  } catch (error) {
    console.error(
      'LAN SELF TEST ERROR:',
      error
    );

    setLanStatus(
      'Test failed'
    );

    Alert.alert(
      'LAN Test Failed',
      String(error)
    );
  } finally {
    setLanTesting(false);
  }
}

  const [
    editingName,
    setEditingName,
  ] = useState('');

  const [
    stats,
    setStats,
  ] = useState<SyncStats>(
    EMPTY_STATS
  );

  const [
    preparing,
    setPreparing,
  ] = useState(false);

  async function loadScreen() {
    try {
      const device =
        await getR58Device();

      setDeviceId(
        device.id
      );

      setDeviceNameState(
        device.name
      );

      setEditingName(
        device.name
      );

      const syncStats =
        await getSyncStats();

      setStats(
        syncStats
      );
    } catch (error) {
      console.error(
        'SYNC SCREEN ERROR:',
        error
      );
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [])
  );

  async function saveName() {
    try {
      await setDeviceName(
        editingName
      );

      await loadScreen();

      Alert.alert(
        'Saved',
        'Device name updated.'
      );
    } catch (error) {
      Alert.alert(
        'Error',
        String(error)
      );
    }
  }

  async function prepareSync() {
    try {
      setPreparing(true);

      const result =
        await bootstrapSyncIndex();

      setStats(result);

      Alert.alert(
        'Sync Ready',
        `${result.total} records are prepared for synchronization.

Items: ${result.items}
Departments: ${result.departments}
People: ${result.people}
Transactions: ${result.transactions}
Audits: ${result.audits}`
      );
    } catch (error) {
      console.error(
        'SYNC PREPARE ERROR:',
        error
      );

      Alert.alert(
        'Sync Preparation Failed',
        String(error)
      );
    } finally {
      setPreparing(false);
    }
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={loadScreen}
          />
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={styles.back}
          >
            ‹ Back
          </Text>
        </Pressable>

        <Text style={styles.label}>
          R58 SYNC
        </Text>

        <Text style={styles.title}>
          Device & Sync
        </Text>

        <Text
          style={styles.subtitle}
        >
          Prepare this device for
          multi-phone inventory
          synchronization.
        </Text>

        {/* DEVICE */}

        <View style={styles.card}>
          <Text
            style={styles.smallLabel}
          >
            DEVICE NAME
          </Text>

          <TextInput
            value={editingName}
            onChangeText={
              setEditingName
            }
            style={styles.input}
          />

          <Pressable
            onPress={saveName}
            style={
              styles.saveButton
            }
          >
            <Text
              style={
                styles.saveText
              }
            >
              Save Name
            </Text>
          </Pressable>
        </View>

        {/* DEVICE ID */}

        <View style={styles.card}>
          <Text
            style={styles.smallLabel}
          >
            DEVICE ID
          </Text>

          <Text
            selectable
            style={styles.deviceId}
          >
            {deviceId ||
              'Loading...'}
          </Text>

          <Text style={styles.help}>
            Unique identity for this
            installation. Other phones
            will receive their own IDs.
          </Text>
        </View>

        {/* SYNC READINESS */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Sync Readiness
        </Text>

        <View
          style={styles.readinessCard}
        >
          <SyncRow
            label="Items"
            value={stats.items}
          />

          <Divider />

          <SyncRow
            label="Departments"
            value={
              stats.departments
            }
          />

          <Divider />

          <SyncRow
            label="People"
            value={stats.people}
          />

          <Divider />

          <SyncRow
            label="Transactions"
            value={
              stats.transactions
            }
          />

          <Divider />

          <SyncRow
            label="Audits"
            value={stats.audits}
          />

          <View
            style={
              styles.totalSection
            }
          >
            <Text
              style={
                styles.totalLabel
              }
            >
              Records Ready
            </Text>

            <Text
              style={
                styles.totalValue
              }
            >
              {stats.total}
            </Text>
          </View>
        </View>

        <Pressable
          disabled={preparing}
          onPress={prepareSync}
          style={({ pressed }) => [
            styles.prepareButton,

            (
              pressed ||
              preparing
            ) &&
              styles.pressed,
          ]}
        >
          <Text
            style={
              styles.prepareText
            }
          >
            {preparing
              ? 'Preparing...'
              : 'Prepare / Refresh Sync'}
          </Text>
        </Pressable>

        {/* CONNECTION */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Network
        </Text>

        <View
          style={styles.statusCard}
        >
          <View>
            <Text
              style={
                styles.statusTitle
              }
            >
              Sync Status
            </Text>

            <Text
              style={
                styles.statusText
              }
            >
              Not connected
            </Text>
          </View>

          <View
            style={
              styles.offlineDot
            }
          />
        </View>

        <View style={styles.card}>

          <Text style={styles.sectionTitle}>
  Pair New Device
</Text>


<View style={styles.card}>
  <Text style={styles.statusTitle}>
    Pairing Code
  </Text>

  <Text style={styles.help}>
    Generate this code on one phone,
    then enter it on the other R58 phone.
  </Text>

  

  {activePairingCode ? (
    <>
      <Text
        style={styles.pairingCode}
      >
        {activePairingCode}
      </Text>

      <Text style={styles.help}>
        Valid until:{' '}
        {pairingExpiresAt
          ? new Date(
              pairingExpiresAt
            ).toLocaleTimeString()
          : '-'}
      </Text>

      <Pressable
        onPress={
          handleGeneratePairingCode
        }
        style={
          styles.secondaryButton
        }
      >
        <Text
          style={
            styles.secondaryButtonText
          }
        >
          Generate New Code
        </Text>
      </Pressable>
    </>
  ) : (
    <Pressable
      onPress={
        handleGeneratePairingCode
      }
      style={
        styles.prepareButton
      }
    >
      <Text
        style={
          styles.prepareText
        }
      >
        Generate Pairing Code
      </Text>
    </Pressable>
  )}
</View>

{nearbyDevices.map(
  device => {

    const trusted =
      trustedDevices.some(
        item =>
          item.device_id ===
          device.deviceId
      );

    return (
      <View
        key={device.deviceId}
        style={
          styles.nearbyDeviceCard
        }
      >
        <View style={{ flex: 1 }}>
          <Text
            style={
              styles.statusTitle
            }
          >
            {device.deviceName}
          </Text>

          <Text
            style={
              styles.help
            }
          >
            {device.address}
            {' • '}
            Port {device.port}
          </Text>

          <Text
            style={
              trusted
                ? styles.trustedText
                : styles.notTrustedText
            }
          >
            {trusted
              ? '✓ Trusted Device'
              : 'Not Paired'}
          </Text>

          {!trusted && (
            <>
              <TextInput
                value={
                  pairingInputs[
                    device.deviceId
                  ] || ''
                }

                onChangeText={
                  value => {
                    setPairingInputs(
                      current => ({
                        ...current,

                        [device.deviceId]:
                          value.replace(
                            /\D/g,
                            ''
                          ),
                      })
                    );
                  }
                }

                maxLength={6}

                keyboardType="number-pad"

                placeholder="6-digit code"

                style={
                  styles.pairInput
                }
              />

              <Pressable
                onPress={() =>
                  handlePairDevice(
                    device
                  )
                }
                style={
                  styles.pairButton
                }
              >
                <Text
                  style={
                    styles.pairButtonText
                  }
                >
                  Pair Device
                </Text>
              </Pressable>
            </>
          )}

          {trusted && (
            <View
              style={
                styles.deviceActions
              }
            >
              <Pressable
                disabled={
                  packetWorking
                }

                onPress={() =>
                  handleSyncNearbyDevice(
                    device
                  )
                }

                style={
                  styles.syncNowButton
                }
              >
                <Text
                  style={
                    styles.syncNowText
                  }
                >
                  Sync Now
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  handleForgetDevice(
                    device.deviceId,
                    device.deviceName
                  )
                }

                style={
                  styles.forgetButton
                }
              >
                <Text
                  style={
                    styles.forgetButtonText
                  }
                >
                  Forget
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  }
)}


          <Text style={styles.sectionTitle}>
  Nearby R58 Devices
</Text>

<View style={styles.card}>
  <Pressable
    disabled={discovering}
    onPress={handleFindDevices}
    style={({ pressed }) => [
      styles.prepareButton,

      (
        pressed ||
        discovering
      ) &&
        styles.pressed,
    ]}
  >
    <Text style={styles.prepareText}>
      {discovering
        ? 'Searching...'
        : 'Find Nearby Devices'}
    </Text>
  </Pressable>

  {nearbyDevices.length === 0 ? (
    <Text style={styles.help}>
      {discovering
        ? 'Searching the local Wi-Fi network...'
        : 'No other R58 devices found.'}
    </Text>
  ) : (
    nearbyDevices.map(
      device => (
        <View
          key={device.deviceId}
          style={styles.nearbyDeviceCard}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={styles.statusTitle}
            >
              {device.deviceName}
            </Text>

            <Text style={styles.help}>
              {device.address}
              {' • '}
              Port {device.port}
            </Text>
          </View>

          <Pressable
            disabled={packetWorking}
            onPress={() =>
              handleSyncNearbyDevice(
                device
              )
            }
            style={styles.syncNowButton}
          >
            <Text
              style={styles.syncNowText}
            >
              Sync
            </Text>
          </Pressable>
        </View>
      )
    )
  )}
</View>
<Text style={styles.sectionTitle}>
  Trusted Devices
</Text>

<View style={styles.card}>
  {trustedDevices.length === 0 ? (
    <Text style={styles.help}>
      No trusted R58 devices yet.
    </Text>
  ) : (
    trustedDevices.map(
      device => {

        const nearby =
          nearbyDevices.find(
            item =>
              item.deviceId ===
              device.device_id
          );

        return (
          <View
            key={device.device_id}
            style={
              styles.trustedDeviceCard
            }
          >
            <View style={{ flex: 1 }}>

              <Text
                style={
                  styles.statusTitle
                }
              >
                {device.device_name}
              </Text>

              <Text
                style={
                  styles.trustedText
                }
              >
                ✓ Trusted
              </Text>

              <Text style={styles.help}>
                Status:{' '}
                {nearby
                  ? 'Online'
                  : 'Offline'}
              </Text>

              <Text style={styles.help}>
                Last sync:{' '}
                {formatDateTime(
                  device.last_sync_at
                )}
              </Text>

              <Text style={styles.help}>
                Last seen:{' '}
                {formatDateTime(
                  device.last_seen_at
                )}
              </Text>


              <View
                style={
                  styles.deviceActions
                }
              >

                {nearby && (
                  <Pressable
                    disabled={
                      packetWorking
                    }

                    onPress={() =>
                      handleSyncNearbyDevice(
                        nearby
                      )
                    }

                    style={
                      styles.syncNowButton
                    }
                  >
                    <Text
                      style={
                        styles.syncNowText
                      }
                    >
                      Sync Now
                    </Text>
                  </Pressable>
                )}


                <Pressable
                  onPress={() =>
                    handleForgetDevice(
                      device.device_id,
                      device.device_name
                    )
                  }

                  style={
                    styles.forgetButton
                  }
                >
                  <Text
                    style={
                      styles.forgetButtonText
                    }
                  >
                    Forget
                  </Text>
                </Pressable>

              </View>
            </View>
          </View>
        );
      }
    )
  )}
</View>
          <Text
            style={styles.smallLabel}
          >
            LAST SYNC
          </Text>

          <Text
            style={styles.value}
          >
            Never
          </Text>


        </View>

        
        <Text style={styles.sectionTitle}>
  Sync Packet Test
</Text>

<View style={styles.card}>
  <Text style={styles.packetTitle}>
    Offline Sync Test
  </Text>
  

  <Text style={styles.help}>
    Export your synchronization
    records to a packet file.
    Importing the same packet again
    must not create duplicate stock,
    transactions or audits.
  </Text>

  <Pressable
    disabled={packetWorking}
    onPress={handleExportPacket}
    style={({ pressed }) => [
      styles.prepareButton,

      (
        pressed ||
        packetWorking
      ) &&
        styles.pressed,
    ]}
  >
    <Text style={styles.prepareText}>
      Export Sync Packet
    </Text>
  </Pressable>

  <Pressable
    disabled={packetWorking}
    onPress={handleImportPacket}
    style={({ pressed }) => [
      styles.importButton,

      (
        pressed ||
        packetWorking
      ) &&
        styles.pressed,
    ]}
  >
    <Text style={styles.importText}>
      Import Sync Packet
    </Text>
  </Pressable>
</View>
<Text style={styles.sectionTitle}>
  LAN Transport
</Text>

<View style={styles.card}>
  <Text style={styles.smallLabel}>
    TCP CONNECTION
  </Text>

  <Text style={styles.value}>
    {lanStatus}
  </Text>

  <Text style={styles.help}>
    Tests the native network server
    and client on this phone before
    connecting other R58 devices.
  </Text>

  <Pressable
    disabled={lanTesting}
    onPress={handleLanSelfTest}
    style={({ pressed }) => [
      styles.prepareButton,

      (
        pressed ||
        lanTesting
      ) &&
        styles.pressed,
    ]}
  >
    <Text style={styles.prepareText}>
      {lanTesting
        ? 'Testing LAN...'
        : 'Run LAN Self-Test'}
    </Text>
  </Pressable>
</View>
<Pressable
  disabled={packetWorking}
  onPress={handleLoopbackSync}
  style={({ pressed }) => [
    styles.prepareButton,

    (
      pressed ||
      packetWorking
    ) &&
      styles.pressed,
  ]}
>
  <Text style={styles.prepareText}>
    Test Real Sync Packet
  </Text>
</Pressable>

        <Text style={styles.footer}>
          R58 multi-device preparation
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}


function SyncRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View style={styles.syncRow}>
      <Text
        style={styles.syncLabel}
      >
        {label}
      </Text>

      <View
        style={
          styles.syncRight
        }
      >
        <Text
          style={
            styles.syncValue
          }
        >
          {value}
        </Text>

        <Text
          style={
            styles.checkMark
          }
        >
          ✓
        </Text>
      </View>
    </View>
  );
}

function Divider() {
  return (
    <View
      style={styles.divider}
    />
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: '#F5F7F6',
    },

    container: {
      flex: 1,
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 45,
    },

    back: {
      color: '#166534',
      fontWeight: '700',
      fontSize: 16,
      marginBottom: 20,
    },

    label: {
      color: '#166534',
      fontWeight: '900',
      fontSize: 11,
      letterSpacing: 1.3,
    },

    title: {
      color: '#111827',
      fontWeight: '900',
      fontSize: 30,
      marginTop: 4,
    },

    subtitle: {
      color: '#64748B',
      marginTop: 5,
      marginBottom: 22,
      lineHeight: 20,
    },

    sectionTitle: {
      color: '#111827',
      fontWeight: '800',
      fontSize: 16,
      marginTop: 12,
      marginBottom: 10,
    },

    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      padding: 17,
      marginBottom: 13,
    },

    smallLabel: {
      color: '#64748B',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
    },

    input: {
      backgroundColor: '#F8FAFC',
      borderWidth: 1,
      borderColor: '#E2E8F0',
      borderRadius: 12,
      paddingHorizontal: 13,
      minHeight: 48,
      marginTop: 8,
      color: '#111827',
      fontSize: 15,
    },

    saveButton: {
      backgroundColor: '#166534',
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: 10,
    },

    saveText: {
      color: '#FFFFFF',
      fontWeight: '800',
    },

    deviceId: {
      color: '#111827',
      fontSize: 13,
      fontWeight: '700',
      marginTop: 8,
    },

    help: {
      color: '#94A3B8',
      fontSize: 11,
      lineHeight: 17,
      marginTop: 7,
    },

    readinessCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      overflow: 'hidden',
    },

    syncRow: {
      minHeight: 53,
      paddingHorizontal: 17,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    syncLabel: {
      color: '#475569',
      fontSize: 14,
      fontWeight: '600',
    },

    syncRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    syncValue: {
      color: '#111827',
      fontSize: 16,
      fontWeight: '900',
    },

    checkMark: {
      color: '#16A34A',
      fontSize: 16,
      fontWeight: '900',
    },

    divider: {
      height: 1,
      backgroundColor: '#F1F5F9',
      marginHorizontal: 17,
    },

    totalSection: {
      backgroundColor: '#ECFDF5',
      paddingHorizontal: 17,
      paddingVertical: 15,
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    totalLabel: {
      color: '#166534',
      fontWeight: '800',
    },

    totalValue: {
      color: '#14532D',
      fontSize: 22,
      fontWeight: '900',
    },

    prepareButton: {
      backgroundColor: '#166534',
      borderRadius: 15,
      paddingVertical: 17,
      alignItems: 'center',
      marginTop: 12,
      marginBottom: 12,
    },

    prepareText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },

    statusCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      padding: 17,
      marginBottom: 13,
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
    },

    statusTitle: {
      color: '#111827',
      fontWeight: '800',
      fontSize: 15,
    },

    statusText: {
      color: '#94A3B8',
      fontSize: 12,
      marginTop: 3,
    },

    offlineDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#94A3B8',
    },

    value: {
      color: '#111827',
      fontSize: 19,
      fontWeight: '800',
      marginTop: 5,
    },

    footer: {
      color: '#94A3B8',
      textAlign: 'center',
      fontSize: 10,
      marginTop: 8,
    },

    pressed: {
      opacity: 0.65,
    },
    packetTitle: {
  color: '#111827',
  fontSize: 16,
  fontWeight: '800',
},

importButton: {
  borderWidth: 1,
  borderColor: '#166534',
  borderRadius: 15,
  paddingVertical: 16,
  alignItems: 'center',
  marginTop: 10,
},

importText: {
  color: '#166534',
  fontSize: 15,
  fontWeight: '800',
},
nearbyDeviceCard: {
  flexDirection: 'row',
  alignItems: 'center',

  borderTopWidth: 1,
  borderTopColor: '#E2E8F0',

  paddingTop: 14,
  marginTop: 14,
},

syncNowButton: {
  backgroundColor: '#166534',
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 11,
  marginLeft: 10,
},

syncNowText: {
  color: '#FFFFFF',
  fontSize: 12,
  fontWeight: '800',
},

pairingCode: {
  fontSize: 34,
  fontWeight: '900',
  letterSpacing: 8,
  textAlign: 'center',
  marginVertical: 18,
},

pairInput: {
  borderWidth: 1,
  borderColor: '#CBD5E1',
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 11,
  marginTop: 12,
  fontSize: 18,
  letterSpacing: 4,
},

pairButton: {
  marginTop: 10,
  backgroundColor: '#1D4ED8',
  paddingVertical: 11,
  paddingHorizontal: 16,
  borderRadius: 10,
  alignItems: 'center',
},

pairButtonText: {
  color: '#FFFFFF',
  fontWeight: '800',
},

trustedText: {
  marginTop: 6,
  color: '#15803D',
  fontWeight: '700',
},

notTrustedText: {
  marginTop: 6,
  color: '#B45309',
  fontWeight: '700',
},

deviceActions: {
  flexDirection: 'row',
  marginTop: 12,
  gap: 8,
},

forgetButton: {
  backgroundColor: '#FEE2E2',
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderRadius: 10,
},

forgetButtonText: {
  color: '#B91C1C',
  fontWeight: '800',
},

secondaryButton: {
  marginTop: 14,
  borderWidth: 1,
  borderColor: '#CBD5E1',
  paddingVertical: 11,
  borderRadius: 10,
  alignItems: 'center',
},

secondaryButtonText: {
  fontWeight: '700',
},
    
trustedDeviceCard: {
  borderTopWidth: 1,
  borderTopColor: '#E2E8F0',
  paddingVertical: 14,
},
  });