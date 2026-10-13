import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Area, addArea, deactivateArea, getAreas, isAreaRequired, setAreaRequired } from '../repositories/areaRepository';

export default function ManageAreasScreen() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [name, setName] = useState('');
  const [required, setRequired] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rows, setting] = await Promise.all([getAreas(), isAreaRequired()]);
      setAreas(rows);
      setRequired(setting);
    } catch (error) {
      Alert.alert('Areas', String(error));
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function create() {
    try {
      await addArea(name);
      setName('');
      await load();
    } catch (error) {
      Alert.alert('Area', String(error));
    }
  }

  async function toggle(value: boolean) {
    try {
      await setAreaRequired(value);
      setRequired(value);
    } catch (error) {
      Alert.alert('Area setting', String(error));
    }
  }

  return (
    <FlatList
      data={areas}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
          <Text style={styles.eyebrow}>MASTER DATA</Text>
          <Text style={styles.title}>Manage Areas</Text>
          <Text style={styles.subtitle}>Choose where Issue / Receive items are going.</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Require an area for transactions</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingText}>{required ? 'ON — area is required' : 'OFF — area selector is hidden'}</Text>
              <Switch value={required} onValueChange={toggle} />
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add Area</Text>
            <View style={styles.inputRow}>
              <TextInput value={name} onChangeText={setName} placeholder="Area name" style={styles.input} />
              <Pressable onPress={() => void create()} style={styles.addButton}><Text style={styles.addText}>+</Text></Pressable>
            </View>
          </View>
          <Text style={styles.section}>Active Areas</Text>
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.areaName}>{item.name}</Text>
          <Pressable onPress={() => Alert.alert('Deactivate Area?', `Remove "${item.name}" from future selections?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Deactivate', style: 'destructive', onPress: async () => { await deactivateArea(item.id); await load(); } },
          ])}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No areas added yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 55, backgroundColor: '#F5F7F6', flexGrow: 1 },
  back: { color: '#166534', fontWeight: '700', fontSize: 16, marginBottom: 18 },
  eyebrow: { color: '#166534', fontWeight: '900', fontSize: 11, letterSpacing: 1.2 },
  title: { color: '#111827', fontSize: 28, fontWeight: '900', marginTop: 3 },
  subtitle: { color: '#64748B', marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 17, padding: 16, marginBottom: 18 },
  cardTitle: { color: '#111827', fontSize: 15, fontWeight: '800' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  settingText: { color: '#475569' },
  inputRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  input: { flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: '#F8FAFC', paddingHorizontal: 13, borderWidth: 1, borderColor: '#E2E8F0' },
  addButton: { width: 48, height: 48, backgroundColor: '#166534', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#FFF', fontSize: 25, fontWeight: '800' },
  section: { color: '#111827', fontWeight: '800', fontSize: 16, marginBottom: 10 },
  row: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  areaName: { color: '#111827', fontWeight: '700', fontSize: 15 },
  remove: { color: '#B91C1C', fontWeight: '800' },
  empty: { color: '#94A3B8', textAlign: 'center', marginTop: 15 },
});
