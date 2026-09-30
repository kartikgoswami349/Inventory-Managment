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
    useFocusEffect,
} from 'expo-router';

import {
    getTransactionDetails,
    TransactionDetail,
} from '../repositories/transactionRepository';

import {
    exportTransactionsToExcel,
} from '../services/exportService';

type FilterType =
  | 'ALL'
  | 'ISSUED'
  | 'RECEIVED'
  | 'OPENING'
  | 'AUDIT_ADJUSTMENT';

export default function TransactionsScreen() {
  const [transactions, setTransactions] =
    useState<TransactionDetail[]>([]);

  const [search, setSearch] =
    useState('');

  const [filter, setFilter] =
    useState<FilterType>('ALL');

  const [exporting, setExporting] =
    useState(false);

  async function loadTransactions() {
    try {
      const data =
        await getTransactionDetails();

      setTransactions(data);
    } catch (error) {
      Alert.alert(
        'Error',
        String(error)
      );
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [])
  );

  const visibleTransactions =
    transactions.filter((transaction) => {

      const searchText =
        search.toLowerCase();

      const matchesSearch =
        transaction.item_name
          .toLowerCase()
          .includes(searchText) ||

        transaction.stock_id
          .toLowerCase()
          .includes(searchText) ||

        (
          transaction.department_name ??
          ''
        )
          .toLowerCase()
          .includes(searchText) ||

        (
          transaction.person_name ??
          transaction.other_name ??
          ''
        )
          .toLowerCase()
          .includes(searchText);

      const matchesType =
        filter === 'ALL' ||
        transaction.transaction_type ===
          filter;

      return (
        matchesSearch &&
        matchesType
      );
    });

  async function handleExport() {
    try {
      setExporting(true);

      await exportTransactionsToExcel(
        visibleTransactions
      );
    } catch (error) {
      Alert.alert(
        'Export Error',
        String(error)
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            Transactions
          </Text>

          <Text style={styles.subtitle}>
            {visibleTransactions.length}
            {' '}records
          </Text>
        </View>

        <Pressable
          style={styles.exportButton}
          onPress={handleExport}
          disabled={exporting}
        >
          <Text style={styles.exportText}>
            {exporting
              ? 'Exporting...'
              : 'Export Excel'}
          </Text>
        </Pressable>
      </View>

      <TextInput
        placeholder="Search item, ID, department or person..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      <View style={styles.filters}>
        {[
          ['ALL', 'All'],
          ['ISSUED', 'Issued'],
          ['RECEIVED', 'Received'],
          ['OPENING', 'Opening'],
        ].map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() =>
              setFilter(
                value as FilterType
              )
            }
            style={[
              styles.filterButton,

              filter === value &&
                styles.filterSelected,
            ]}
          >
            <Text
              style={[
                styles.filterText,

                filter === value &&
                  styles.filterTextSelected,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={visibleTransactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          styles.list
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No transactions found.
          </Text>
        }
        renderItem={({ item }) => (
          <TransactionCard
            transaction={item}
          />
        )}
      />
    </View>
  );
}

function TransactionCard({
  transaction,
}: {
  transaction: TransactionDetail;
}) {
  const issued =
    transaction.transaction_type ===
    'ISSUED';
    const stockDelta =
  Number(
    transaction.stock_delta
  );

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>
            {transaction.item_name}
          </Text>

          <Text style={styles.stockId}>
            {transaction.stock_id}
          </Text>
        </View>

        <Text
          style={[
            styles.type,

            issued
              ? styles.issueType
              : styles.receiveType,
          ]}
        >
          {transaction.transaction_type}
        </Text>
      </View>

      <View style={styles.quantityRow}>
        <View>
  <Text style={styles.label}>
    Quantity
  </Text>

  <Text style={styles.quantity}>
    {stockDelta > 0 ? '+' : ''}
    {stockDelta}
    {' '}
    {transaction.unit}
  </Text>
</View>

        <View style={styles.afterBox}>
          <Text style={styles.label}>
            Stock After
          </Text>

          <Text style={styles.stockAfter}>
            {transaction.stock_after}
            {' '}
            {transaction.unit}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <Text style={styles.meta}>
        {new Date(
          transaction.timestamp
        ).toLocaleString()}
      </Text>

      {!!transaction.department_name && (
        <Text style={styles.meta}>
          Department:{' '}
          {transaction.department_name}
        </Text>
      )}

      {!!(
        transaction.person_name ||
        transaction.other_name
      ) && (
        <Text style={styles.meta}>
          Person:{' '}
          {transaction.person_name ??
            transaction.other_name}
        </Text>
      )}

      {!!transaction.remark && (
        <Text style={styles.remark}>
          {transaction.remark}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
    paddingHorizontal: 18,
    paddingTop: 55,
  },

  header: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
  },

  subtitle: {
    color: '#64748B',
    marginTop: 3,
  },

  exportButton: {
    backgroundColor: '#166534',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
  },

  exportText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  search: {
    backgroundColor: '#FFFFFF',
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 15,
    marginTop: 20,
  },

  filters: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 13,
    marginBottom: 15,
  },

  filterButton: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 18,
  },

  filterSelected: {
    backgroundColor: '#166534',
  },

  filterText: {
    fontSize: 12,
    color: '#334155',
  },

  filterTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  list: {
    paddingBottom: 40,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 11,
  },

  cardTop: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
  },

  itemInfo: {
    flex: 1,
    paddingRight: 10,
  },

  itemName: {
    fontSize: 16,
    fontWeight: '800',
  },

  stockId: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },

  type: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: 'hidden',
  },

  issueType: {
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
  },

  receiveType: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
  },

  quantityRow: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    marginTop: 17,
  },

  label: {
    fontSize: 11,
    color: '#64748B',
  },

  quantity: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: 2,
  },

  afterBox: {
    alignItems: 'flex-end',
  },

  stockAfter: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },

  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },

  meta: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 3,
  },

  remark: {
    marginTop: 5,
    fontSize: 13,
  },

  empty: {
    textAlign: 'center',
    marginTop: 60,
    color: '#64748B',
  },
});