import {
    useEffect,
    useState,
} from 'react';

import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import {
    router,
} from 'expo-router';

import {
    createNewInventoryItem,
    getNextStockId,
} from '../repositories/itemManagementRepository';

export default function AddItemScreen() {
  const [nextStockId, setNextStockId] =
    useState('Loading...');

  const [oldItemId, setOldItemId] =
    useState('');

  const [itemName, setItemName] =
    useState('');

  const [unit, setUnit] =
    useState('Pcs');

  const [
    minimumStock,
    setMinimumStock,
  ] = useState('0');

  const [
    openingQuantity,
    setOpeningQuantity,
  ] = useState('0');

  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    loadNextStockId();
  }, []);

  async function loadNextStockId() {
    try {
      const id =
        await getNextStockId();

      setNextStockId(id);
    } catch (error) {
      setNextStockId(
        'Unable to generate'
      );
    }
  }

  async function handleSave() {
    const opening =
      Number(openingQuantity);

    const minimum =
      Number(minimumStock);

    if (!itemName.trim()) {
      Alert.alert(
        'Item Name Required',
        'Please enter the item name.'
      );

      return;
    }

    if (!unit.trim()) {
      Alert.alert(
        'Unit Required',
        'Please enter the unit.'
      );

      return;
    }

    if (
      Number.isNaN(opening) ||
      opening < 0
    ) {
      Alert.alert(
        'Invalid Opening Quantity',
        'Opening quantity must be zero or greater.'
      );

      return;
    }

    if (
      Number.isNaN(minimum) ||
      minimum < 0
    ) {
      Alert.alert(
        'Invalid Minimum Stock',
        'Minimum stock must be zero or greater.'
      );

      return;
    }

    try {
      setSaving(true);

      const result =
        await createNewInventoryItem({
          oldItemId,
          itemName,
          unit,
          minimumStock:
            minimum,
          openingQuantity:
            opening,
        });

      Alert.alert(
        'Item Created',
        `${itemName.trim()}

Stock ID:
${result.stockId}

Opening Quantity:
${opening} ${unit}`,
        [
          {
            text:
              'Add Another',
            onPress: () => {
              setOldItemId('');
              setItemName('');
              setUnit('Pcs');
              setMinimumStock('0');
              setOpeningQuantity(
                '0'
              );

              loadNextStockId();
            },
          },

          {
            text:
              'View Inventory',
            onPress: () => {
              router.replace(
                '/inventory'
              );
            },
          },
        ]
      );
    } catch (error) {
      console.error(
        'CREATE ITEM ERROR:',
        error
      );

      Alert.alert(
        'Create Item Error',
        String(error)
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          style={styles.backButton}
        >
          <Text
            style={styles.backText}
          >
            ‹ Back
          </Text>
        </Pressable>

        <Text style={styles.label}>
          ITEM MASTER
        </Text>

        <Text style={styles.title}>
          Add New Item
        </Text>

        <Text
          style={styles.subtitle}
        >
          Create a new inventory
          item with its initial
          opening stock.
        </Text>

        <View
          style={styles.stockIdCard}
        >
          <Text
            style={
              styles.stockIdLabel
            }
          >
            NEXT STOCK / QR ID
          </Text>

          <Text
            style={
              styles.stockIdValue
            }
          >
            {nextStockId}
          </Text>

          <Text
            style={
              styles.stockIdHelp
            }
          >
            Generated automatically
          </Text>
        </View>

        <Text
          style={styles.fieldLabel}
        >
          Existing / Group Item ID
        </Text>

        <TextInput
          value={oldItemId}
          onChangeText={setOldItemId}
          placeholder="e.g. R58-PB-067"
          autoCapitalize="characters"
          style={styles.input}
        />

        <Text
          style={styles.helper}
        >
          This can repeat if different
          sizes belong to the same item
          group.
        </Text>

        <Text
          style={styles.fieldLabel}
        >
          Item Name *
        </Text>

        <TextInput
          value={itemName}
          onChangeText={setItemName}
          placeholder='e.g. PVC Elbow 3"'
          style={styles.input}
        />

        <Text
          style={styles.fieldLabel}
        >
          Unit *
        </Text>

        <TextInput
          value={unit}
          onChangeText={setUnit}
          placeholder="Pcs / Roll / Kg / Meter"
          style={styles.input}
        />

        <View style={styles.row}>
          <View
            style={styles.half}
          >
            <Text
              style={
                styles.fieldLabel
              }
            >
              Opening Qty
            </Text>

            <TextInput
              value={
                openingQuantity
              }
              onChangeText={
                setOpeningQuantity
              }
              keyboardType=
                "decimal-pad"
              placeholder="0"
              style={styles.input}
            />
          </View>

          <View
            style={styles.half}
          >
            <Text
              style={
                styles.fieldLabel
              }
            >
              Minimum Stock
            </Text>

            <TextInput
              value={
                minimumStock
              }
              onChangeText={
                setMinimumStock
              }
              keyboardType=
                "decimal-pad"
              placeholder="0"
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text
            style={styles.infoTitle}
          >
            How opening stock works
          </Text>

          <Text
            style={styles.infoText}
          >
            Opening Quantity is used
            only when this new item is
            first created.
          </Text>

          <Text
            style={styles.infoText}
          >
            Future incoming stock
            should be recorded as
            Received, not Opening.
          </Text>
        </View>

        <Pressable
          disabled={saving}
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,

            (
              pressed ||
              saving
            ) &&
              styles.buttonPressed,
          ]}
        >
          <Text
            style={
              styles.saveButtonText
            }
          >
            {saving
              ? 'Creating Item...'
              : 'Create Item'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7F6',
  },

  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 50,
  },

  backButton: {
    marginBottom: 20,
  },

  backText: {
    color: '#166534',
    fontSize: 16,
    fontWeight: '700',
  },

  label: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },

  title: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 4,
  },

  subtitle: {
    color: '#64748B',
    lineHeight: 20,
    marginTop: 5,
    marginBottom: 22,
  },

  stockIdCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 18,
    padding: 18,
    marginBottom: 25,
  },

  stockIdLabel: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '800',
  },

  stockIdValue: {
    color: '#14532D',
    fontSize: 27,
    fontWeight: '900',
    marginTop: 5,
  },

  stockIdHelp: {
    color: '#4D7C5C',
    fontSize: 11,
    marginTop: 3,
  },

  fieldLabel: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 7,
    marginTop: 15,
  },

  input: {
    backgroundColor: '#FFFFFF',
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  helper: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
  },

  half: {
    flex: 1,
  },

  infoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 15,
    marginTop: 24,
  },

  infoTitle: {
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },

  infoText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },

  saveButton: {
    backgroundColor: '#166534',
    borderRadius: 15,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 25,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  buttonPressed: {
    opacity: 0.65,
  },
});