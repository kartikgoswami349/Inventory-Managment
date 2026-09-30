import {
    useEffect,
    useRef,
    useState,
} from 'react';

import {
    Alert,
    Animated,
    Easing,
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
    CameraView,
    useCameraPermissions,
} from 'expo-camera';

import {
    router,
} from 'expo-router';

import {
    getItemById,
    getItemByQr,
    InventorySearchItem,
    searchInventoryItems,
} from '../repositories/itemRepository';

import {
    createTransactionBatch,
} from '../repositories/transactionRepository';

import {
    getDeviceId,
} from '../services/deviceService';

import {
    requestImmediateSync,
} from '../services/autoSyncService';

import {
    addScannedItemToDraft,
    clearTransactionDraft,
    getTotalScannedCount,
    getTransactionDraft,
    removeOneFromDraft,
    TransactionDraftItem,
} from '../services/transactionDraftService';


type ScanState =
  | 'READY'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'ERROR';


interface SavedSummaryItem {
  itemName: string;
  unit: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
}


interface AddableItem {
  id: string;
  stock_id: string;
  old_item_id: string | null;
  item_name: string;
  unit: string;
  current_stock: number;
}


export default function TransactionScanScreen() {

  const [
    permission,
    requestPermission,
  ] =
    useCameraPermissions();


  const [
    draft,
    setDraft,
  ] =
    useState(
      getTransactionDraft()
    );


  const [
    scanLocked,
    setScanLocked,
  ] =
    useState(false);


  const [
    scanState,
    setScanState,
  ] =
    useState<ScanState>(
      'READY'
    );


  const [
    scanMessage,
    setScanMessage,
  ] =
    useState(
      'Ready for next item'
    );


  const [
    lastScannedItem,
    setLastScannedItem,
  ] =
    useState('');


  const [
    saving,
    setSaving,
  ] =
    useState(false);


  const [
    summary,
    setSummary,
  ] =
    useState<
      SavedSummaryItem[]
    >([]);


  const [
    summaryVisible,
    setSummaryVisible,
  ] =
    useState(false);


  /*
    SEARCH
  */

  const [
    searchVisible,
    setSearchVisible,
  ] =
    useState(false);


  const [
    searchText,
    setSearchText,
  ] =
    useState('');


  const [
    searchResults,
    setSearchResults,
  ] =
    useState<
      InventorySearchItem[]
    >([]);


  const [
    searchLoading,
    setSearchLoading,
  ] =
    useState(false);


  /*
    SCANNER ANIMATION
  */

  const scanLine =
    useRef(
      new Animated.Value(0)
    ).current;


  const pulse =
    useRef(
      new Animated.Value(1)
    ).current;


  const scanTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > |
      null
    >(null);


  /*
    Prevent extremely fast duplicate
    reads from consecutive camera frames.
  */

  const lastScanRef =
    useRef<{
      code: string;
      time: number;
    }>({
      code: '',
      time: 0,
    });


  useEffect(() => {

    if (
      scanState !== 'READY'
    ) {

      scanLine.stopAnimation();

      scanLine.setValue(0);

      return;
    }


    const animation =
      Animated.loop(

        Animated.sequence([

          Animated.timing(
            scanLine,
            {
              toValue: 1,
              duration: 1500,
              easing:
                Easing.inOut(
                  Easing.ease
                ),
              useNativeDriver:
                true,
            }
          ),

          Animated.timing(
            scanLine,
            {
              toValue: 0,
              duration: 1500,
              easing:
                Easing.inOut(
                  Easing.ease
                ),
              useNativeDriver:
                true,
            }
          ),

        ])
      );


    animation.start();


    return () => {

      animation.stop();

    };

  }, [
    scanState,
    scanLine,
  ]);


  useEffect(() => {

    if (
      scanState !==
        'SUCCESS'
    ) {

      pulse.setValue(1);

      return;
    }


    Animated.sequence([

      Animated.timing(
        pulse,
        {
          toValue: 1.08,
          duration: 150,
          useNativeDriver:
            true,
        }
      ),

      Animated.timing(
        pulse,
        {
          toValue: 1,
          duration: 180,
          useNativeDriver:
            true,
        }
      ),

    ]).start();

  }, [
    scanState,
    pulse,
  ]);


  /*
    SEARCH DEBOUNCE
  */

  useEffect(() => {

    const clean =
      searchText.trim();


    if (!clean) {

      setSearchResults([]);

      setSearchLoading(false);

      return;
    }


    const timer =
      setTimeout(
        async () => {

          try {

            setSearchLoading(
              true
            );


            const results =
              await searchInventoryItems(
                clean
              );


            setSearchResults(
              results
            );

          } catch (error) {

            console.error(
              'SEARCH ITEM ERROR:',
              error
            );

            setSearchResults([]);

          } finally {

            setSearchLoading(
              false
            );
          }

        },
        250
      );


    return () => {

      clearTimeout(
        timer
      );

    };

  }, [
    searchText,
  ]);


  useEffect(() => {

    return () => {

      if (
        scanTimerRef.current
      ) {

        clearTimeout(
          scanTimerRef.current
        );
      }

    };

  }, []);


  function refreshDraft() {

    setDraft(
      getTransactionDraft()
    );
  }


  function getStateColor() {

    switch (
      scanState
    ) {

      case 'PROCESSING':
        return '#F59E0B';

      case 'SUCCESS':
        return '#22C55E';

      case 'ERROR':
        return '#EF4444';

      default:
        return '#38BDF8';
    }
  }


  function returnScannerToReady(
    delay = 1200
  ) {

    if (
      scanTimerRef.current
    ) {

      clearTimeout(
        scanTimerRef.current
      );
    }


    scanTimerRef.current =
      setTimeout(
        () => {

          setScanState(
            'READY'
          );

          setScanMessage(
            'Ready for next item'
          );

          setLastScannedItem('');

          setScanLocked(
            false
          );

        },
        delay
      );
  }


  /*
    Common function used by BOTH:

    QR scanner
    Search Item
  */

  function addItem(
    item: AddableItem
  ) {

    const result =
      addScannedItemToDraft({

        itemId:
          item.id,

        stockId:
          item.stock_id,

        oldItemId:
          item.old_item_id,

        itemName:
          item.item_name,

        unit:
          item.unit,

        currentStock:
          item.current_stock,
      });


    if (!result.success) {

      if (
        result.reason ===
          'INSUFFICIENT_STOCK'
      ) {

        setScanState(
          'ERROR'
        );

        setLastScannedItem(
          item.item_name
        );

        setScanMessage(
          `Stock limit reached • ${result.available} ${item.unit} available`
        );


        Alert.alert(

          'Insufficient Stock',

          `${item.item_name}\n\n` +

          `Available: ${result.available} ${item.unit}\n` +

          `Already added: ${result.alreadyScanned} ${item.unit}`

        );
      }


      return false;
    }


    refreshDraft();


    setScanState(
      'SUCCESS'
    );

    setLastScannedItem(
      item.item_name
    );

    setScanMessage(
      `Added successfully • Quantity ${result.count}`
    );


    return true;
  }


  async function
    handleBarcodeScanned(
      result: {
        data: string;
      }
    ) {

    if (
      scanLocked ||
      searchVisible ||
      summaryVisible
    ) {

      return;
    }


    const code =
      result.data.trim();


    if (!code) {
      return;
    }


    const now =
      Date.now();


    /*
      Prevent a QR from being counted
      several times in consecutive
      camera frames.

      The visible pause also gives the
      operator time to move the item away.
    */

    if (
      lastScanRef.current.code ===
        code &&
      now -
        lastScanRef.current.time <
        800
    ) {

      return;
    }


    lastScanRef.current = {
      code,
      time: now,
    };


    setScanLocked(
      true
    );

    setScanState(
      'PROCESSING'
    );

    setLastScannedItem('');

    setScanMessage(
      'Reading item...'
    );


    try {

      const item =
        await getItemByQr(
          code
        );


      if (!item) {

        setScanState(
          'ERROR'
        );

        setScanMessage(
          'Item not found'
        );


        Alert.alert(

          'Item Not Found',

          `No active inventory item found for:\n${code}`

        );


        returnScannerToReady(
          800
        );

        return;
      }


      const added =
        addItem(
          item
        );


      if (!added) {

        returnScannerToReady(
          1600
        );

        return;
      }


      /*
        Keep SUCCESS state visible.

        This is intentionally slower than
        the old scanner so the operator can
        clearly see that one physical item
        was counted.
      */

      returnScannerToReady(
        1300
      );


    } catch (error) {

      setScanState(
        'ERROR'
      );

      setScanMessage(
        'Unable to read item'
      );


      Alert.alert(
        'Scan Error',
        String(error)
      );


      returnScannerToReady(
        1600
      );
    }
  }


  function removeOne(
    itemId: string
  ) {

    removeOneFromDraft(
      itemId
    );


    refreshDraft();
  }


  /*
    SEARCH ITEM ADD

    One tap = one physical item.

    So selecting the same item again
    from Search increases its count
    exactly like scanning it again.
  */

  function addSearchItem(
    item:
      InventorySearchItem
  ) {

    Keyboard.dismiss();


    setScanState(
      'PROCESSING'
    );

    setScanMessage(
      'Adding searched item...'
    );


    const added =
      addItem({
        id:
          item.id,

        stock_id:
          item.stock_id,

        old_item_id:
          item.old_item_id,

        item_name:
          item.item_name,

        unit:
          item.unit,

        current_stock:
          item.current_stock,
      });


    if (added) {

      setSearchVisible(
        false
      );

      setSearchText('');

      setSearchResults([]);


      returnScannerToReady(
        1200
      );

    } else {

      returnScannerToReady(
        1500
      );
    }
  }


  async function saveTransaction() {

    const currentDraft =
      getTransactionDraft();


    if (
      !currentDraft ||
      currentDraft.items.length ===
        0
    ) {

      Alert.alert(
        'No Items',
        'Scan or search at least one item before saving.'
      );

      return;
    }


    try {

      setSaving(
        true
      );


      const validatedItems:
        Array<{
          draftItem:
            TransactionDraftItem;

          stockBefore:
            number;

          stockAfter:
            number;
        }> =
        [];


      /*
        Re-check stock immediately
        before saving.
      */

      for (
        const draftItem
        of currentDraft.items
      ) {

        const latest =
          await getItemById(
            draftItem.itemId
          );


        if (!latest) {

          throw new Error(
            `${draftItem.itemName} no longer exists or is inactive.`
          );
        }


        if (
          currentDraft.type ===
            'ISSUED' &&
          draftItem.count >
            latest.current_stock
        ) {

          Alert.alert(

            'Stock Changed',

            `${draftItem.itemName}\n\n` +

            `Added: ${draftItem.count} ${draftItem.unit}\n` +

            `Available now: ${latest.current_stock} ${draftItem.unit}\n\n` +

            'Use Remove One and try again.'

          );


          return;
        }


        const stockBefore =
          latest.current_stock;


        const stockAfter =
          currentDraft.type ===
            'ISSUED'

            ? stockBefore -
              draftItem.count

            : stockBefore +
              draftItem.count;


        validatedItems.push({

          draftItem,

          stockBefore,

          stockAfter,
        });
      }


      const deviceId =
        await getDeviceId();


      /*
        Keep existing transaction system.

        One database transaction row
        for each DIFFERENT item.

        Quantity = number of scans/search adds.
      */

      await createTransactionBatch(

  validatedItems.map(
    row => ({

      itemId:
        row.draftItem.itemId,

      quantity:
        row.draftItem.count,
    })
  ),

  currentDraft.type,

  deviceId,

  currentDraft.remark ||
    undefined,

  currentDraft.departmentId,

  currentDraft.personId ===
    'OTHER'
    ? null
    : currentDraft.personId,

  currentDraft.personId ===
    'OTHER'
    ? currentDraft.otherName
    : null
);


      /*
        Sync only once after all
        local saves complete.
      */

      requestImmediateSync();


      setSummary(

        validatedItems.map(
          row => ({

            itemName:
              row.draftItem.itemName,

            unit:
              row.draftItem.unit,

            quantity:
              row.draftItem.count,

            stockBefore:
              row.stockBefore,

            stockAfter:
              row.stockAfter,
          })
        )
      );


      setSummaryVisible(
        true
      );


    } catch (error) {

      Alert.alert(
        'Transaction Error',
        String(error)
      );

    } finally {

      setSaving(
        false
      );
    }
  }


  function finishTransaction() {

    clearTransactionDraft();


    setSummaryVisible(
      false
    );


    router.replace('/');
  }


  if (!draft) {

    return (

      <View
        style={
          styles.center
        }
      >

        <Text
          style={
            styles.errorTitle
          }
        >
          No active transaction
        </Text>


        <Pressable

          style={
            styles.primaryButton
          }

          onPress={() =>
            router.replace(
              '/new-transaction'
            )
          }
        >

          <Text
            style={
              styles.primaryButtonText
            }
          >
            Start New Transaction
          </Text>

        </Pressable>

      </View>
    );
  }


  if (!permission) {

    return (

      <View
        style={
          styles.center
        }
      >

        <Text>
          Loading camera...
        </Text>

      </View>
    );
  }


  if (!permission.granted) {

    return (

      <View
        style={
          styles.center
        }
      >

        <Text
          style={
            styles.errorTitle
          }
        >
          Camera Permission Required
        </Text>


        <Pressable

          style={
            styles.primaryButton
          }

          onPress={
            requestPermission
          }
        >

          <Text
            style={
              styles.primaryButtonText
            }
          >
            Allow Camera
          </Text>

        </Pressable>

      </View>
    );
  }


  const totalScans =
    getTotalScannedCount();


  const scannerColor =
    getStateColor();


  const translatedScanLine =
    scanLine.interpolate({
      inputRange: [
        0,
        1,
      ],

      outputRange: [
        0,
        204,
      ],
    });


  return (

    <View
      style={
        styles.container
      }
    >

      {/* HEADER */}

      <View
        style={
          styles.header
        }
      >

        <View
          style={
            styles.headerTop
          }
        >

          <View>

            <Text
              style={[
                styles.mode,
                {
                  color:
                    draft.type ===
                      'ISSUED'

                      ? '#B91C1C'
                      : '#166534',
                },
              ]}
            >
              {
                draft.type ===
                  'ISSUED'
                  ? 'ISSUE'
                  : 'RECEIVE'
              }
            </Text>


            <Text
              style={
                styles.person
              }
            >
              {
                draft.departmentName
              }

              {' • '}

              {
                draft.personName
              }
            </Text>

          </View>


          <Pressable

            style={
              styles.searchButton
            }

            onPress={() => {

              setSearchVisible(
                true
              );

              setSearchText('');

              setSearchResults([]);
            }}
          >

            <Text
              style={
                styles.searchButtonText
              }
            >
              🔎 Search Item
            </Text>

          </Pressable>

        </View>

      </View>


      {/* CAMERA */}

      <View
        style={
          styles.cameraContainer
        }
      >

        <CameraView

          style={
            StyleSheet.absoluteFill
          }

          facing="back"

          barcodeScannerSettings={{
            barcodeTypes: [
              'qr',
            ],
          }}

          onBarcodeScanned={
            (
              scanLocked ||
              searchVisible ||
              summaryVisible
            )

              ? undefined

              : handleBarcodeScanned
          }

        />


        {/* DARK CAMERA OVERLAY */}

        <View
          pointerEvents="none"
          style={
            styles.cameraShade
          }
        />


        {/* SCANNER FRAME */}

        {/* MODERN SCANNER FRAME */}

<View
  pointerEvents="none"
  style={styles.cameraHint}
>
  <Text style={styles.cameraHintText}>
    Position QR code inside the frame
  </Text>
</View>


<Animated.View
  pointerEvents="none"
  style={[
    styles.scanFrame,
    {
      transform: [
        {
          scale: pulse,
        },
      ],
    },
  ]}
>

  {/* CORNERS */}

  <View
    style={[
      styles.scanCorner,
      styles.cornerTopLeft,
      {
        borderColor: scannerColor,
      },
    ]}
  />

  <View
    style={[
      styles.scanCorner,
      styles.cornerTopRight,
      {
        borderColor: scannerColor,
      },
    ]}
  />

  <View
    style={[
      styles.scanCorner,
      styles.cornerBottomLeft,
      {
        borderColor: scannerColor,
      },
    ]}
  />

  <View
    style={[
      styles.scanCorner,
      styles.cornerBottomRight,
      {
        borderColor: scannerColor,
      },
    ]}
  />


  {/* MOVING SCAN LINE */}

  {scanState === 'READY' && (
    <Animated.View
      style={[
        styles.scanLine,
        {
          backgroundColor:
            scannerColor,

          transform: [
            {
              translateY:
                translatedScanLine,
            },
          ],
        },
      ]}
    />
  )}


  {/* READY */}

  {scanState === 'READY' && (
    <View style={styles.readyCenter}>

      <Text style={styles.qrIcon}>
        ▦
      </Text>

      <Text style={styles.readyText}>
        Scan QR
      </Text>

    </View>
  )}


  {/* PROCESSING */}

  {scanState === 'PROCESSING' && (
    <View
      style={
        styles.processingCenter
      }
    >

      <Text
        style={
          styles.processingIcon
        }
      >
        ◌
      </Text>

      <Text
        style={
          styles.processingText
        }
      >
        Reading...
      </Text>

    </View>
  )}


  {/* SUCCESS */}

  {scanState === 'SUCCESS' && (
    <View
      style={
        styles.successCenter
      }
    >

      <Text
        style={
          styles.successIcon
        }
      >
        ✓
      </Text>

      <Text
        style={
          styles.successCameraText
        }
      >
        ITEM ADDED
      </Text>

    </View>
  )}


  {/* ERROR */}

  {scanState === 'ERROR' && (
    <View
      style={
        styles.errorCenter
      }
    >

      <Text
        style={
          styles.errorIcon
        }
      >
        !
      </Text>

      <Text
        style={
          styles.errorCameraText
        }
      >
        CHECK ITEM
      </Text>

    </View>
  )}

</Animated.View>


        {/* STATUS BAR */}

        <View
          style={[
            styles.scanStatus,

            {
              borderColor:
                scannerColor,
            },
          ]}
        >

          <View
            style={[
              styles.statusDot,

              {
                backgroundColor:
                  scannerColor,
              },
            ]}
          />


          <View
            style={
              styles.statusTextBox
            }
          >

            <Text
              style={
                styles.scanStatusText
              }
            >
              {
                scanMessage
              }
            </Text>


            {
              lastScannedItem
                ? (

                  <Text
                    numberOfLines={
                      1
                    }

                    style={
                      styles.lastItemText
                    }
                  >
                    {
                      lastScannedItem
                    }
                  </Text>
                )

                : null
            }

          </View>

        </View>

      </View>


      {/* COUNTERS */}

      <View
        style={
          styles.countRow
        }
      >

        <View
          style={
            styles.counter
          }
        >

          <Text
            style={
              styles.countNumber
            }
          >
            {
              draft.items.length
            }
          </Text>

          <Text
            style={
              styles.countLabel
            }
          >
            Different Items
          </Text>

        </View>


        <View
          style={
            styles.counterDivider
          }
        />


        <View
          style={
            styles.counter
          }
        >

          <Text
            style={
              styles.countNumber
            }
          >
            {
              totalScans
            }
          </Text>

          <Text
            style={
              styles.countLabel
            }
          >
            Total Items
          </Text>

        </View>

      </View>


      {/* SCANNED ITEMS */}

      <ScrollView

        style={
          styles.itemList
        }

        contentContainerStyle={{
          paddingBottom: 20,
        }}
      >

        {
          draft.items.length ===
            0 && (

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
                No items added yet
              </Text>

              <Text
                style={
                  styles.empty
                }
              >
                Scan a QR code or use Search Item.
              </Text>

            </View>
          )
        }


        {
          draft.items.map(
            item => (

              <View

                key={
                  item.itemId
                }

                style={
                  styles.itemCard
                }
              >

                <View
                  style={
                    styles.itemInfo
                  }
                >

                  <Text
                    style={
                      styles.stockId
                    }
                  >
                    {
                      item.stockId
                    }
                  </Text>


                  <Text
                    style={
                      styles.itemName
                    }
                  >
                    {
                      item.itemName
                    }
                  </Text>


                  <Text
                    style={
                      styles.quantity
                    }
                  >
                    × {item.count}
                    {' '}
                    {item.unit}
                  </Text>

                </View>


                <Pressable

                  style={
                    styles.removeButton
                  }

                  onPress={() =>
                    removeOne(
                      item.itemId
                    )
                  }
                >

                  <Text
                    style={
                      styles.removeButtonText
                    }
                  >
                    Remove One
                  </Text>

                </Pressable>

              </View>
            )
          )
        }

      </ScrollView>


      {/* FOOTER */}

      <View
        style={
          styles.footer
        }
      >

        <Pressable

          style={
            styles.footerSearchButton
          }

          onPress={() => {

            setSearchVisible(
              true
            );

            setSearchText('');

            setSearchResults([]);
          }}
        >

          <Text
            style={
              styles.footerSearchText
            }
          >
            🔎 Search Item
          </Text>

        </Pressable>


        <Pressable

          disabled={
            saving ||
            draft.items.length ===
              0
          }

          style={[
            styles.saveButton,

            (
              saving ||
              draft.items.length ===
                0
            ) &&
              styles.disabled,
          ]}

          onPress={
            saveTransaction
          }
        >

          <Text
            style={
              styles.saveButtonText
            }
          >
            {
              saving
                ? 'Saving...'
                : 'Save Transaction'
            }
          </Text>

        </Pressable>

      </View>


      {/* SEARCH MODAL */}

      <Modal

        visible={
          searchVisible
        }

        transparent

        animationType="slide"

        onRequestClose={() =>
          setSearchVisible(
            false
          )
        }
      >

        <View
          style={
            styles.searchOverlay
          }
        >

          <View
            style={
              styles.searchModal
            }
          >

            <View
              style={
                styles.searchHeader
              }
            >

              <View>

                <Text
                  style={
                    styles.searchTitle
                  }
                >
                  Search Item
                </Text>

                <Text
                  style={
                    styles.searchSubtitle
                  }
                >
                  One selection = one item
                </Text>

              </View>


              <Pressable

                style={
                  styles.closeButton
                }

                onPress={() => {

                  Keyboard.dismiss();

                  setSearchVisible(
                    false
                  );
                }}
              >

                <Text
                  style={
                    styles.closeButtonText
                  }
                >
                  ✕
                </Text>

              </Pressable>

            </View>


            <TextInput

              autoFocus

              value={
                searchText
              }

              onChangeText={
                setSearchText
              }

              placeholder="Item name, Stock ID or Old ID"

              style={
                styles.searchInput
              }

            />


            {
              searchLoading && (

                <Text
                  style={
                    styles.searchHint
                  }
                >
                  Searching...
                </Text>
              )
            }


            {
              !searchLoading &&
              searchText.trim() !==
                '' &&
              searchResults.length ===
                0 && (

                <Text
                  style={
                    styles.searchHint
                  }
                >
                  No matching item found.
                </Text>
              )
            }


            <ScrollView

              style={
                styles.searchResults
              }

              keyboardShouldPersistTaps="handled"
            >

              {
                searchResults.map(
                  item => (

                    <Pressable

                      key={
                        item.id
                      }

                      style={
                        styles.searchResult
                      }

                      onPress={() =>
                        addSearchItem(
                          item
                        )
                      }
                    >

                      <View
                        style={
                          styles.searchResultInfo
                        }
                      >

                        <Text
                          style={
                            styles.searchStockId
                          }
                        >
                          {
                            item.stock_id
                          }
                        </Text>


                        <Text
                          style={
                            styles.searchItemName
                          }
                        >
                          {
                            item.item_name
                          }
                        </Text>


                        {
                          item.old_item_id
                            ? (

                              <Text
                                style={
                                  styles.searchOldId
                                }
                              >
                                Old ID: {
                                  item.old_item_id
                                }
                              </Text>
                            )

                            : null
                        }


                        <Text
                          style={
                            styles.searchStock
                          }
                        >
                          Stock: {
                            item.current_stock
                          } {
                            item.unit
                          }
                        </Text>

                      </View>


                      <View
                        style={
                          styles.addOneBadge
                        }
                      >

                        <Text
                          style={
                            styles.addOneBadgeText
                          }
                        >
                          +1
                        </Text>

                      </View>

                    </Pressable>
                  )
                )
              }

            </ScrollView>

          </View>

        </View>

      </Modal>


      {/* FINAL SUMMARY */}

      <Modal

        visible={
          summaryVisible
        }

        transparent

        animationType="fade"
      >

        <View
          style={
            styles.summaryOverlay
          }
        >

          <View
            style={
              styles.summaryCard
            }
          >

            <Text
              style={
                styles.successTitle
              }
            >
              ✓ Transaction Saved
            </Text>


            <Text
              style={
                styles.summaryHeader
              }
            >
              {
                draft.type ===
                  'ISSUED'
                  ? 'ISSUED'
                  : 'RECEIVED'
              }
            </Text>


            <Text
              style={
                styles.summaryPerson
              }
            >
              {
                draft.departmentName
              }

              {' • '}

              {
                draft.personName
              }
            </Text>


            <ScrollView
              style={
                styles.summaryList
              }
            >

              {
                summary.map(
                  (
                    item,
                    index
                  ) => (

                    <View

                      key={
                        `${item.itemName}-${index}`
                      }

                      style={
                        styles.summaryItem
                      }
                    >

                      <Text
                        style={
                          styles.summaryItemName
                        }
                      >
                        {
                          item.itemName
                        }
                      </Text>


                      <Text
                        style={
                          styles.summaryText
                        }
                      >
                        Quantity: {
                          item.quantity
                        } {
                          item.unit
                        }
                      </Text>


                      <Text
                        style={
                          styles.summaryText
                        }
                      >
                        Before: {
                          item.stockBefore
                        }

                        {'  →  '}

                        After: {
                          item.stockAfter
                        }
                      </Text>

                    </View>
                  )
                )
              }

            </ScrollView>


            <Pressable

              style={
                styles.primaryButton
              }

              onPress={
                finishTransaction
              }
            >

              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Done
              </Text>

            </Pressable>

          </View>

        </View>

      </Modal>

    </View>
  );
}


const styles =
  StyleSheet.create({

    container: {
      flex: 1,
      backgroundColor:
        '#F4F6F8',
    },

    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 25,
      backgroundColor:
        '#F4F6F8',
    },

    header: {
      paddingTop: 47,
      paddingHorizontal: 18,
      paddingBottom: 13,
      backgroundColor:
        '#FFFFFF',
    },

    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      gap: 12,
    },

    mode: {
      fontSize: 20,
      fontWeight: '900',
    },

    person: {
      marginTop: 3,
      color: '#475569',
      fontSize: 14,
      fontWeight: '700',
    },

    searchButton: {
      backgroundColor:
        '#EFF6FF',
      borderRadius: 12,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },

    searchButtonText: {
      color: '#1D4ED8',
      fontWeight: '800',
      fontSize: 13,
    },

    cameraContainer: {
      height: 320,
      backgroundColor:
        '#000000',
      overflow: 'hidden',
    },

    cameraShade: {
  ...StyleSheet.absoluteFill,
  backgroundColor: 'rgba(0,0,0,0.08)',
},

    scanFrame: {
      position: 'absolute',
      alignSelf: 'center',
      top: 34,
      width: 232,
      height: 232,
      borderWidth: 4,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor:
        'rgba(0,0,0,0.06)',
    },

    scanLine: {
      position: 'absolute',
      top: 8,
      left: 10,
      right: 10,
      height: 3,
      borderRadius: 3,
      shadowOpacity: 0.9,
      shadowRadius: 8,
      elevation: 5,
    },

    processingCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(245,158,11,0.15)',
    },

    processingIcon: {
      color: '#F59E0B',
      fontSize: 70,
      fontWeight: '300',
    },

    processingText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '900',
      marginTop: 3,
    },

    successCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(34,197,94,0.20)',
    },

    successIcon: {
      color: '#22C55E',
      fontSize: 78,
      fontWeight: '900',
    },

    successCameraText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 1,
    },

    errorCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(239,68,68,0.20)',
    },

    errorIcon: {
      color: '#EF4444',
      fontSize: 72,
      fontWeight: '900',
    },

    errorCameraText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '900',
    },

    scanStatus: {
  position: 'absolute',

  left: 28,
  right: 28,
  bottom: 14,

  minHeight: 52,

  borderWidth: 1,

  borderRadius: 26,

  backgroundColor:
    'rgba(15, 23, 42, 0.92)',

  paddingHorizontal: 16,
  paddingVertical: 9,

  flexDirection: 'row',
  alignItems: 'center',

  shadowColor: '#000000',

  shadowOpacity: 0.25,
  shadowRadius: 10,

  elevation: 7,
},

    statusDot: {
  width: 10,
  height: 10,

  borderRadius: 5,

  marginRight: 12,

  shadowColor: '#38BDF8',
  shadowOpacity: 0.8,
  shadowRadius: 6,

  elevation: 4,
},

    statusTextBox: {
      flex: 1,
    },

    scanStatusText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 13,
    },

    lastItemText: {
      color: '#CBD5E1',
      marginTop: 2,
      fontSize: 12,
      fontWeight: '600',
    },

    countRow: {
      flexDirection: 'row',
      backgroundColor:
        '#FFFFFF',
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor:
        '#E2E8F0',
    },

    counter: {
      flex: 1,
      alignItems: 'center',
    },

    counterDivider: {
      width: 1,
      backgroundColor:
        '#E2E8F0',
    },

    countNumber: {
      color: '#0F172A',
      fontSize: 22,
      fontWeight: '900',
    },

    countLabel: {
      color: '#64748B',
      fontSize: 11,
      marginTop: 1,
    },

    itemList: {
      flex: 1,
      paddingHorizontal: 14,
      paddingTop: 10,
    },

    emptyBox: {
      alignItems: 'center',
      paddingTop: 25,
    },

    emptyTitle: {
      color: '#334155',
      fontWeight: '800',
      fontSize: 16,
    },

    empty: {
      textAlign: 'center',
      marginTop: 5,
      color: '#94A3B8',
    },

    itemCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 14,
      padding: 13,
      marginBottom: 9,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor:
        '#E2E8F0',
    },

    itemInfo: {
      flex: 1,
      paddingRight: 8,
    },

    stockId: {
      color: '#166534',
      fontSize: 11,
      fontWeight: '900',
    },

    itemName: {
      color: '#0F172A',
      fontSize: 15,
      fontWeight: '800',
      marginTop: 2,
    },

    quantity: {
      marginTop: 5,
      color: '#0F172A',
      fontSize: 19,
      fontWeight: '900',
    },

    removeButton: {
      backgroundColor:
        '#FEE2E2',
      paddingHorizontal: 11,
      paddingVertical: 9,
      borderRadius: 10,
    },

    removeButtonText: {
      color: '#B91C1C',
      fontWeight: '800',
      fontSize: 11,
    },

    footer: {
  paddingHorizontal: 12,
  paddingTop: 12,
  paddingBottom: 50,

  backgroundColor: '#FFFFFF',

  flexDirection: 'row',
  gap: 10,

  borderTopWidth: 1,
  borderTopColor: '#E2E8F0',
},

    footerSearchButton: {
      flex: 0.8,
      borderWidth: 1.5,
      borderColor:
        '#166534',
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },

    footerSearchText: {
      color: '#166534',
      fontWeight: '900',
      fontSize: 14,
    },

    saveButton: {
      flex: 1.2,
      backgroundColor:
        '#166534',
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },

    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900',
    },

    disabled: {
      opacity: 0.45,
    },

    errorTitle: {
      color: '#0F172A',
      fontSize: 22,
      fontWeight: '900',
      marginBottom: 20,
    },

    primaryButton: {
      backgroundColor:
        '#166534',
      borderRadius: 14,
      paddingVertical: 15,
      paddingHorizontal: 25,
      alignItems: 'center',
    },

    primaryButtonText: {
      color: '#FFFFFF',
      fontWeight: '900',
      fontSize: 16,
    },

    /*
      SEARCH
    */

    searchOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(15,23,42,0.65)',
      justifyContent:
        'flex-end',
    },

    searchModal: {
      backgroundColor:
        '#F8FAFC',
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
      padding: 18,
      height: '82%',
    },

    searchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom: 14,
    },

    searchTitle: {
      color: '#0F172A',
      fontSize: 24,
      fontWeight: '900',
    },

    searchSubtitle: {
      color: '#64748B',
      marginTop: 2,
      fontSize: 12,
    },

    closeButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
    },

    closeButtonText: {
      color: '#334155',
      fontWeight: '900',
      fontSize: 17,
    },

    searchInput: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1.5,
      borderColor:
        '#CBD5E1',
      borderRadius: 14,
      minHeight: 54,
      paddingHorizontal: 15,
      fontSize: 16,
    },

    searchHint: {
      color: '#64748B',
      textAlign: 'center',
      marginTop: 20,
    },

    searchResults: {
      marginTop: 12,
    },

    searchResult: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 14,
      padding: 14,
      marginBottom: 9,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor:
        '#E2E8F0',
    },

    searchResultInfo: {
      flex: 1,
    },

    searchStockId: {
      color: '#166534',
      fontSize: 11,
      fontWeight: '900',
    },

    searchItemName: {
      color: '#0F172A',
      fontSize: 16,
      fontWeight: '800',
      marginTop: 2,
    },

    searchOldId: {
      color: '#64748B',
      fontSize: 12,
      marginTop: 3,
    },

    searchStock: {
      color: '#475569',
      fontSize: 12,
      marginTop: 4,
      fontWeight: '700',
    },

    addOneBadge: {
      marginLeft: 10,
      minWidth: 46,
      height: 40,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor:
        '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
    },

    addOneBadgeText: {
      color: '#166534',
      fontSize: 16,
      fontWeight: '900',
    },

    /*
      SUMMARY
    */

    summaryOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      padding: 20,
    },

    summaryCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 22,
      padding: 20,
      maxHeight: '85%',
    },

    successTitle: {
      color: '#166534',
      fontSize: 24,
      fontWeight: '900',
    },

    summaryHeader: {
      color: '#0F172A',
      fontSize: 17,
      fontWeight: '900',
      marginTop: 14,
    },

    summaryPerson: {
      color: '#64748B',
      marginTop: 3,
      marginBottom: 14,
    },

    summaryList: {
      marginBottom: 18,
    },

    summaryItem: {
      borderTopWidth: 1,
      borderTopColor:
        '#E2E8F0',
      paddingVertical: 12,
    },

    summaryItemName: {
      color: '#0F172A',
      fontWeight: '900',
      fontSize: 16,
    },

    summaryText: {
      color: '#475569',
      marginTop: 3,
    },
 





cameraHint: {
  position: 'absolute',

  top: 16,

  alignSelf: 'center',

  paddingHorizontal: 14,
  paddingVertical: 7,

  borderRadius: 20,

  backgroundColor:
    'rgba(15, 23, 42, 0.72)',
},


cameraHintText: {
  color: '#E2E8F0',

  fontSize: 11,

  fontWeight: '700',

  letterSpacing: 0.2,
},





scanCorner: {
  position: 'absolute',

  width: 42,
  height: 42,

  borderWidth: 0,
},


cornerTopLeft: {
  top: 0,
  left: 0,

  borderTopWidth: 5,
  borderLeftWidth: 5,

  borderTopLeftRadius: 18,
},


cornerTopRight: {
  top: 0,
  right: 0,

  borderTopWidth: 5,
  borderRightWidth: 5,

  borderTopRightRadius: 18,
},


cornerBottomLeft: {
  bottom: 0,
  left: 0,

  borderBottomWidth: 5,
  borderLeftWidth: 5,

  borderBottomLeftRadius: 18,
},


cornerBottomRight: {
  bottom: 0,
  right: 0,

  borderBottomWidth: 5,
  borderRightWidth: 5,

  borderBottomRightRadius: 18,
},





readyCenter: {
  ...StyleSheet.absoluteFill,

  alignItems: 'center',
  justifyContent: 'center',

  pointerEvents: 'none',
},


qrIcon: {
  color: 'rgba(255,255,255,0.75)',

  fontSize: 42,

  fontWeight: '400',
},


readyText: {
  color: 'rgba(255,255,255,0.75)',

  marginTop: 5,

  fontSize: 12,

  fontWeight: '700',
},
  });