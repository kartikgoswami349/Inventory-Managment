import {
    router,
    useLocalSearchParams,
} from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    Keyboard,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import {
    Department,
    getDepartments,
    getPeopleByDepartment,
    Person,
} from '../repositories/departmentRepository';
import {
    requestImmediateSync,
} from '../services/autoSyncService';
import {
    clearTransactionRecipientSession,
    getTransactionRecipientSession,
    setTransactionRecipientSession,
} from '../services/transactionSessionService';

import {
    getItemById,
    InventoryItem,
} from '../repositories/itemRepository';

import { getDeviceId } from '@/services/deviceService';
import {
    createTransaction,
} from '../repositories/transactionRepository';

type TransactionMode = 'ISSUED' | 'RECEIVED';

export default function ItemTransactionScreen() {
  const params = useLocalSearchParams<{
    itemId?: string | string[];
  }>();

  const [departments, setDepartments] =
  useState<Department[]>([]);

const [people, setPeople] =
  useState<Person[]>([]);

const [departmentId, setDepartmentId] =
  useState('');

const [personId, setPersonId] =
  useState('');

const [otherName, setOtherName] =
  useState('');

  const [
  departmentModalVisible,
  setDepartmentModalVisible,
] = useState(false);

const [
  personModalVisible,
  setPersonModalVisible,
] = useState(false);
  
  

  const itemId = Array.isArray(params.itemId)
    ? params.itemId[0]
    : params.itemId;

  const [item, setItem] =
    useState<InventoryItem | null>(null);

  const [mode, setMode] =
    useState<TransactionMode>('ISSUED');

  const [quantity, setQuantity] = useState('');
  const [remark, setRemark] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

useEffect(() => {

  loadItem();

}, [itemId]);


useEffect(() => {

  loadDepartmentsAndRecipientSession();

}, []);


async function
  loadDepartmentsAndRecipientSession() {

  try {

    /*
      First load the normal department list.
    */

    const departmentData =
      await getDepartments();


    setDepartments(
      departmentData
    );


    /*
      Check whether the previous
      transaction requested:

      "Scan Another for Same Person"
    */

    const session =
      getTransactionRecipientSession();


    if (!session) {
      return;
    }


    /*
      Make sure the remembered department
      still exists.

      If somebody deleted/deactivated the
      department, don't restore invalid data.
    */

    const departmentExists =
      departmentData.some(
        department =>
          department.id ===
          session.departmentId
      );


    if (!departmentExists) {

      clearTransactionRecipientSession();

      return;
    }


    /*
      Restore Department.
    */

    setDepartmentId(
      session.departmentId
    );


    /*
      Load people belonging to this
      remembered Department.
    */

    const peopleData =
      await getPeopleByDepartment(
        session.departmentId
      );


    setPeople(
      peopleData
    );


    /*
      "Other" person does not exist
      inside the People table.

      Restore the manually entered name.
    */

    if (
      session.personId ===
      'OTHER'
    ) {

      setPersonId(
        'OTHER'
      );


      setOtherName(
        session.otherName
      );


      return;
    }


    /*
      For a normal Person, verify that
      the person still belongs to the
      remembered Department.
    */

    const personExists =
      peopleData.some(
        person =>
          person.id ===
          session.personId
      );


    if (!personExists) {

      /*
        Don't automatically issue stock
        to an invalid/removed person.
      */

      clearTransactionRecipientSession();


      setDepartmentId(
        ''
      );


      setPeople(
        []
      );


      return;
    }


    /*
      Everything is valid.

      Automatically preselect the
      previous Person.
    */

    setPersonId(
      session.personId
    );


    setOtherName(
      ''
    );


  } catch (error) {

    console.error(
      'LOAD RECIPIENT SESSION ERROR:',
      error
    );
  }
}
async function handleDepartmentChange(
  value: string
) {
  setDepartmentId(value);
  setPersonId('');
  setOtherName('');

  if (!value) {
    setPeople([]);
    return;
  }

  const data =
    await getPeopleByDepartment(value);

  setPeople(data);
}

async function loadItem() {

  console.log(
    'TRANSACTION ITEM ID:',
    itemId
  );


  if (!itemId) {

    console.log(
      'NO ITEM ID RECEIVED'
    );

    setLoading(false);

    return;
  }


  try {

    setLoading(true);


    console.log(
      'LOADING ITEM:',
      itemId
    );


    const result =
      await getItemById(
        itemId
      );


    console.log(
      'ITEM LOADED:',
      result
    );


    setItem(
      result
    );


  } catch (error) {

    console.error(
      'LOAD ITEM ERROR:',
      error
    );


    Alert.alert(
      'Error',
      'Unable to load item details.\n\n' +
      String(error)
    );


  } finally {

    console.log(
      'ITEM LOAD FINISHED'
    );


    setLoading(false);
  }
}

  async function saveTransaction() {
    if (!item) {
      return;
    }

    const qty = Number(quantity);

    if (!quantity.trim() || Number.isNaN(qty) || qty <= 0) {
      Alert.alert(
        'Invalid Quantity',
        'Enter a quantity greater than zero.'
      );

      return;
    }

    if (
      mode === 'ISSUED' &&
      qty > item.current_stock
    ) {
      Alert.alert(
        'Insufficient Stock',
        `Available: ${item.current_stock} ${item.unit}\nRequested: ${qty} ${item.unit}`
      );

      return;
    }

    if (!departmentId) {
  Alert.alert(
    'Department Required',
    'Please select a department.'
  );

  return;
}

if (!personId) {
  Alert.alert(
    'Person Required',
    'Please select a person.'
  );

  return;
}

if (
  personId === 'OTHER' &&
  !otherName.trim()
) {
  Alert.alert(
    'Name Required',
    'Enter the person’s name.'
  );

  return;
}

    try {
      setSaving(true);

      const deviceId =
  await getDeviceId();

await createTransaction(
  item.id,
  mode,
  qty,
  deviceId,
  remark.trim(),
  departmentId || null,

  personId === 'OTHER'
    ? null
    : personId || null,

  personId === 'OTHER'
    ? otherName.trim()
    : null
);

requestImmediateSync();

      const updatedItem =
        await getItemById(item.id);

      if (updatedItem) {
        setItem(updatedItem);
      }

      /*
  Find readable names for the
  success popup and batch session.
*/

const selectedDepartmentName =
  departments.find(
    department =>
      department.id ===
      departmentId
  )?.name ||
  'Selected Department';


const selectedPersonName =
  personId === 'OTHER'

    ? otherName.trim()

    : people.find(
        person =>
          person.id ===
          personId
      )?.name ||
      'Selected Person';


/*
  Quantity and remark must NOT carry
  into the next item.
*/

setQuantity('');
setRemark('');


Alert.alert(

  'Transaction Saved',

  (
    mode === 'ISSUED'

      ? `${qty} ${item.unit} issued successfully.`

      : `${qty} ${item.unit} received successfully.`
  )
  +
  '\n\n'
  +
  'Continue for:\n'
  +
  `${selectedDepartmentName} • ${selectedPersonName}`,

  [

    /*
      OPTION 1
      Continue the current person's batch.
    */

    {
      text:
        'Scan Same Person',

      onPress: () => {

        /*
          Remember ONLY:

          Department
          Person
          Other Name

          Quantity, Item and Remark are
          deliberately not remembered.
        */

        setTransactionRecipientSession({

          departmentId,

          departmentName:
            selectedDepartmentName,

          personId,

          personName:
            selectedPersonName,

          otherName:
            personId ===
            'OTHER'

              ? otherName.trim()

              : '',
        });


        /*
          Open scanner normally.

          After the next QR is scanned,
          item-transaction.tsx will read
          this temporary recipient session.
        */

        router.replace(
          '/scan'
        );
      },
    },


    /*
      OPTION 2
      New transaction for a completely
      different person.
    */

    {
      text:
        'Scan Normally',

      onPress: () => {

        clearTransactionRecipientSession();


        router.replace(
          '/scan'
        );
      },
    },


    /*
      OPTION 3
      Finish this batch.
    */

    {
      text:
        'Done',

      onPress: () => {

        clearTransactionRecipientSession();


        router.replace(
          '/'
        );
      },
    },
  ]
);
    } catch (error) {
      console.error('SAVE TRANSACTION ERROR:', error);

      Alert.alert(
        'Transaction Error',
        String(error)
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading item...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          Item not found
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/scan')}
        >
          <Text style={styles.backButtonText}>
            Scan Again
          </Text>
        </Pressable>
      </View>
    );
  }

  const expectedStock =
    mode === 'ISSUED'
      ? item.current_stock - (Number(quantity) || 0)
      : item.current_stock + (Number(quantity) || 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={() => router.back()}
        style={styles.back}
      >
        <Text style={styles.backText}>
          ‹ Back
        </Text>
      </Pressable>

      <Text style={styles.stockId}>
        {item.stock_id}
      </Text>

      <Text style={styles.itemName}>
        {item.item_name}
      </Text>

      {item.old_item_id && (
        <Text style={styles.oldItemId}>
          Item ID: {item.old_item_id}
        </Text>
      )}

      <View style={styles.stockCard}>
        <Text style={styles.stockLabel}>
          LIVE QUANTITY
        </Text>

        <Text style={styles.stockNumber}>
          {item.current_stock}
        </Text>

        <Text style={styles.stockUnit}>
          {item.unit}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>
        Transaction Type
      </Text>

      <View style={styles.modeRow}>
        <Pressable
          onPress={() => setMode('ISSUED')}
          style={[
            styles.modeButton,
            mode === 'ISSUED' &&
              styles.modeButtonSelected,
          ]}
        >
          <Text
            style={[
              styles.modeText,
              mode === 'ISSUED' &&
                styles.modeTextSelected,
            ]}
          >
            Issue
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setMode('RECEIVED')}
          style={[
            styles.modeButton,
            mode === 'RECEIVED' &&
              styles.modeButtonSelected,
          ]}
        >
          <Text
            style={[
              styles.modeText,
              mode === 'RECEIVED' &&
                styles.modeTextSelected,
            ]}
          >
            Receive
          </Text>
        </Pressable>
      </View>

      <Text style={styles.fieldLabel}>
        Quantity
      </Text>

      <TextInput
        value={quantity}
        onChangeText={setQuantity}
        placeholder={`Enter quantity in ${item.unit}`}
        keyboardType="decimal-pad"
        style={styles.input}
      />

      {!!quantity && Number(quantity) > 0 && (
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>
            Stock after transaction
          </Text>

          <Text style={styles.previewValue}>
            {expectedStock} {item.unit}
          </Text>
        </View>
      )}

<Text style={styles.fieldLabel}>
  Department
</Text>

<Pressable
  onPress={() => {
    Keyboard.dismiss();

    setDepartmentModalVisible(
      true
    );
  }}
  style={styles.selectBox}
>
  <Text
    style={[
      styles.selectText,

      !departmentId &&
        styles.placeholderText,
    ]}
  >
    {
      departments.find(
        department =>
          department.id ===
          departmentId
      )?.name ||
      'Select Department'
    }
  </Text>

  <Text style={styles.selectArrow}>
    ›
  </Text>
</Pressable>


<Modal
  visible={
    departmentModalVisible
  }
  transparent
  animationType="fade"
  onRequestClose={() =>
    setDepartmentModalVisible(
      false
    )
  }
>
  <Pressable
    style={styles.modalOverlay}
    onPress={() =>
      setDepartmentModalVisible(
        false
      )
    }
  >
    <Pressable
      style={styles.modalCard}
      onPress={() => {}}
    >
      <Text style={styles.modalTitle}>
        Select Department
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="always"
      >
        {departments.map(
          department => (
            <Pressable
              key={department.id}

              onPress={
                async () => {
                  await handleDepartmentChange(
                    department.id
                  );

                  setDepartmentModalVisible(
                    false
                  );
                }
              }

              style={[
                styles.modalOption,

                departmentId ===
                  department.id &&
                  styles.modalOptionSelected,
              ]}
            >
              <Text
                style={[
                  styles.modalOptionText,

                  departmentId ===
                    department.id &&
                    styles.modalOptionTextSelected,
                ]}
              >
                {department.name}
              </Text>
            </Pressable>
          )
        )}
      </ScrollView>

      <Pressable
        onPress={() =>
          setDepartmentModalVisible(
            false
          )
        }
        style={styles.modalCancel}
      >
        <Text
          style={
            styles.modalCancelText
          }
        >
          Cancel
        </Text>
      </Pressable>
    </Pressable>
  </Pressable>
</Modal>


<Text style={styles.fieldLabel}>
  Person's Name
</Text>

<Pressable
  disabled={!departmentId}

  onPress={() => {
    Keyboard.dismiss();

    if (!departmentId) {
      return;
    }

    setPersonModalVisible(
      true
    );
  }}

  style={[
    styles.selectBox,

    !departmentId &&
      styles.selectBoxDisabled,
  ]}
>
  <Text
    style={[
      styles.selectText,

      !personId &&
        styles.placeholderText,
    ]}
  >
    {
      personId === 'OTHER'
        ? 'Other'
        : people.find(
            person =>
              person.id ===
              personId
          )?.name ||
          (
            departmentId
              ? 'Select Person'
              : 'Select Department First'
          )
    }
  </Text>

  <Text style={styles.selectArrow}>
    ›
  </Text>
</Pressable>


<Modal
  visible={
    personModalVisible
  }
  transparent
  animationType="fade"
  onRequestClose={() =>
    setPersonModalVisible(
      false
    )
  }
>
  <Pressable
    style={styles.modalOverlay}
    onPress={() =>
      setPersonModalVisible(
        false
      )
    }
  >
    <Pressable
      style={styles.modalCard}
      onPress={() => {}}
    >
      <Text style={styles.modalTitle}>
        Select Person
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="always"
      >
        {people.map(
          person => (
            <Pressable
              key={person.id}

              onPress={() => {
                setPersonId(
                  person.id
                );

                setOtherName('');

                setPersonModalVisible(
                  false
                );
              }}

              style={[
                styles.modalOption,

                personId ===
                  person.id &&
                  styles.modalOptionSelected,
              ]}
            >
              <Text
                style={[
                  styles.modalOptionText,

                  personId ===
                    person.id &&
                    styles.modalOptionTextSelected,
                ]}
              >
                {person.name}
              </Text>
            </Pressable>
          )
        )}

        <Pressable
          onPress={() => {
            setPersonId(
              'OTHER'
            );

            setPersonModalVisible(
              false
            );
          }}

          style={[
            styles.modalOption,

            personId ===
              'OTHER' &&
              styles.modalOptionSelected,
          ]}
        >
          <Text
            style={[
              styles.modalOptionText,

              personId ===
                'OTHER' &&
                styles.modalOptionTextSelected,
            ]}
          >
            Other
          </Text>
        </Pressable>
      </ScrollView>

      <Pressable
        onPress={() =>
          setPersonModalVisible(
            false
          )
        }
        style={styles.modalCancel}
      >
        <Text
          style={
            styles.modalCancelText
          }
        >
          Cancel
        </Text>
      </Pressable>
    </Pressable>
  </Pressable>
</Modal>

{personId === 'OTHER' && (
  <>
    <Text style={styles.fieldLabel}>
      Other Name
    </Text>

    <TextInput
      value={otherName}
      onChangeText={setOtherName}
      placeholder="Enter person's name"
      style={styles.input}
    />
  </>
)}

      <Text style={styles.fieldLabel}>
        Remark
      </Text>

      <TextInput
        value={remark}
        onChangeText={setRemark}
        placeholder="Optional remark"
        multiline
        style={[
          styles.input,
          styles.remarkInput,
        ]}
      />

      <View style={styles.dateBox}>
        <Text style={styles.dateLabel}>
          Date & Time
        </Text>

        <Text style={styles.dateValue}>
          {new Date().toLocaleString()}
        </Text>
      </View>

      <Pressable
        disabled={saving}
        onPress={saveTransaction}
        style={[
          styles.saveButton,
          saving && styles.disabledButton,
        ]}
      >
        <Text style={styles.saveButtonText}>
          {saving
            ? 'Saving...'
            : mode === 'ISSUED'
              ? 'Save Issue'
              : 'Save Receipt'}
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F6F8',
    padding: 25,
  },

  back: {
    marginBottom: 20,
  },

  backText: {
    color: '#166534',
    fontSize: 16,
    fontWeight: '700',
  },

  stockId: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '800',
  },

  itemName: {
    marginTop: 4,
    color: '#0F172A',
    fontSize: 30,
    fontWeight: '800',
  },

  oldItemId: {
    color: '#64748B',
    marginTop: 5,
  },

  stockCard: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 25,
    alignItems: 'center',
  },

  stockLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },

  stockNumber: {
    color: '#0F172A',
    fontSize: 52,
    fontWeight: '800',
    marginTop: 5,
  },

  stockUnit: {
    color: '#64748B',
    fontSize: 15,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 30,
    marginBottom: 12,
  },

  modeRow: {
    flexDirection: 'row',
    gap: 12,
  },

  modeButton: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },

  modeButtonSelected: {
    backgroundColor: '#166534',
  },

  modeText: {
    color: '#334155',
    fontWeight: '800',
    fontSize: 16,
  },

  modeTextSelected: {
    color: '#FFFFFF',
  },

  fieldLabel: {
    color: '#0F172A',
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 8,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    minHeight: 52,
    fontSize: 16,
  },

  remarkInput: {
    minHeight: 100,
    paddingTop: 15,
    textAlignVertical: 'top',
  },

  preview: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  previewLabel: {
    color: '#166534',
    fontWeight: '600',
  },

  previewValue: {
    color: '#166534',
    fontWeight: '800',
  },

  dateBox: {
    marginTop: 25,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 15,
  },

  dateLabel: {
    color: '#64748B',
    fontSize: 12,
  },

  dateValue: {
    color: '#0F172A',
    fontWeight: '600',
    marginTop: 3,
  },

  saveButton: {
    backgroundColor: '#16652b',
    borderRadius: 15,
    alignItems: 'center',
    paddingVertical: 18,
    marginTop: 30,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 17,
  },

  disabledButton: {
    opacity: 0.5,
  },

  errorTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
  },

  backButton: {
    backgroundColor: '#166528',
    paddingVertical: 14,
    paddingHorizontal: 25,
    borderRadius: 13,
  },

  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  pickerBox: {
  backgroundColor: '#FFFFFF',
  borderRadius: 14,
  overflow: 'hidden',
},
selectBox: {
  backgroundColor: '#FFFFFF',
  borderRadius: 14,
  minHeight: 52,
  paddingHorizontal: 16,

  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',

  borderWidth: 1,
  borderColor: '#E2E8F0',
},

selectBoxDisabled: {
  opacity: 0.5,
},

selectText: {
  flex: 1,
  color: '#0F172A',
  fontSize: 16,
},

placeholderText: {
  color: '#94A3B8',
},

selectArrow: {
  color: '#64748B',
  fontSize: 26,
  marginLeft: 8,
},

modalOverlay: {
  flex: 1,
  backgroundColor:
    'rgba(0,0,0,0.55)',

  justifyContent: 'center',
  paddingHorizontal: 25,
},

modalCard: {
  backgroundColor: '#FFFFFF',
  borderRadius: 20,
  padding: 18,

  maxHeight: '70%',
},

modalTitle: {
  color: '#0F172A',
  fontSize: 20,
  fontWeight: '900',

  marginBottom: 12,
},

modalOption: {
  minHeight: 52,
  justifyContent: 'center',

  paddingHorizontal: 14,

  borderBottomWidth: 1,
  borderBottomColor: '#E2E8F0',
},

modalOptionSelected: {
  backgroundColor: '#ECFDF5',
  borderRadius: 10,
},

modalOptionText: {
  color: '#0F172A',
  fontSize: 16,
},

modalOptionTextSelected: {
  color: '#166534',
  fontWeight: '900',
},

modalCancel: {
  marginTop: 14,
  minHeight: 46,

  borderRadius: 12,

  backgroundColor: '#F1F5F9',

  alignItems: 'center',
  justifyContent: 'center',
},

modalCancelText: {
  color: '#475569',
  fontWeight: '800',
},
});