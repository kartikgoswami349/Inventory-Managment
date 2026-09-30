import {
    useCallback,
    useState,
} from 'react';

import {
    Alert,
    FlatList,
    Pressable,
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
    addDepartment,
    addPerson,
    deactivateDepartment,
    Department,
    getDepartments,
    getPeopleByDepartment,
    Person,
} from '../repositories/masterDataRepository';

export default function ManagePeopleScreen() {

    
  const [
    departments,
    setDepartments,
  ] = useState<Department[]>([]);

  const [
    selectedDepartment,
    setSelectedDepartment,
  ] = useState<Department | null>(
    null
  );

  const [
    people,
    setPeople,
  ] = useState<Person[]>([]);

  const [
    newDepartment,
    setNewDepartment,
  ] = useState('');

  const [
    newPerson,
    setNewPerson,
  ] = useState('');

  function handleDeleteDepartment() {
  if (!selectedDepartment) {
    return;
  }

  Alert.alert(
    'Delete Department?',
    `Delete "${selectedDepartment.name}"?

The department and its staff names will be removed from future selections.

Existing transaction history will remain safe.`,
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',

        onPress: async () => {
          try {
            await deactivateDepartment(
              selectedDepartment.id
            );

            setSelectedDepartment(
              null
            );

            setPeople([]);

            await loadDepartments();

            Alert.alert(
              'Department Deleted',
              'The department and its staff names were removed from active lists.'
            );
          } catch (error) {
            Alert.alert(
              'Delete Failed',
              String(error)
            );
          }
        },
      },
    ]
  );
}

  async function loadDepartments() {
    const data =
      await getDepartments();

    setDepartments(data);

    if (
      selectedDepartment
    ) {
      const stillExists =
        data.find(
          department =>
            department.id ===
            selectedDepartment.id
        );

      if (!stillExists) {
        setSelectedDepartment(
          null
        );

        setPeople([]);
      }
    }
  }

  async function loadPeople(
    departmentId: string
  ) {
    const data =
      await getPeopleByDepartment(
        departmentId
      );

    setPeople(data);
  }

  useFocusEffect(
    useCallback(() => {
      loadDepartments();
    }, [])
  );

  async function handleAddDepartment() {
    try {
      await addDepartment(
        newDepartment
      );

      setNewDepartment('');

      await loadDepartments();
    } catch (error) {
      Alert.alert(
        'Department',
        String(error)
      );
    }
  }

  async function handleSelectDepartment(
    department: Department
  ) {
    setSelectedDepartment(
      department
    );

    await loadPeople(
      department.id
    );
  }

  async function handleAddPerson() {
    if (!selectedDepartment) {
      Alert.alert(
        'Select Department',
        'Please select a department first.'
      );

      return;
    }

    try {
      await addPerson(
        selectedDepartment.id,
        newPerson
      );

      setNewPerson('');

      await loadPeople(
        selectedDepartment.id
      );
    } catch (error) {
      Alert.alert(
        'Person',
        String(error)
      );
    }
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <FlatList
        data={people}
        keyExtractor={item =>
          item.id
        }
        contentContainerStyle={
          styles.content
        }
        ListHeaderComponent={
          <>
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

            <Text
              style={styles.label}
            >
              MASTER DATA
            </Text>

            <Text
              style={styles.title}
            >
              Departments & People
            </Text>

            <Text
              style={styles.subtitle}
            >
              Create departments and
              assign people to them.
            </Text>

            <View
              style={styles.card}
            >
              <Text
                style={
                  styles.cardTitle
                }
              >
                Add Department
              </Text>

              <View
                style={styles.inputRow}
              >
                <TextInput
                  value={
                    newDepartment
                  }
                  onChangeText={
                    setNewDepartment
                  }
                  placeholder="Department name"
                  style={styles.input}
                />

                <Pressable
                  onPress={
                    handleAddDepartment
                  }
                  style={
                    styles.addButton
                  }
                >
                  <Text
                    style={
                      styles.addText
                    }
                  >
                    +
                  </Text>
                </Pressable>
              </View>
            </View>

            <Text
              style={
                styles.sectionTitle
              }
            >
              Departments
            </Text>

            <View
              style={
                styles.departmentWrap
              }
            >
              {departments.map(
                department => {
                  const selected =
                    selectedDepartment
                      ?.id ===
                    department.id;

                  return (
                    <Pressable
                      key={
                        department.id
                      }
                      onPress={() =>
                        handleSelectDepartment(
                          department
                        )
                      }
                      style={[
                        styles.departmentChip,

                        selected &&
                          styles.departmentChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.departmentText,

                          selected &&
                            styles.departmentTextSelected,
                        ]}
                      >
                        {
                          department.name
                        }
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>

            {selectedDepartment && (
              <>
                <View
  style={styles.selectedCard}
>
  <View
    style={styles.selectedHeader}
  >
    <View style={{ flex: 1 }}>
      <Text
        style={
          styles.selectedLabel
        }
      >
        SELECTED DEPARTMENT
      </Text>

      <Text
        style={
          styles.selectedName
        }
      >
        {
          selectedDepartment.name
        }
      </Text>
    </View>

    <Pressable
      onPress={
        handleDeleteDepartment
      }
      style={
        styles.deleteButton
      }
    >
      <Text
        style={
          styles.deleteButtonText
        }
      >
        Delete
      </Text>
    </Pressable>
  </View>
</View>

                <View
                  style={styles.card}
                >
                  <Text
                    style={
                      styles.cardTitle
                    }
                  >
                    Add Person
                  </Text>

                  <Text
                    style={
                      styles.cardSubtitle
                    }
                  >
                    Add person to{' '}
                    {
                      selectedDepartment.name
                    }
                  </Text>

                  <View
                    style={
                      styles.inputRow
                    }
                  >
                    <TextInput
                      value={
                        newPerson
                      }
                      onChangeText={
                        setNewPerson
                      }
                      placeholder="Person name"
                      style={
                        styles.input
                      }
                    />

                    <Pressable
                      onPress={
                        handleAddPerson
                      }
                      style={
                        styles.addButton
                      }
                    >
                      <Text
                        style={
                          styles.addText
                        }
                      >
                        +
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  People
                </Text>
              </>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View
            style={styles.personCard}
          >
            <View
              style={styles.avatar}
            >
              <Text
                style={styles.avatarText}
              >
                {item.name
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>

            <Text
              style={styles.personName}
            >
              {item.name}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          selectedDepartment ? (
            <Text
              style={styles.empty}
            >
              No people added to this
              department yet.
            </Text>
          ) : null
        }
      />
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
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 50,
    },

    back: {
      color: '#166534',
      fontWeight: '700',
      fontSize: 16,
      marginBottom: 18,
    },

    label: {
      color: '#166534',
      fontWeight: '900',
      fontSize: 11,
      letterSpacing: 1.2,
    },

    title: {
      color: '#111827',
      fontSize: 28,
      fontWeight: '900',
      marginTop: 3,
    },

    subtitle: {
      color: '#64748B',
      marginTop: 4,
      marginBottom: 20,
    },

    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 17,
      padding: 16,
      marginBottom: 18,
    },

    cardTitle: {
      color: '#111827',
      fontSize: 15,
      fontWeight: '800',
    },

    cardSubtitle: {
      color: '#94A3B8',
      fontSize: 11,
      marginTop: 3,
      marginBottom: 10,
    },

    inputRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 10,
    },

    input: {
      flex: 1,
      minHeight: 48,
      borderRadius: 13,
      backgroundColor: '#F8FAFC',
      paddingHorizontal: 13,
      borderWidth: 1,
      borderColor: '#E2E8F0',
    },

    addButton: {
      width: 48,
      height: 48,
      backgroundColor: '#166534',
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },

    addText: {
      color: '#FFFFFF',
      fontSize: 25,
      fontWeight: '800',
    },

    sectionTitle: {
      color: '#111827',
      fontWeight: '800',
      fontSize: 16,
      marginBottom: 10,
      marginTop: 5,
    },

    departmentWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 18,
    },

    departmentChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E2E8F0',
    },

    departmentChipSelected: {
      backgroundColor: '#166534',
      borderColor: '#166534',
    },

    departmentText: {
      color: '#475569',
      fontWeight: '700',
    },

    departmentTextSelected: {
      color: '#FFFFFF',
    },

    selectedCard: {
      backgroundColor: '#ECFDF5',
      padding: 14,
      borderRadius: 14,
      marginBottom: 15,
    },

    selectedLabel: {
      color: '#15803D',
      fontSize: 10,
      fontWeight: '800',
    },

    selectedName: {
      color: '#14532D',
      fontSize: 18,
      fontWeight: '900',
      marginTop: 3,
    },

    personCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },

    avatar: {
      width: 39,
      height: 39,
      borderRadius: 12,
      backgroundColor: '#ECFDF5',
      alignItems: 'center',
      justifyContent: 'center',
    },

    avatarText: {
      color: '#166534',
      fontWeight: '900',
    },

    personName: {
      color: '#111827',
      fontWeight: '700',
      fontSize: 15,
      marginLeft: 12,
    },

    empty: {
      color: '#94A3B8',
      textAlign: 'center',
      marginTop: 15,
    },
    selectedHeader: {
  flexDirection: 'row',
  alignItems: 'center',
},

deleteButton: {
  backgroundColor: '#FEE2E2',
  paddingHorizontal: 14,
  paddingVertical: 9,
  borderRadius: 10,
},

deleteButtonText: {
  color: '#B91C1C',
  fontSize: 12,
  fontWeight: '800',
},
  });