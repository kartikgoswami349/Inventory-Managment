import {
  useEffect,
  useState,
} from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  router,
} from 'expo-router';

import {
  createDatabaseBackup,
  getBackupMetadata,
  inspectBackup,
  pickBackupFile,
  restoreDatabaseBackup,
} from '../services/backupService';

export default function BackupRestoreScreen() {
  const [working, setWorking] =
    useState(false);

  const [
    lastBackup,
    setLastBackup,
  ] = useState<string | null>(
    null
  );

  const [
    lastRestore,
    setLastRestore,
  ] = useState<string | null>(
    null
  );

  useEffect(() => {
    loadMetadata();
  }, []);

  async function loadMetadata() {
    const metadata =
      await getBackupMetadata();

    setLastBackup(
      metadata.lastBackup
    );

    setLastRestore(
      metadata.lastRestore
    );
  }

  function formatDate(
    value: string | null
  ) {
    if (!value) {
      return 'Never';
    }

    return new Date(
      value
    ).toLocaleString();
  }

  async function handleBackup() {
    try {
      setWorking(true);

      const backup =
        await createDatabaseBackup();

      await loadMetadata();

      Alert.alert(
        'Backup Created',
        `Your complete R58 database was backed up successfully.\n\n${backup.fileName}\n\nUse the share window to save another copy to Files, Drive, WhatsApp, etc.`
      );
    } catch (error) {
      console.error(
        'BACKUP ERROR:',
        error
      );

      Alert.alert(
        'Backup Failed',
        String(error)
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleRestore() {
    try {
      const selected =
        await pickBackupFile();

      if (!selected) {
        return;
      }

      setWorking(true);

      const counts =
        await inspectBackup(
          selected.uri
        );

      setWorking(false);

      Alert.alert(
        'Restore This Backup?',
        `${selected.name}

Backup contains:

${counts.items} items
${counts.transactions} transactions
${counts.audits} audits
${counts.departments} departments
${counts.people} people

Your CURRENT database will be replaced.

Before restoring, R58 will automatically create a recovery backup of your current database.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },

          {
            text: 'Restore',
            style: 'destructive',

            onPress: async () => {
              try {
                setWorking(true);

                const result =
                  await restoreDatabaseBackup(
                    selected.uri
                  );

                await loadMetadata();

                Alert.alert(
                  'Restore Complete',
                  `Database restored successfully.

Items: ${result.counts.items}
Transactions: ${result.counts.transactions}
Audits: ${result.counts.audits}

A recovery copy of your old database was also created:

${result.recoveryFileName}`,
                  [
                    {
                      text:
                        'View Inventory',

                      onPress: () =>
                        router.replace(
                          '/inventory'
                        ),
                    },

                    {
                      text: 'OK',
                    },
                  ]
                );
              } catch (error) {
                console.error(
                  'RESTORE ERROR:',
                  error
                );

                Alert.alert(
                  'Restore Failed',
                  String(error)
                );
              } finally {
                setWorking(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      setWorking(false);

      Alert.alert(
        'Invalid Backup',
        String(error)
      );
    }
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
        >
          <Text style={styles.back}>
            ‹ Back
          </Text>
        </Pressable>

        <Text style={styles.label}>
          R58 DATA SAFETY
        </Text>

        <Text style={styles.title}>
          Backup & Restore
        </Text>

        <Text
          style={styles.subtitle}
        >
          Protect your inventory,
          transaction and audit data.
        </Text>

        <View
          style={
            styles.securityCard
          }
        >
          <Text
            style={
              styles.securityIcon
            }
          >
            ✓
          </Text>

          <View style={{ flex: 1 }}>
            <Text
              style={
                styles.securityTitle
              }
            >
              Complete Database
            </Text>

            <Text
              style={
                styles.securityText
              }
            >
              Items, stock
              transactions, audits,
              departments and people
              are included.
            </Text>
          </View>
        </View>

        <Text
          style={styles.sectionTitle}
        >
          Database Backup
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Last Backup
          </Text>

          <Text style={styles.dateText}>
            {formatDate(
              lastBackup
            )}
          </Text>

          <Pressable
            disabled={working}
            onPress={handleBackup}
            style={({ pressed }) => [
              styles.primaryButton,

              (
                pressed ||
                working
              ) &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.primaryText
              }
            >
              {working
                ? 'Please wait...'
                : 'Create Backup'}
            </Text>
          </Pressable>

          <Text style={styles.help}>
            A local copy is kept by
            R58. You can also save a
            second copy to Google
            Drive, Files, another
            phone, or computer.
          </Text>
        </View>

        <Text
          style={styles.sectionTitle}
        >
          Restore
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Last Restore
          </Text>

          <Text style={styles.dateText}>
            {formatDate(
              lastRestore
            )}
          </Text>

          <Pressable
            disabled={working}
            onPress={handleRestore}
            style={({ pressed }) => [
              styles.restoreButton,

              (
                pressed ||
                working
              ) &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.restoreText
              }
            >
              Select Backup File
            </Text>
          </Pressable>

          <Text
            style={styles.warning}
          >
            Restoring replaces the
            current inventory database.
            R58 automatically creates
            a recovery copy first.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>
            Recommended
          </Text>

          <Text style={styles.tipText}>
            Make a backup whenever
            you complete a major
            stock update or audit.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: '#F5F7F6',
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 15,
      paddingBottom: 40,
    },

    back: {
      color: '#166534',
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 22,
    },

    label: {
      color: '#166534',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.4,
    },

    title: {
      color: '#111827',
      fontSize: 30,
      fontWeight: '900',
      marginTop: 4,
    },

    subtitle: {
      color: '#64748B',
      fontSize: 14,
      marginTop: 5,
      marginBottom: 22,
    },

    securityCard: {
      backgroundColor: '#ECFDF5',
      borderRadius: 18,
      padding: 17,
      flexDirection: 'row',
      alignItems: 'center',
    },

    securityIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: '#166534',
      color: '#FFFFFF',
      textAlign: 'center',
      lineHeight: 42,
      fontSize: 20,
      fontWeight: '900',
      marginRight: 13,
    },

    securityTitle: {
      color: '#14532D',
      fontWeight: '800',
      fontSize: 15,
    },

    securityText: {
      color: '#4D7C5C',
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    },

    sectionTitle: {
      color: '#111827',
      fontWeight: '800',
      fontSize: 16,
      marginTop: 25,
      marginBottom: 10,
    },

    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 18,
      padding: 18,
      elevation: 2,
    },

    cardTitle: {
      color: '#64748B',
      fontSize: 12,
      fontWeight: '700',
    },

    dateText: {
      color: '#111827',
      fontSize: 17,
      fontWeight: '800',
      marginTop: 4,
      marginBottom: 18,
    },

    primaryButton: {
      backgroundColor: '#166534',
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
    },

    primaryText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },

    restoreButton: {
      borderColor: '#DC2626',
      borderWidth: 1,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },

    restoreText: {
      color: '#B91C1C',
      fontWeight: '800',
      fontSize: 15,
    },

    help: {
      color: '#94A3B8',
      fontSize: 11,
      lineHeight: 17,
      marginTop: 12,
    },

    warning: {
      color: '#B45309',
      fontSize: 11,
      lineHeight: 17,
      marginTop: 12,
    },

    tipBox: {
      backgroundColor: '#FFFFFF',
      borderRadius: 15,
      padding: 15,
      marginTop: 20,
    },

    tipTitle: {
      color: '#111827',
      fontWeight: '800',
    },

    tipText: {
      color: '#64748B',
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4,
    },

    pressed: {
      opacity: 0.6,
    },
  });