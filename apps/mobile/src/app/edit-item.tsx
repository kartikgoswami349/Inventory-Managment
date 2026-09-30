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
    useLocalSearchParams,
} from 'expo-router';

import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import {
    getInventoryItemForEdit,
    updateInventoryItem,
} from '../repositories/itemManagementRepository';


export default function EditItemScreen() {
  const {
    itemId,
  } =
    useLocalSearchParams<{
      itemId: string;
    }>();


  const [
    stockId,
    setStockId,
  ] = useState('');

  const [
    qrCode,
    setQrCode,
  ] = useState('');

  const [
    itemName,
    setItemName,
  ] = useState('');

  const [
    oldItemId,
    setOldItemId,
  ] = useState('');

  const [
    unit,
    setUnit,
  ] = useState('');

  const [
    minimumStock,
    setMinimumStock,
  ] = useState('0');

  const [
    saving,
    setSaving,
  ] = useState(false);


  useEffect(() => {
    loadItem();
  }, [itemId]);


  async function loadItem() {
    try {
      if (!itemId) {
        throw new Error(
          'Missing item ID.'
        );
      }

      const item =
        await getInventoryItemForEdit(
          itemId
        );

      if (!item) {
        throw new Error(
          'Item not found.'
        );
      }

      setStockId(
        item.stock_id
      );

      setQrCode(
        item.qr_code
      );

      setItemName(
        item.item_name
      );

      setOldItemId(
        item.old_item_id || ''
      );

      setUnit(
        item.unit
      );

      setMinimumStock(
        String(
          item.minimum_stock
        )
      );

    } catch (error) {
      Alert.alert(
        'Unable to Load Item',

        error instanceof Error
          ? error.message
          : String(error),

        [
          {
            text:
              'OK',

            onPress: () =>
              router.back(),
          },
        ]
      );
    }
  }


  async function handleSave() {
    try {
      if (!itemId) {
        return;
      }

      const parsedMinimum =
        Number(
          minimumStock
        );

      setSaving(true);

      await updateInventoryItem(
        itemId,
        {
          itemName,
          oldItemId,
          unit,

          minimumStock:
            parsedMinimum,
        }
      );

      Alert.alert(
        'Item Updated',
        'The item has been updated successfully.',
        [
          {
            text:
              'OK',

            onPress: () =>
              router.back(),
          },
        ]
      );

    } catch (error) {
      Alert.alert(
        'Update Failed',

        error instanceof Error
          ? error.message
          : String(error)
      );

    } finally {
      setSaving(false);
    }
  }


  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <KeyboardAvoidingView
        style={{
          flex: 1,
        }}
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.container
          }
          keyboardShouldPersistTaps="handled"
        >

          <Text style={styles.label}>
            ADMIN
          </Text>

          <Text style={styles.title}>
            Edit Item
          </Text>

          <Text style={styles.subtitle}>
            Update inventory master
            information.
          </Text>


          <View
            style={
              styles.lockedCard
            }
          >
            <Text
              style={
                styles.lockedLabel
              }
            >
              STOCK ID
            </Text>

            <Text
              style={
                styles.lockedValue
              }
            >
              {stockId}
            </Text>

            <Text
              style={
                styles.lockedNote
              }
            >
              Permanent • Cannot be changed
            </Text>
          </View>


          <View
            style={
              styles.lockedCard
            }
          >
            <Text
              style={
                styles.lockedLabel
              }
            >
              QR CODE
            </Text>

            <Text
              style={
                styles.lockedValue
              }
            >
              {qrCode}
            </Text>

            <Text
              style={
                styles.lockedNote
              }
            >
              Linked to Stock ID
            </Text>
          </View>


          <Field
            label="Item Name"
            value={itemName}
            onChangeText={
              setItemName
            }
            placeholder="Item name"
          />


          <Field
            label="Old Item ID"
            value={oldItemId}
            onChangeText={
              setOldItemId
            }
            placeholder="Optional"
          />


          <Field
            label="Unit"
            value={unit}
            onChangeText={
              setUnit
            }
            placeholder="PCS, MTR, KG..."
          />


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
              value =>
                setMinimumStock(
                  value.replace(
                    /[^0-9.]/g,
                    ''
                  )
                )
            }

            keyboardType="decimal-pad"

            style={styles.input}

            placeholder="0"
          />


          <View
            style={
              styles.infoBox
            }
          >
            <Text
              style={
                styles.infoTitle
              }
            >
              Current Quantity
            </Text>

            <Text
              style={
                styles.infoText
              }
            >
              Stock quantity cannot be edited here.
              Use Issue, Receive or Audit to change
              quantity.
            </Text>
          </View>


          <Pressable
            disabled={saving}

            onPress={
              handleSave
            }

            style={[
              styles.saveButton,

              saving &&
                styles.disabledButton,
            ]}
          >
            <Text
              style={
                styles.saveText
              }
            >
              {saving
                ? 'Saving...'
                : 'Save Changes'}
            </Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText:
    (value: string) => void;
  placeholder: string;
}) {
  return (
    <>
      <Text
        style={
          styles.fieldLabel
        }
      >
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={
          onChangeText
        }
        placeholder={
          placeholder
        }
        style={
          styles.input
        }
      />
    </>
  );
}


const styles =
  StyleSheet.create({

    safeArea: {
      flex: 1,

      backgroundColor:
        '#F5F7F6',
    },

    container: {
      paddingHorizontal:
        20,

      paddingTop:
        12,

      paddingBottom:
        35,
    },

    label: {
      color:
        '#166534',

      fontSize:
        11,

      fontWeight:
        '900',

      letterSpacing:
        1.2,
    },

    title: {
      color:
        '#111827',

      fontSize:
        29,

      fontWeight:
        '900',

      marginTop:
        3,
    },

    subtitle: {
      color:
        '#64748B',

      marginTop:
        4,

      marginBottom:
        20,
    },


    lockedCard: {
      backgroundColor:
        '#EEF2F7',

      borderRadius:
        14,

      padding:
        13,

      marginBottom:
        10,

      borderWidth:
        1,

      borderColor:
        '#E2E8F0',
    },

    lockedLabel: {
      color:
        '#64748B',

      fontSize:
        9,

      fontWeight:
        '900',

      letterSpacing:
        1,
    },

    lockedValue: {
      color:
        '#111827',

      fontSize:
        16,

      fontWeight:
        '900',

      marginTop:
        3,
    },

    lockedNote: {
      color:
        '#94A3B8',

      fontSize:
        10,

      marginTop:
        3,
    },


    fieldLabel: {
      color:
        '#334155',

      fontSize:
        12,

      fontWeight:
        '800',

      marginBottom:
        6,

      marginTop:
        11,
    },

    input: {
      minHeight:
        48,

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        12,

      paddingHorizontal:
        13,

      borderWidth:
        1,

      borderColor:
        '#E2E8F0',

      color:
        '#111827',

      fontSize:
        14,
    },


    infoBox: {
      marginTop:
        18,

      padding:
        13,

      borderRadius:
        13,

      backgroundColor:
        '#EFF6FF',
    },

    infoTitle: {
      color:
        '#1D4ED8',

      fontWeight:
        '800',

      fontSize:
        12,
    },

    infoText: {
      color:
        '#64748B',

      fontSize:
        11,

      lineHeight:
        16,

      marginTop:
        4,
    },


    saveButton: {
      marginTop:
        22,

      backgroundColor:
        '#166534',

      minHeight:
        52,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    saveText: {
      color:
        '#FFFFFF',

      fontSize:
        14,

      fontWeight:
        '900',
    },

    disabledButton: {
      opacity:
        0.6,
    },
  });