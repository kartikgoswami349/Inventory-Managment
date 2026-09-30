import {
    useEffect,
    useState,
} from 'react';

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
    router,
} from 'expo-router';

import {
    Department,
    getDepartments,
    getPeopleByDepartment,
    Person,
} from '../repositories/departmentRepository';

import {
    startTransactionDraft,
} from '../services/transactionDraftService';

import {
    TransactionType,
} from '../types';


export default function NewTransactionScreen() {

  const [
    type,
    setType,
  ] =
    useState<TransactionType>(
      'ISSUED'
    );


  const [
    departments,
    setDepartments,
  ] =
    useState<Department[]>([]);


  const [
    people,
    setPeople,
  ] =
    useState<Person[]>([]);


  const [
    departmentId,
    setDepartmentId,
  ] =
    useState('');


  const [
    personId,
    setPersonId,
  ] =
    useState('');


  const [
    otherName,
    setOtherName,
  ] =
    useState('');

    const [
  remark,
  setRemark,
] = useState('');


  const [
    departmentModalVisible,
    setDepartmentModalVisible,
  ] =
    useState(false);


  const [
    personModalVisible,
    setPersonModalVisible,
  ] =
    useState(false);


  useEffect(() => {

    loadDepartments();

  }, []);


  async function loadDepartments() {

    try {

      const data =
        await getDepartments();

      setDepartments(
        data
      );

    } catch (error) {

      Alert.alert(
        'Error',
        String(error)
      );
    }
  }


  async function selectDepartment(
    value: string
  ) {

    setDepartmentId(
      value
    );

    setPersonId('');

    setOtherName('');

    setPeople([]);


    if (!value) {
      return;
    }


    const data =
      await getPeopleByDepartment(
        value
      );


    setPeople(
      data
    );
  }


  


  function startScanning() {

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
        'Please enter the other person name.'
      );

      return;
    }


    const department =
      departments.find(
        row =>
          row.id ===
          departmentId
      );


    const person =
      personId === 'OTHER'
        ? null
        : people.find(
            row =>
              row.id ===
              personId
          );


    startTransactionDraft({

  type,

  departmentId,

  departmentName:
    department?.name ?? '',

  personId,

  personName:
    personId === 'OTHER'
      ? otherName.trim()
      : person?.name ?? '',

  otherName:
    personId === 'OTHER'
      ? otherName.trim()
      : '',

  remark:
    remark.trim(),
});


    router.push(
      '/transaction-scan'
    );
  }


  return (

    <ScrollView
      style={
        styles.container
      }

      contentContainerStyle={
        styles.content
      }

      keyboardShouldPersistTaps="handled"
    >

      <Pressable
        onPress={() =>
          router.back()
        }
      >

        <Text
          style={
            styles.back
          }
        >
          ‹ Back
        </Text>

      </Pressable>


      <Text
        style={
          styles.title
        }
      >
        New Transaction
      </Text>


      <Text
        style={
          styles.subtitle
        }
      >
        Select transaction details before scanning items
      </Text>


      <Text
        style={
          styles.label
        }
      >
        Transaction Type
      </Text>


      <View
        style={
          styles.modeRow
        }
      >

        <Pressable

          onPress={() =>
            setType(
              'ISSUED'
            )
          }

          style={[
            styles.modeButton,

            type ===
              'ISSUED' &&
              styles.modeButtonSelected,
          ]}
        >

          <Text
            style={[
              styles.modeText,

              type ===
                'ISSUED' &&
                styles.modeTextSelected,
            ]}
          >
            Issue
          </Text>

        </Pressable>


        <Pressable

          onPress={() =>
            setType(
              'RECEIVED'
            )
          }

          style={[
            styles.modeButton,

            type ===
              'RECEIVED' &&
              styles.modeButtonSelected,
          ]}
        >

          <Text
            style={[
              styles.modeText,

              type ===
                'RECEIVED' &&
                styles.modeTextSelected,
            ]}
          >
            Receive
          </Text>

        </Pressable>

      </View>


      <Text
        style={
          styles.label
        }
      >
        Department
      </Text>


      <Pressable

        style={
          styles.selectBox
        }

        onPress={() => {

          Keyboard.dismiss();

          setDepartmentModalVisible(
            true
          );
        }}
      >

        <Text
          style={[
            styles.selectText,

            !departmentId &&
              styles.placeholder,
          ]}
        >

          {
            departments.find(
              row =>
                row.id ===
                departmentId
            )?.name ??
            'Select Department'
          }

        </Text>

        <Text
          style={
            styles.arrow
          }
        >
          ›
        </Text>

      </Pressable>


      <Text
        style={
          styles.label
        }
      >
        Person
      </Text>


      <Pressable

        disabled={
          !departmentId
        }

        style={[
          styles.selectBox,

          !departmentId &&
            styles.disabled,
        ]}

        onPress={() => {

          if (
            !departmentId
          ) {
            return;
          }

          Keyboard.dismiss();

          setPersonModalVisible(
            true
          );
        }}
      >

        <Text
          style={[
            styles.selectText,

            !personId &&
              styles.placeholder,
          ]}
        >

          {
            personId ===
              'OTHER'

              ? 'Other'

              : people.find(
                  row =>
                    row.id ===
                    personId
                )?.name ??

                (
                  departmentId
                    ? 'Select Person'
                    : 'Select Department First'
                )
          }

        </Text>


        <Text
          style={
            styles.arrow
          }
        >
          ›
        </Text>

      </Pressable>


      {
        personId ===
          'OTHER' && (

          <>

            <Text
              style={
                styles.label
              }
            >
              Other Person Name
            </Text>


            <TextInput

              value={
                otherName
              }

              onChangeText={
                setOtherName
              }

              placeholder="Enter person's name"

              style={
                styles.input
              }

            />

          </>
        )
      }

      <Text
  style={
    styles.label
  }
>
  Remark
</Text>


<TextInput
  value={
    remark
  }

  onChangeText={
    setRemark
  }

  placeholder="Optional remark"

  multiline

  style={[
    styles.input,
    styles.remarkInput,
  ]}
/>


      <Pressable


        style={
          styles.startButton
        }

        onPress={
          startScanning
        }
      >

        <Text
          style={
            styles.startButtonText
          }
        >
          Start Scanning
        </Text>

      </Pressable>


      {/* DEPARTMENT MODAL */}

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

          style={
            styles.overlay
          }

          onPress={() =>
            setDepartmentModalVisible(
              false
            )
          }
        >

          <Pressable
            style={
              styles.modalCard
            }

            onPress={() => {}}
          >

            <Text
              style={
                styles.modalTitle
              }
            >
              Select Department
            </Text>


            <ScrollView>

              {
                departments.map(
                  department => (

                    <Pressable

                      key={
                        department.id
                      }

                      style={
                        styles.option
                      }

                      onPress={
                        async () => {

                          await selectDepartment(
                            department.id
                          );

                          setDepartmentModalVisible(
                            false
                          );
                        }
                      }
                    >

                      <Text
                        style={
                          styles.optionText
                        }
                      >
                        {
                          department.name
                        }
                      </Text>

                    </Pressable>

                  )
                )
              }

            </ScrollView>

          </Pressable>

        </Pressable>

      </Modal>


      {/* PERSON MODAL */}

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

          style={
            styles.overlay
          }

          onPress={() =>
            setPersonModalVisible(
              false
            )
          }
        >

          <Pressable
            style={
              styles.modalCard
            }

            onPress={() => {}}
          >

            <Text
              style={
                styles.modalTitle
              }
            >
              Select Person
            </Text>


            <ScrollView>

              {
                people.map(
                  person => (

                    <Pressable

                      key={
                        person.id
                      }

                      style={
                        styles.option
                      }

                      onPress={() => {

                        setPersonId(
                          person.id
                        );

                        setOtherName('');

                        setPersonModalVisible(
                          false
                        );
                      }}
                    >

                      <Text
                        style={
                          styles.optionText
                        }
                      >
                        {
                          person.name
                        }
                      </Text>

                    </Pressable>

                  )
                )
              }


              <Pressable

                style={
                  styles.option
                }

                onPress={() => {

                  setPersonId(
                    'OTHER'
                  );

                  setOtherName('');

                  setPersonModalVisible(
                    false
                  );
                }}
              >

                <Text
                  style={
                    styles.optionText
                  }
                >
                  Other
                </Text>

              </Pressable>

            </ScrollView>

          </Pressable>

        </Pressable>

      </Modal>

    </ScrollView>
  );
}


const styles =
  StyleSheet.create({

    container: {
      flex: 1,
      backgroundColor:
        '#F4F6F8',
    },

    content: {
      padding: 22,
      paddingTop: 55,
      paddingBottom: 50,
    },

    back: {
      color: '#166534',
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 20,
    },

    title: {
      fontSize: 30,
      fontWeight: '900',
      color: '#0F172A',
    },

    subtitle: {
      marginTop: 6,
      color: '#64748B',
      marginBottom: 15,
    },

    label: {
      marginTop: 24,
      marginBottom: 8,
      color: '#0F172A',
      fontWeight: '800',
    },

    modeRow: {
      flexDirection: 'row',
      gap: 12,
    },

    modeButton: {
      flex: 1,
      backgroundColor:
        '#E2E8F0',
      borderRadius: 14,
      paddingVertical: 17,
      alignItems: 'center',
    },

    modeButtonSelected: {
      backgroundColor:
        '#166534',
    },

    modeText: {
      color: '#334155',
      fontSize: 16,
      fontWeight: '800',
    },

    modeTextSelected: {
      color: '#FFFFFF',
    },

    selectBox: {
      backgroundColor:
        '#FFFFFF',
      minHeight: 54,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        '#E2E8F0',
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    selectText: {
      flex: 1,
      color: '#0F172A',
      fontSize: 16,
    },

    placeholder: {
      color: '#94A3B8',
    },

    arrow: {
      color: '#64748B',
      fontSize: 25,
    },

    disabled: {
      opacity: 0.5,
    },

    input: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 14,
      minHeight: 54,
      paddingHorizontal: 16,
      fontSize: 16,
    },

    startButton: {
      marginTop: 35,
      backgroundColor:
        '#166534',
      borderRadius: 15,
      paddingVertical: 18,
      alignItems: 'center',
    },

    startButtonText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '900',
    },

    overlay: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      padding: 25,
    },

    modalCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 20,
      padding: 18,
      maxHeight: '70%',
    },

    modalTitle: {
      fontSize: 20,
      fontWeight: '900',
      marginBottom: 12,
      color: '#0F172A',
    },

    option: {
      minHeight: 52,
      justifyContent: 'center',
      borderBottomWidth: 1,
      borderBottomColor:
        '#E2E8F0',
      paddingHorizontal: 12,
    },

    optionText: {
      color: '#0F172A',
      fontSize: 16,
    },
    remarkInput: {
  minHeight: 90,
  paddingTop: 14,
  textAlignVertical: 'top',
},

  });