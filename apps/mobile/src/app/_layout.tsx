import {
    useEffect,
} from 'react';

import {
    Stack,
} from 'expo-router';

import {
    SafeAreaProvider,
} from 'react-native-safe-area-context';

import {
    startAutoSync,
    stopAutoSync,
} from '../services/autoSyncService';


export default function RootLayout() {

  useEffect(() => {

    startAutoSync()
      .catch(
        error => {

          /*
            Networking failure must
            never prevent R58 from
            opening.

            The user can still work
            completely offline and use
            manual Sync Now later.
          */

          console.error(
            'R58 AUTO SYNC START ERROR:',
            error
          );
        }
      );


    return () => {

      stopAutoSync();
    };

  }, []);


  return (
    <SafeAreaProvider>

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >

        <Stack.Screen
          name="index"
        />

        <Stack.Screen
          name="scan"
        />

        <Stack.Screen
          name="inventory"
        />

        <Stack.Screen
          name="item-transaction"
        />

        <Stack.Screen
          name="transactions"
        />

        <Stack.Screen
          name="audit-scan"
        />

        <Stack.Screen
          name="audit"
        />

        <Stack.Screen
          name="data-setup"
        />

        <Stack.Screen
          name="dashboard"
        />

        <Stack.Screen
          name="manage-items"
        />

        <Stack.Screen
          name="add-item"
        />

        <Stack.Screen
          name="backup-restore"
        />

        <Stack.Screen
          name="manage-people"
        />

        <Stack.Screen
          name="device-sync"
        />

        <Stack.Screen
          name="edit-item"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
  name="new-transaction"
/>

<Stack.Screen
  name="transaction-scan"
/>

      </Stack>

    </SafeAreaProvider>
  );
}