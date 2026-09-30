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


export default function AuditScanScreen() {

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
    mode,
    setMode,
  ] =
    useState<
      'scan' | 'search'
    >('scan');


  /*
    SEARCH MODE
  */

  if (
    mode ===
    'search'
  ) {

    return (
      <ItemSearchPicker
        title="Audit Stock"

        subtitle={
          'Search and select an item to audit'
        }

        onScanPress={() => {
          setScanned(false);
          setMode('scan');
        }}

        onSelect={
          item => {

            router.replace({
              pathname:
                '/audit',

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
    PERMISSION
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
          style={
            styles.title
          }
        >
          Camera Permission Required
        </Text>


        <Pressable
          style={
            styles.button
          }

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


  async function handleScan(
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

          `No inventory item found for:\n\n${qrData}`,

          [
            {
              text:
                'Scan Again',

              onPress: () =>
                setScanned(
                  false
                ),
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
          '/audit',

        params: {
          itemId:
            item.id,
        },
      });

    } catch (error) {

      Alert.alert(
        'Audit Scan Error',

        String(error),

        [
          {
            text:
              'Try Again',

            onPress: () =>
              setScanned(
                false
              ),
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

        onBarcodeScanned={
          scanned
            ? undefined
            : handleScan
        }
      />


      <View
        style={
          styles.overlay
        }
      >

        <Text
          style={
            styles.titleWhite
          }
        >
          Audit Stock
        </Text>


        <Text
          style={
            styles.subtitle
          }
        >
          Scan or search an item
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
              setMode(
                'search'
              )
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
            styles.scanBox
          }
        />


        <Text
          style={
            styles.help
          }
        >
          Place the packet QR
          inside the box
        </Text>

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

      alignItems:
        'center',

      justifyContent:
        'center',

      padding:
        25,

      backgroundColor:
        '#F5F7F6',
    },


    overlay: {
      flex: 1,

      alignItems:
        'center',

      paddingTop:
        70,

      paddingHorizontal:
        20,
    },


    title: {
      fontSize:
        22,

      fontWeight:
        '800',

      marginBottom:
        20,
    },


    titleWhite: {
      color:
        '#FFFFFF',

      fontSize:
        27,

      fontWeight:
        '900',
    },


    subtitle: {
      color:
        '#FFFFFF',

      marginTop:
        5,
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

      alignItems:
        'center',

      justifyContent:
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

      alignItems:
        'center',

      justifyContent:
        'center',
    },


    inactiveModeText: {
      color:
        '#FFFFFF',

      fontWeight:
        '800',
    },


    scanBox: {
      width:
        260,

      height:
        260,

      borderWidth:
        3,

      borderColor:
        '#FFFFFF',

      borderRadius:
        24,

      marginTop:
        45,
    },


    help: {
      color:
        '#FFFFFF',

      marginTop:
        18,

      textAlign:
        'center',
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