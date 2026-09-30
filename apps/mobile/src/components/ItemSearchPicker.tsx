import {
    useRef,
    useState,
} from 'react';

import {
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import {
    InventorySearchItem,
    searchInventoryItems,
} from '../repositories/itemRepository';


interface Props {
  title: string;

  subtitle: string;

  onSelect:
    (
      item:
        InventorySearchItem
    ) => void;

  onScanPress:
    () => void;
}


export default function ItemSearchPicker({
  title,
  subtitle,
  onSelect,
  onScanPress,
}: Props) {

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    results,
    setResults,
  ] = useState<
    InventorySearchItem[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const requestNumber =
    useRef(0);


  async function handleSearch(
    value: string
  ) {

    setSearch(value);

    const currentRequest =
      ++requestNumber.current;


    if (!value.trim()) {
      setResults([]);
      setLoading(false);

      return;
    }


    try {
      setLoading(true);

      const data =
        await searchInventoryItems(
          value
        );


      if (
        currentRequest ===
        requestNumber.current
      ) {
        setResults(data);
      }

    } catch (error) {

      console.error(
        'ITEM SEARCH ERROR:',
        error
      );

    } finally {

      if (
        currentRequest ===
        requestNumber.current
      ) {
        setLoading(false);
      }
    }
  }


  return (
    <View style={styles.container}>

      <View style={styles.header}>

        <Text style={styles.brand}>
          R58 INVENTORY
        </Text>

        <Text style={styles.title}>
          {title}
        </Text>

        <Text style={styles.subtitle}>
          {subtitle}
        </Text>

      </View>


      <View style={styles.modeRow}>

        <Pressable
          onPress={onScanPress}
          style={
            styles.scanModeButton
          }
        >
          <Text
            style={
              styles.scanModeText
            }
          >
            Scan QR
          </Text>
        </Pressable>


        <View
          style={
            styles.searchModeButton
          }
        >
          <Text
            style={
              styles.searchModeText
            }
          >
            Search Item
          </Text>
        </View>

      </View>


      <TextInput
        value={search}

        onChangeText={
          handleSearch
        }

        placeholder={
          'Search name, Stock ID or Old Item ID'
        }

        placeholderTextColor={
          '#94A3B8'
        }

        autoFocus

        autoCapitalize="none"

        style={styles.searchInput}
      />


      {!search.trim() && (
        <View style={styles.helpBox}>

          <Text
            style={
              styles.helpTitle
            }
          >
            Find an inventory item
          </Text>

          <Text
            style={
              styles.helpText
            }
          >
            Start typing the item name,
            R58 Stock ID or old Item ID.
          </Text>

        </View>
      )}


      {loading && (
        <Text
          style={
            styles.loadingText
          }
        >
          Searching...
        </Text>
      )}


      {!loading &&
        search.trim() &&
        results.length === 0 && (

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
              No item found
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Try another name or ID.
            </Text>
          </View>
        )}


      <FlatList
        data={results}

        keyExtractor={
          item =>
            item.id
        }

        keyboardShouldPersistTaps="handled"

        showsVerticalScrollIndicator={
          false
        }

        contentContainerStyle={{
          paddingBottom:
            30,
        }}

        renderItem={({
          item,
        }) => (

          <Pressable
            onPress={() =>
              onSelect(item)
            }

            style={({ pressed }) => [
              styles.itemCard,

              pressed &&
                styles.itemPressed,
            ]}
          >

            <View
              style={
                styles.itemMain
              }
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
                    styles.oldItem
                  }
                >
                  Old ID:{' '}
                  {item.old_item_id}
                </Text>
              )}

            </View>


            <View
              style={
                styles.stockBox
              }
            >

              <Text
                style={
                  styles.stockNumber
                }
              >
                {item.current_stock}
              </Text>

              <Text
                style={
                  styles.stockUnit
                }
              >
                {item.unit}
              </Text>

            </View>


            <Text
              style={
                styles.arrow
              }
            >
              ›
            </Text>

          </Pressable>
        )}
      />

    </View>
  );
}


const styles =
  StyleSheet.create({

    container: {
      flex: 1,

      backgroundColor:
        '#F5F7F6',

      paddingHorizontal:
        18,

      paddingTop:
        55,
    },


    header: {
      marginBottom:
        18,
    },

    brand: {
      color:
        '#166534',

      fontSize:
        11,

      fontWeight:
        '900',

      letterSpacing:
        1.4,
    },

    title: {
      color:
        '#111827',

      fontSize:
        29,

      fontWeight:
        '900',

      marginTop:
        4,
    },

    subtitle: {
      color:
        '#64748B',

      fontSize:
        13,

      marginTop:
        3,
    },


    modeRow: {
      flexDirection:
        'row',

      backgroundColor:
        '#E2E8F0',

      borderRadius:
        13,

      padding:
        4,

      marginBottom:
        14,
    },

    scanModeButton: {
      flex: 1,

      minHeight:
        41,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        10,
    },

    scanModeText: {
      color:
        '#64748B',

      fontSize:
        12,

      fontWeight:
        '800',
    },

    searchModeButton: {
      flex: 1,

      minHeight:
        41,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        10,

      backgroundColor:
        '#FFFFFF',
    },

    searchModeText: {
      color:
        '#166534',

      fontSize:
        12,

      fontWeight:
        '900',
    },


    searchInput: {
      backgroundColor:
        '#FFFFFF',

      minHeight:
        52,

      borderRadius:
        14,

      borderWidth:
        1,

      borderColor:
        '#E2E8F0',

      paddingHorizontal:
        15,

      color:
        '#111827',

      fontSize:
        14,

      marginBottom:
        13,
    },


    helpBox: {
      backgroundColor:
        '#ECFDF5',

      borderRadius:
        14,

      padding:
        15,

      marginTop:
        5,
    },

    helpTitle: {
      color:
        '#166534',

      fontWeight:
        '800',

      fontSize:
        13,
    },

    helpText: {
      color:
        '#64748B',

      fontSize:
        11,

      lineHeight:
        17,

      marginTop:
        4,
    },


    loadingText: {
      textAlign:
        'center',

      color:
        '#64748B',

      marginTop:
        25,
    },


    itemCard: {
      backgroundColor:
        '#FFFFFF',

      borderRadius:
        15,

      minHeight:
        78,

      marginBottom:
        9,

      paddingHorizontal:
        14,

      paddingVertical:
        11,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderWidth:
        1,

      borderColor:
        '#EEF2F7',

      elevation:
        2,
    },

    itemPressed: {
      opacity:
        0.7,
    },


    itemMain: {
      flex: 1,
    },

    stockId: {
      color:
        '#166534',

      fontSize:
        10,

      fontWeight:
        '900',

      letterSpacing:
        0.5,
    },

    itemName: {
      color:
        '#111827',

      fontSize:
        14,

      fontWeight:
        '800',

      marginTop:
        3,
    },

    oldItem: {
      color:
        '#94A3B8',

      fontSize:
        10,

      marginTop:
        2,
    },


    stockBox: {
      minWidth:
        50,

      alignItems:
        'flex-end',

      marginLeft:
        8,
    },

    stockNumber: {
      color:
        '#111827',

      fontSize:
        19,

      fontWeight:
        '900',
    },

    stockUnit: {
      color:
        '#64748B',

      fontSize:
        9,

      marginTop:
        1,
    },


    arrow: {
      color:
        '#94A3B8',

      fontSize:
        28,

      marginLeft:
        9,
    },


    emptyBox: {
      marginTop:
        40,

      alignItems:
        'center',
    },

    emptyTitle: {
      color:
        '#111827',

      fontSize:
        15,

      fontWeight:
        '800',
    },

    emptyText: {
      color:
        '#94A3B8',

      fontSize:
        11,

      marginTop:
        3,
    },
  });