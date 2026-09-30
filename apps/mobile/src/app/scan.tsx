import {
    useState,
} from 'react';

import {
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    BarcodeScanningResult,
    CameraView,
    useCameraPermissions,
} from 'expo-camera';

import {
    router,
} from 'expo-router';

import {
    getItemByQr,
} from '../repositories/itemRepository';

import ItemSearchPicker from '../components/ItemSearchPicker';


export default function ScanScreen() {

  const [
    permission,
    requestPermission,
  ] =
    useCameraPermissions();


  const [
    scanned,
    setScanned,
  ] =
    useState(false);


  const [
    cameraReady,
    setCameraReady,
  ] =
    useState(false);


  const [
    mode,
    setMode,
  ] =
    useState<
      'scan' | 'search'
    >('scan');


  /*
    MANUAL SEARCH MODE
  */

  if (
    mode ===
    'search'
  ) {
    return (
      <ItemSearchPicker
        title="Transaction"

        subtitle={
          'Search and select an item'
        }

        onScanPress={() => {
          setScanned(false);
          setMode('scan');
        }}

        onSelect={
          item => {
            router.replace({
              pathname:
                '/item-transaction',

              params: {
                itemId:
                  item.id,
              },
            });
          }
        }
      />
    );
  }


  /*
    CAMERA PERMISSION
  */

  if (!permission) {
    return (
      <View
        style={
          styles.center
        }
      >
        <Text>
          Checking camera permission...
        </Text>

        <Pressable
          onPress={() =>
            setMode('search')
          }
          style={
            styles.searchInsteadButton
          }
        >
          <Text
            style={
              styles.searchInsteadText
            }
          >
            Search Item Instead
          </Text>
        </Pressable>
      </View>
    );
  }


  if (
    !permission.granted
  ) {
    return (
      <View
        style={
          styles.center
        }
      >

        <Text
          style={styles.title}
        >
          Camera Permission Required
        </Text>

        <Text
          style={
            styles.permissionText
          }
        >
          R58 Inventory needs camera
          access to scan item QR codes.
        </Text>


        <Pressable
          style={styles.button}
          onPress={
            requestPermission
          }
        >
          <Text
            style={
              styles.buttonText
            }
          >
            Allow Camera
          </Text>
        </Pressable>


        <Pressable
          onPress={() =>
            setMode('search')
          }
          style={
            styles.searchInsteadButton
          }
        >
          <Text
            style={
              styles.searchInsteadText
            }
          >
            Search Item Instead
          </Text>
        </Pressable>

      </View>
    );
  }


  async function
    handleBarcodeScanned(
      result:
        BarcodeScanningResult
    ) {

    if (scanned) {
      return;
    }

    setScanned(true);


    const qrData =
      result.data.trim();


    try {

      const item =
        await getItemByQr(
          qrData
        );


      if (!item) {

        Alert.alert(
          'Item Not Found',

          `No inventory item was found for QR:\n\n${qrData}`,

          [
            {
              text:
                'Scan Again',

              onPress: () => {
                setScanned(
                  false
                );
              },
            },

            {
              text:
                'Search Item',

              onPress: () => {
                setScanned(
                  false
                );

                setMode(
                  'search'
                );
              },
            },
          ]
        );

        return;
      }


      router.replace({
        pathname:
          '/item-transaction',

        params: {
          itemId:
            item.id,
        },
      });

    } catch (error) {

      console.error(
        'SCAN ERROR:',
        error
      );


      Alert.alert(
        'Scan Error',

        String(error),

        [
          {
            text:
              'Try Again',

            onPress: () => {
              setScanned(false);
            },
          },
        ]
      );
    }
  }


  return (
    <View
      style={
        styles.container
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

        onCameraReady={() => {
          setCameraReady(
            true
          );
        }}

        onMountError={
          error => {

            console.error(
              'CAMERA ERROR:',
              error
            );

            Alert.alert(
              'Camera Error',
              String(error)
            );
          }
        }

        onBarcodeScanned={
          scanned
            ? undefined
            : handleBarcodeScanned
        }
      />


      <View
        style={
          styles.overlay
        }
      >

        <Text
          style={
            styles.header
          }
        >
          Transaction
        </Text>


        <Text
          style={[
            styles.status,

            !cameraReady &&
              styles.statusWaiting,
          ]}
        >
          {cameraReady
            ? 'Camera Ready'
            : 'Starting Camera...'}
        </Text>


        <View
          style={
            styles.modeRow
          }
        >

          <View
            style={
              styles.activeMode
            }
          >
            <Text
              style={
                styles.activeModeText
              }
            >
              Scan QR
            </Text>
          </View>


          <Pressable
            onPress={() =>
              setMode('search')
            }
            style={
              styles.inactiveMode
            }
          >
            <Text
              style={
                styles.inactiveModeText
              }
            >
              Search Item
            </Text>
          </Pressable>

        </View>


        <View
          style={
            styles.scanFrame
          }
        >

          <View
            style={
              styles.cornerTL
            }
          />

          <View
            style={
              styles.cornerTR
            }
          />

          <View
            style={
              styles.cornerBL
            }
          />

          <View
            style={
              styles.cornerBR
            }
          />

        </View>


        <Text
          style={
            styles.help
          }
        >
          Hold the packet QR
          code inside the box
        </Text>


        {scanned && (
          <Text
            style={
              styles.processing
            }
          >
            Processing QR...
          </Text>
        )}

      </View>
    </View>
  );
}


const styles =
  StyleSheet.create({

    container: {
      flex: 1,
      backgroundColor:
        '#000000',
    },


    center: {
      flex: 1,

      justifyContent:
        'center',

      alignItems:
        'center',

      padding:
        25,

      backgroundColor:
        '#F4F6F8',
    },


    title: {
      fontSize:
        22,

      fontWeight:
        '800',

      marginBottom:
        10,
    },


    permissionText: {
      color:
        '#64748B',

      textAlign:
        'center',

      marginBottom:
        20,
    },


    overlay: {
      flex: 1,

      alignItems:
        'center',

      paddingTop:
        65,

      paddingHorizontal:
        20,
    },


    header: {
      color:
        '#FFFFFF',

      fontSize:
        27,

      fontWeight:
        '900',
    },


    status: {
      color:
        '#22C55E',

      fontWeight:
        '700',

      marginTop:
        5,
    },


    statusWaiting: {
      color:
        '#FACC15',
    },


    modeRow: {
      width:
        '100%',

      maxWidth:
        350,

      marginTop:
        22,

      backgroundColor:
        'rgba(0,0,0,0.45)',

      borderRadius:
        13,

      padding:
        4,

      flexDirection:
        'row',
    },


    activeMode: {
      flex: 1,

      minHeight:
        42,

      borderRadius:
        10,

      backgroundColor:
        '#FFFFFF',

      justifyContent:
        'center',

      alignItems:
        'center',
    },


    activeModeText: {
      color:
        '#166534',

      fontWeight:
        '900',
    },


    inactiveMode: {
      flex: 1,

      minHeight:
        42,

      justifyContent:
        'center',

      alignItems:
        'center',
    },


    inactiveModeText: {
      color:
        '#FFFFFF',

      fontWeight:
        '800',
    },


    scanFrame: {
      width:
        260,

      height:
        260,

      marginTop:
        45,

      position:
        'relative',
    },


    cornerTL: {
      position:
        'absolute',

      left: 0,
      top: 0,

      width:
        42,

      height:
        42,

      borderLeftWidth:
        5,

      borderTopWidth:
        5,

      borderColor:
        '#FFFFFF',
    },


    cornerTR: {
      position:
        'absolute',

      right: 0,
      top: 0,

      width:
        42,

      height:
        42,

      borderRightWidth:
        5,

      borderTopWidth:
        5,

      borderColor:
        '#FFFFFF',
    },


    cornerBL: {
      position:
        'absolute',

      left: 0,
      bottom: 0,

      width:
        42,

      height:
        42,

      borderLeftWidth:
        5,

      borderBottomWidth:
        5,

      borderColor:
        '#FFFFFF',
    },


    cornerBR: {
      position:
        'absolute',

      right: 0,
      bottom: 0,

      width:
        42,

      height:
        42,

      borderRightWidth:
        5,

      borderBottomWidth:
        5,

      borderColor:
        '#FFFFFF',
    },


    help: {
      color:
        '#FFFFFF',

      marginTop:
        20,

      fontSize:
        14,

      textAlign:
        'center',
    },


    processing: {
      marginTop:
        18,

      color:
        '#FFFFFF',

      fontWeight:
        '700',
    },


    button: {
      backgroundColor:
        '#166534',

      paddingHorizontal:
        30,

      paddingVertical:
        15,

      borderRadius:
        14,
    },


    buttonText: {
      color:
        '#FFFFFF',

      fontWeight:
        '800',
    },


    searchInsteadButton: {
      marginTop:
        13,

      paddingHorizontal:
        20,

      paddingVertical:
        12,
    },


    searchInsteadText: {
      color:
        '#166534',

      fontWeight:
        '800',
    },
  });