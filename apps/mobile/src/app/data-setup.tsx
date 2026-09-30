import { useState } from 'react';

import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  importRealInventory,
  removeTestInventoryData,
} from '../services/inventoryImportService';

export default function DataSetupScreen() {
  const [working, setWorking] = useState(false);
  const [summary, setSummary] = useState('');

  async function handleImport() {
    try {
      setWorking(true);

      const result = await importRealInventory();

      const message =
        `Source rows: ${result.totalRows}\n` +
        `Items imported: ${result.importedItems}\n` +
        `Already existing/skipped: ${result.skippedItems}\n` +
        `Opening transactions created: ${result.openingTransactions}`;

      setSummary(message);

      Alert.alert(
        'Inventory Import Complete',
        message
      );
    } catch (error) {
      console.error('INVENTORY IMPORT ERROR:', error);

      Alert.alert(
        'Import Error',
        String(error)
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleRemoveTestData() {
    Alert.alert(
      'Remove TEST-001?',
      'This deletes TEST-001 and all of its test transactions/audits. Your real R58 items are not affected.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setWorking(true);

              const removed =
                await removeTestInventoryData();

              Alert.alert(
                removed ? 'Removed' : 'Nothing to Remove',
                removed
                  ? 'TEST-001 and its test records were deleted.'
                  : 'TEST-001 was not found.'
              );
            } catch (error) {
              Alert.alert(
                'Error',
                String(error)
              );
            } finally {
              setWorking(false);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        R58 INVENTORY
      </Text>

      <Text style={styles.title}>
        Real Data Setup
      </Text>

      <Text style={styles.description}>
        Imports the 244 items from your approved inventory seed.
        Stock IDs are R58-S-0001 through R58-S-0244.
        Blank quantities and the invalid "f" quantity are imported as zero.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Import Rules
        </Text>

        <Text style={styles.rule}>
          • 244 inventory items
        </Text>

        <Text style={styles.rule}>
          • QR value = Stock ID
        </Text>

        <Text style={styles.rule}>
          • Minimum stock starts at 0
        </Text>

        <Text style={styles.rule}>
          • Opening transaction only when opening quantity is greater than 0
        </Text>

        <Text style={styles.rule}>
          • Existing Stock IDs are skipped, preventing duplicate imports
        </Text>
      </View>

      <Pressable
        disabled={working}
        onPress={handleImport}
        style={[
          styles.primaryButton,
          working && styles.disabled,
        ]}
      >
        <Text style={styles.primaryText}>
          {working
            ? 'Working...'
            : 'Import 244 R58 Items'}
        </Text>
      </Pressable>

      <Pressable
        disabled={working}
        onPress={handleRemoveTestData}
        style={[
          styles.secondaryButton,
          working && styles.disabled,
        ]}
      >
        <Text style={styles.secondaryText}>
          Remove TEST-001 Test Data
        </Text>
      </Pressable>

      {!!summary && (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>
            Last Import
          </Text>

          <Text style={styles.summaryText}>
            {summary}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
    padding: 22,
    paddingTop: 60,
  },

  label: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '800',
  },

  title: {
    color: '#0F172A',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 5,
  },

  description: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 22,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 22,
  },

  cardTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },

  rule: {
    color: '#475569',
    lineHeight: 22,
  },

  primaryButton: {
    backgroundColor: '#166534',
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: 'center',
  },

  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 12,
  },

  secondaryText: {
    color: '#B91C1C',
    fontWeight: '700',
  },

  disabled: {
    opacity: 0.5,
  },

  summary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 17,
    marginTop: 22,
  },

  summaryTitle: {
    fontWeight: '800',
    marginBottom: 8,
  },

  summaryText: {
    color: '#475569',
    lineHeight: 22,
  },
});
