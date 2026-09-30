import { useEffect, useState } from 'react';

import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import {
    router,
    useLocalSearchParams,
} from 'expo-router';

import {
    getItemById,
    InventoryItem,
} from '../repositories/itemRepository';

import {
    saveAudit,
} from '../repositories/auditRepository';

export default function AuditScreen() {
  const params = useLocalSearchParams<{
    itemId?: string | string[];
  }>();

  const itemId = Array.isArray(params.itemId)
    ? params.itemId[0]
    : params.itemId;

  const [item, setItem] =
    useState<InventoryItem | null>(null);

  const [auditedQuantity, setAuditedQuantity] =
    useState('');

  const [remark, setRemark] =
    useState('');

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    loadItem();
  }, [itemId]);

  async function loadItem() {
    if (!itemId) {
      return;
    }

    try {
      const result =
        await getItemById(itemId);

      setItem(result);
    } catch (error) {
      console.error(
        'LOAD AUDIT ITEM ERROR:',
        error
      );

      Alert.alert(
        'Error',
        'Unable to load item.'
      );
    }
  }

  const physicalQty =
    auditedQuantity.trim()
      ? Number(auditedQuantity)
      : null;

  const variance =
    item &&
    physicalQty !== null &&
    !Number.isNaN(physicalQty)
      ? physicalQty - item.current_stock
      : null;

  async function finishAudit(
    adjustStock: boolean
  ) {
    if (!item) {
      Alert.alert(
        'Error',
        'Item data is not available.'
      );
      return;
    }

    if (
      physicalQty === null ||
      Number.isNaN(physicalQty) ||
      physicalQty < 0
    ) {
      Alert.alert(
        'Invalid Quantity',
        'Enter a valid physical quantity.'
      );
      return;
    }

    try {
      setSaving(true);

      const result =
        await saveAudit(
          item.id,
          physicalQty,
          remark.trim(),
          'PHONE-A',
          adjustStock
        );

      Alert.alert(
        'Audit Saved',
        result.adjusted
          ? `Stock adjusted by ${
              result.variance > 0
                ? '+'
                : ''
            }${result.variance} ${item.unit}.`
          : 'Audit saved without changing live stock.',
        [
          {
            text: 'Audit Another',
            onPress: () => {
              router.replace('/audit-scan');
            },
          },
          {
            text: 'Done',
            onPress: () => {
              router.replace('/');
            },
          },
        ]
      );
    } catch (error) {
      console.error(
        'SAVE AUDIT ERROR:',
        error
      );

      Alert.alert(
        'Audit Error',
        String(error)
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    if (!item) {
      Alert.alert(
        'Error',
        'Item data is not available.'
      );
      return;
    }

    if (
      physicalQty === null ||
      Number.isNaN(physicalQty) ||
      physicalQty < 0
    ) {
      Alert.alert(
        'Invalid Quantity',
        'Enter the physical quantity you counted.'
      );
      return;
    }

    if (variance === null) {
      return;
    }

    if (variance === 0) {
      finishAudit(false);
      return;
    }

    Alert.alert(
      'Stock Difference Found',
      `System Quantity: ${
        item.current_stock
      } ${item.unit}

Physical Quantity: ${physicalQty} ${
        item.unit
      }

Variance: ${
        variance > 0 ? '+' : ''
      }${variance} ${item.unit}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Save Audit Only',
          onPress: () => {
            finishAudit(false);
          },
        },
        {
          text: 'Adjust Stock',
          onPress: () => {
            finishAudit(true);
          },
        },
      ]
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Text>Loading item...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backText}>
          ‹ Back
        </Text>
      </Pressable>

      <Text style={styles.labelTop}>
        AUDIT
      </Text>

      <Text style={styles.itemName}>
        {item.item_name}
      </Text>

      <Text style={styles.stockId}>
        {item.stock_id}
      </Text>

      <View style={styles.systemCard}>
        <Text style={styles.smallLabel}>
          SYSTEM QUANTITY
        </Text>

        <Text style={styles.systemQty}>
          {item.current_stock}
        </Text>

        <Text style={styles.unit}>
          {item.unit}
        </Text>
      </View>

      <Text style={styles.fieldLabel}>
        Physical / Audited Quantity
      </Text>

      <TextInput
        value={auditedQuantity}
        onChangeText={setAuditedQuantity}
        keyboardType="decimal-pad"
        placeholder="Enter counted quantity"
        style={styles.input}
      />

      {variance !== null && (
        <View style={styles.varianceCard}>
          <Text style={styles.smallLabel}>
            VARIANCE
          </Text>

          <Text
            style={[
              styles.variance,
              variance === 0
                ? styles.correct
                : styles.different,
            ]}
          >
            {variance > 0 ? '+' : ''}
            {variance} {item.unit}
          </Text>

          <Text style={styles.varianceHelp}>
            {variance === 0
              ? 'Physical stock matches system stock.'
              : variance < 0
                ? `${Math.abs(
                    variance
                  )} ${item.unit} less than system stock.`
                : `${variance} ${item.unit} more than system stock.`}
          </Text>
        </View>
      )}

      <Text style={styles.fieldLabel}>
        Audit Remark
      </Text>

      <TextInput
        value={remark}
        onChangeText={setRemark}
        multiline
        placeholder="Optional explanation"
        style={[
          styles.input,
          styles.remark,
        ]}
      />

      <View style={styles.timeCard}>
        <Text style={styles.smallLabel}>
          AUDIT DATE & TIME
        </Text>

        <Text style={styles.time}>
          {new Date().toLocaleString()}
        </Text>
      </View>

      <Pressable
        disabled={saving}
        onPress={handleSave}
        style={[
          styles.saveButton,
          saving && styles.disabled,
        ]}
      >
        <Text style={styles.saveText}>
          {saving
            ? 'Saving...'
            : 'Save Audit'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },

  content: {
    padding: 22,
    paddingTop: 55,
    paddingBottom: 50,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F6F8',
  },

  backButton: {
    marginBottom: 18,
  },

  backText: {
    color: '#166534',
    fontSize: 16,
    fontWeight: '700',
  },

  labelTop: {
    color: '#166534',
    fontWeight: '800',
    fontSize: 13,
  },

  itemName: {
    fontSize: 29,
    fontWeight: '800',
    marginTop: 5,
  },

  stockId: {
    color: '#64748B',
    marginTop: 4,
  },

  systemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginTop: 5,
  },

  smallLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },

  systemQty: {
    fontSize: 52,
    fontWeight: '800',
    marginTop: 5,
  },

  unit: {
    color: '#64748B',
  },

  fieldLabel: {
    fontWeight: '700',
    marginTop: 25,
    marginBottom: 8,
  },

  input: {
    backgroundColor: '#FFFFFF',
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
  },

  remark: {
    minHeight: 10,
    paddingTop: 5,
    textAlignVertical: 'top',
  },

  varianceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 7,
    marginTop: 14,
  },

  variance: {
    fontSize: 27,
    fontWeight: '800',
    marginTop: 3,
  },

  correct: {
    color: '#166534',
  },

  different: {
    color: '#B45309',
  },

  varianceHelp: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 5,
  },

  timeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 15,
    marginTop: 25,
  },

  time: {
    fontWeight: '600',
    marginTop: 4,
  },

  saveButton: {
    backgroundColor: '#166534',
    borderRadius: 15,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 30,
  },

  saveText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 17,
  },

  disabled: {
    opacity: 0.5,
  },
});