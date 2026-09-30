import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { createItem } from '../repositories/itemRepository';
import { createTransaction } from '../repositories/transactionRepository';
import { getCurrentStock } from '../services/stockService';

export default function HomeScreen() {
  const [itemId, setItemId] = useState<string | null>(null);
  const [stock, setStock] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);

  function addLog(message: string) {
    setLogs((old) => [message, ...old]);
  }

  async function refreshStock(id: string) {
    const value = await getCurrentStock(id);
    setStock(value);
    return value;
  }

  async function handleCreateItem() {
    try {
      const id = await createItem(
        'TEST-001',
        'PVC Test Item',
        'Pcs',
        10,
        'TEST'
      );

      setItemId(id);

      const current = await refreshStock(id);

      addLog(`Test item ready. Current stock: ${current}`);
    } catch (error) {
      Alert.alert('Error', String(error));
    }
  }

  async function handleOpening() {
    if (!itemId) {
      Alert.alert('Create test item first');
      return;
    }

    try {
      await createTransaction(
        itemId,
        'OPENING',
        100,
        'PHONE-A'
      );

      const current = await refreshStock(itemId);

      addLog(`Opening +100 → Stock ${current}`);
    } catch (error) {
      Alert.alert('Error', String(error));
    }
  }

  async function handleIssue() {
    if (!itemId) {
      Alert.alert('Create test item first');
      return;
    }

    try {
      await createTransaction(
        itemId,
        'ISSUED',
        20,
        'PHONE-A'
      );

      const current = await refreshStock(itemId);

      addLog(`Issued -20 → Stock ${current}`);
    } catch (error) {
      Alert.alert('Transaction Error', String(error));
    }
  }

  async function handleReceive() {
    if (!itemId) {
      Alert.alert('Create test item first');
      return;
    }

    try {
      await createTransaction(
        itemId,
        'RECEIVED',
        10,
        'PHONE-A'
      );

      const current = await refreshStock(itemId);

      addLog(`Received +10 → Stock ${current}`);
    } catch (error) {
      Alert.alert('Error', String(error));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.logo}>R58</Text>

      <Text style={styles.title}>
        Inventory
      </Text>

      <Text style={styles.subtitle}>
        SQLite Engine Test
      </Text>

      <View style={styles.stockCard}>
        <Text style={styles.stockLabel}>
          LIVE STOCK
        </Text>

        <Text style={styles.stockNumber}>
          {stock}
        </Text>

        <Text style={styles.unit}>
          Pcs
        </Text>
      </View>

      <ActionButton
        text="1. Create Test Item"
        onPress={handleCreateItem}
      />

      <ActionButton
        text="2. Opening +100"
        onPress={handleOpening}
      />

      <ActionButton
        text="3. Issue -20"
        onPress={handleIssue}
      />

      <ActionButton
        text="4. Receive +10"
        onPress={handleReceive}
      />

      <Text style={styles.historyTitle}>
        Test History
      </Text>

      {logs.map((log, index) => (
        <View style={styles.logCard} key={index}>
          <Text>{log}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function ActionButton({
  text,
  onPress,
}: {
  text: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F5F7FA',
    padding: 24,
    paddingTop: 60,
  },

  logo: {
    fontSize: 16,
    fontWeight: '800',
    color: '#166534',
  },

  title: {
    fontSize: 34,
    fontWeight: '800',
    marginTop: 4,
  },

  subtitle: {
    fontSize: 15,
    color: '#64748B',
    marginBottom: 28,
  },

  stockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    marginBottom: 25,
  },

  stockLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },

  stockNumber: {
    fontSize: 50,
    fontWeight: '800',
    marginTop: 6,
  },

  unit: {
    color: '#64748B',
  },

  button: {
    backgroundColor: '#166534',
    paddingVertical: 17,
    borderRadius: 14,
    marginBottom: 12,
    alignItems: 'center',
  },

  buttonPressed: {
    opacity: 0.8,
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },

  historyTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 20,
    fontWeight: '700',
  },

  logCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
});