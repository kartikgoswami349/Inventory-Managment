import {
    useCallback,
    useState,
} from 'react';

import {
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import {
    router,
    useFocusEffect,
} from 'expo-router';

import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import {
    deactivateInventoryItem,
    getManageInventoryItems,
    ManageInventoryItem,
} from '../repositories/itemManagementRepository';


export default function ManageItemsScreen() {
  const [
    items,
    setItems,
  ] = useState<
    ManageInventoryItem[]
  >([]);

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    loading,
    setLoading,
  ] = useState(false);


  async function loadItems(
    value = search
  ) {
    try {
      setLoading(true);

      const data =
        await getManageInventoryItems(
          value
        );

      setItems(data);

    } catch (error) {
      console.error(
        'MANAGE ITEMS ERROR:',
        error
      );

      Alert.alert(
        'Error',
        'Could not load items.'
      );

    } finally {
      setLoading(false);
    }
  }


  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [])
  );


  async function handleSearch(
    value: string
  ) {
    setSearch(value);

    await loadItems(value);
  }


  function handleEdit(
    item: ManageInventoryItem
  ) {
    router.push({
  pathname: '/edit-item',
  params: {
    itemId: item.id,
  },
});
  }


  function handleDelete(
    item: ManageInventoryItem
  ) {
    Alert.alert(
      'Delete Item',

      `${item.item_name}\n${item.stock_id}\n\nThis item will be removed from active inventory. Existing transactions and audits will be preserved.`,

      [
        {
          text:
            'Cancel',

          style:
            'cancel',
        },

        {
          text:
            'Delete',

          style:
            'destructive',

          onPress:
            async () => {
              try {
                await deactivateInventoryItem(
                  item.id
                );

                await loadItems();

                Alert.alert(
                  'Item Deleted',
                  `${item.item_name} was removed from active inventory.`
                );

              } catch (error) {
                Alert.alert(
                  'Delete Failed',

                  error instanceof Error
                    ? error.message
                    : String(error)
                );
              }
            },
        },
      ]
    );
  }


  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <View style={styles.container}>

        <Text style={styles.label}>
          ADMIN
        </Text>

        <Text style={styles.title}>
          Manage Items
        </Text>

        <Text style={styles.subtitle}>
          Add, edit or remove inventory
          master records.
        </Text>


        <Pressable
          onPress={() =>
            router.push(
              '/add-item'
            )
          }
          style={
            styles.addButton
          }
        >
          <View
            style={
              styles.addIconBox
            }
          >
            <Text
              style={styles.addIcon}
            >
              +
            </Text>
          </View>

          <View
            style={styles.addTextBox}
          >
            <Text
              style={styles.addTitle}
            >
              Add New Item
            </Text>

            <Text
              style={
                styles.addSubtitle
              }
            >
              Create item and opening stock
            </Text>
          </View>

          <Text
            style={styles.arrow}
          >
            ›
          </Text>
        </Pressable>


        <TextInput
          value={search}

          onChangeText={
            handleSearch
          }

          placeholder="Search item, Stock ID or old Item ID"

          placeholderTextColor={
            '#94A3B8'
          }

          style={
            styles.searchInput
          }
        />


        <View
          style={
            styles.listHeader
          }
        >
          <Text
            style={
              styles.listTitle
            }
          >
            Inventory Items
          </Text>

          <Text
            style={
              styles.itemCount
            }
          >
            {items.length}
          </Text>
        </View>


        <FlatList
          data={items}

          keyExtractor={
            item =>
              item.id
          }

          showsVerticalScrollIndicator={
            false
          }

          refreshControl={
            <RefreshControl
              refreshing={loading}

              onRefresh={() =>
                loadItems()
              }

              colors={[
                '#166534',
              ]}
            />
          }

          contentContainerStyle={{
            paddingBottom:
              30,
          }}

          ListEmptyComponent={
            !loading ? (
              <View
                style={
                  styles.emptyBox
                }
              >
                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  No items found
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  Try another search.
                </Text>
              </View>
            ) : null
          }

          renderItem={({
            item,
          }) => (
            <View
              style={
                styles.itemCard
              }
            >
              <View
                style={
                  styles.itemTop
                }
              >
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={
                      styles.stockId
                    }
                  >
                    {item.stock_id}
                  </Text>

                  <Text
                    style={
                      styles.itemName
                    }
                  >
                    {item.item_name}
                  </Text>

                  {!!item.old_item_id && (
                    <Text
                      style={
                        styles.oldItemId
                      }
                    >
                      Old ID:{' '}
                      {item.old_item_id}
                    </Text>
                  )}
                </View>

                <View
                  style={
                    styles.quantityBox
                  }
                >
                  <Text
                    style={
                      styles.quantity
                    }
                  >
                    {item.current_quantity}
                  </Text>

                  <Text
                    style={
                      styles.quantityUnit
                    }
                  >
                    {item.unit}
                  </Text>
                </View>
              </View>


              <View
                style={
                  styles.metaRow
                }
              >
                <Text
                  style={
                    styles.metaText
                  }
                >
                  Min stock:{' '}
                  {item.minimum_stock}
                </Text>
              </View>


              <View
                style={
                  styles.actionRow
                }
              >
                <Pressable
                  onPress={() =>
                    handleEdit(
                      item
                    )
                  }
                  style={
                    styles.editButton
                  }
                >
                  <Text
                    style={
                      styles.editText
                    }
                  >
                    Edit
                  </Text>
                </Pressable>


                <Pressable
                  onPress={() =>
                    handleDelete(
                      item
                    )
                  }
                  style={
                    styles.deleteButton
                  }
                >
                  <Text
                    style={
                      styles.deleteText
                    }
                  >
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        />

      </View>
    </SafeAreaView>
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
      flex: 1,
      backgroundColor:
        '#F5F7F6',

      paddingHorizontal:
        18,

      paddingTop:
        10,
    },

    label: {
      color:
        '#166534',

      fontWeight:
        '900',

      fontSize:
        11,

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

      fontSize:
        13,

      marginTop:
        4,

      marginBottom:
        15,
    },


    addButton: {
      backgroundColor:
        '#14532D',

      borderRadius:
        17,

      minHeight:
        68,

      paddingHorizontal:
        14,

      flexDirection:
        'row',

      alignItems:
        'center',

      marginBottom:
        13,
    },

    addIconBox: {
      width:
        42,

      height:
        42,

      borderRadius:
        13,

      backgroundColor:
        'rgba(255,255,255,0.12)',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    addIcon: {
      color:
        '#FFFFFF',

      fontSize:
        25,

      fontWeight:
        '700',
    },

    addTextBox: {
      flex: 1,

      marginLeft:
        12,
    },

    addTitle: {
      color:
        '#FFFFFF',

      fontSize:
        15,

      fontWeight:
        '800',
    },

    addSubtitle: {
      color:
        '#D1FAE5',

      fontSize:
        11,

      marginTop:
        2,
    },

    arrow: {
      color:
        '#FFFFFF',

      fontSize:
        29,
    },


    searchInput: {
      backgroundColor:
        '#FFFFFF',

      borderRadius:
        14,

      minHeight:
        48,

      paddingHorizontal:
        14,

      fontSize:
        13,

      color:
        '#111827',

      borderWidth:
        1,

      borderColor:
        '#E2E8F0',
    },


    listHeader: {
      marginTop:
        17,

      marginBottom:
        9,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    listTitle: {
      color:
        '#111827',

      fontSize:
        17,

      fontWeight:
        '900',
    },

    itemCount: {
      color:
        '#64748B',

      fontSize:
        12,
    },


    itemCard: {
      backgroundColor:
        '#FFFFFF',

      borderRadius:
        16,

      padding:
        14,

      marginBottom:
        10,

      borderWidth:
        1,

      borderColor:
        '#EEF2F7',

      elevation:
        2,
    },

    itemTop: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',
    },

    stockId: {
      color:
        '#166534',

      fontSize:
        11,

      fontWeight:
        '900',

      letterSpacing:
        0.6,
    },

    itemName: {
      color:
        '#111827',

      fontSize:
        15,

      fontWeight:
        '800',

      marginTop:
        3,
    },

    oldItemId: {
      color:
        '#94A3B8',

      fontSize:
        10,

      marginTop:
        3,
    },


    quantityBox: {
      minWidth:
        62,

      alignItems:
        'flex-end',
    },

    quantity: {
      color:
        '#111827',

      fontSize:
        22,

      fontWeight:
        '900',
    },

    quantityUnit: {
      color:
        '#64748B',

      fontSize:
        10,

      marginTop:
        1,
    },


    metaRow: {
      marginTop:
        8,
    },

    metaText: {
      color:
        '#64748B',

      fontSize:
        11,
    },


    actionRow: {
      flexDirection:
        'row',

      marginTop:
        12,

      gap:
        8,
    },

    editButton: {
      flex: 1,

      backgroundColor:
        '#ECFDF5',

      paddingVertical:
        9,

      borderRadius:
        10,

      alignItems:
        'center',
    },

    editText: {
      color:
        '#166534',

      fontWeight:
        '800',

      fontSize:
        12,
    },

    deleteButton: {
      flex: 1,

      backgroundColor:
        '#FEE2E2',

      paddingVertical:
        9,

      borderRadius:
        10,

      alignItems:
        'center',
    },

    deleteText: {
      color:
        '#B91C1C',

      fontWeight:
        '800',

      fontSize:
        12,
    },


    emptyBox: {
      paddingVertical:
        50,

      alignItems:
        'center',
    },

    emptyTitle: {
      color:
        '#111827',

      fontWeight:
        '800',

      fontSize:
        16,
    },

    emptyText: {
      color:
        '#94A3B8',

      marginTop:
        4,

      fontSize:
        12,
    },
  });