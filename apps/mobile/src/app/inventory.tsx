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
    getInventoryItems,
    InventoryItem,
} from '../repositories/itemRepository';

import {
    exportInventoryToExcel,
} from '../services/exportService';

type StockFilter =
  | 'ALL'
  | 'IN_STOCK'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK';

export default function InventoryScreen() {
  const [items, setItems] =
    useState<InventoryItem[]>([]);

  const [search, setSearch] =
    useState('');

  const [filter, setFilter] =
    useState<StockFilter>('ALL');

  const [exporting, setExporting] =
    useState(false);

  async function loadItems() {
    try {
      const data =
        await getInventoryItems();

      setItems(data);
    } catch (error) {
      console.error(
        'LOAD INVENTORY ERROR:',
        error
      );

      Alert.alert(
        'Inventory Error',
        String(error)
      );
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [])
  );

  function getStatus(
    item: InventoryItem
  ) {
    if (item.current_stock <= 0) {
      return 'OUT_OF_STOCK';
    }

    if (
      item.current_stock <=
      item.minimum_stock
    ) {
      return 'LOW_STOCK';
    }

    return 'IN_STOCK';
  }

  const visibleItems =
    items.filter((item) => {
      const searchText =
        search.toLowerCase();

      const matchesSearch =
        item.item_name
          .toLowerCase()
          .includes(searchText) ||

        item.stock_id
          .toLowerCase()
          .includes(searchText) ||

        (
          item.old_item_id ?? ''
        )
          .toLowerCase()
          .includes(searchText);

      const status =
        getStatus(item);

      const matchesFilter =
        filter === 'ALL' ||
        status === filter;

      return (
        matchesSearch &&
        matchesFilter
      );
    });

  async function handleExportInventory() {
    try {
      setExporting(true);

      await exportInventoryToExcel(
        visibleItems
      );
    } catch (error) {
      console.error(
        'INVENTORY EXPORT ERROR:',
        error
      );

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
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>
            Inventory
          </Text>

          <Text style={styles.subtitle}>
            {visibleItems.length}
            {' '}
            of
            {' '}
            {items.length}
            {' '}
            Item Types
          </Text>
        </View>

        <Pressable
          disabled={exporting}
          onPress={handleExportInventory}
          style={[
            styles.exportButton,
            exporting &&
              styles.exportDisabled,
          ]}
        >
          <Text
            style={styles.exportButtonText}
          >
            {exporting
              ? 'Exporting...'
              : 'Export Excel'}
          </Text>
        </Pressable>
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search item name or ID..."
        style={styles.search}
      />

      <View style={styles.filters}>
        <FilterButton
          text="All"
          selected={filter === 'ALL'}
          onPress={() =>
            setFilter('ALL')
          }
        />

        <FilterButton
          text="In Stock"
          selected={
            filter === 'IN_STOCK'
          }
          onPress={() =>
            setFilter('IN_STOCK')
          }
        />

        <FilterButton
          text="Low"
          selected={
            filter === 'LOW_STOCK'
          }
          onPress={() =>
            setFilter('LOW_STOCK')
          }
        />

        <FilterButton
          text="Out"
          selected={
            filter ===
            'OUT_OF_STOCK'
          }
          onPress={() =>
            setFilter(
              'OUT_OF_STOCK'
            )
          }
        />
      </View>

      <FlatList
        data={visibleItems}
        keyExtractor={(item) =>
          item.id
        }
        contentContainerStyle={
          styles.list
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No inventory items found.
          </Text>
        }
        renderItem={({ item }) => {
          const status =
            getStatus(item);

          const audited =
            !!item.last_audit_date;

          return (
            <View style={styles.card}>
              <View
                style={styles.cardTop}
              >
                <View
                  style={styles.info}
                >
                  <Text
                    style={
                      styles.itemName
                    }
                  >
                    {item.item_name}
                  </Text>

                  <Text
                    style={
                      styles.stockId
                    }
                  >
                    {item.stock_id}
                  </Text>

                  {!!item.old_item_id && (
                    <Text
                      style={
                        styles.oldItemId
                      }
                    >
                      Item ID:{' '}
                      {
                        item.old_item_id
                      }
                    </Text>
                  )}
                </View>

                <StockBadge
                  status={status}
                />
              </View>

              <View
                style={styles.divider}
              />

              <View
                style={styles.stockRow}
              >
                <View>
                  <Text
                    style={
                      styles.smallLabel
                    }
                  >
                    Current Stock
                  </Text>

                  <Text
                    style={
                      styles.quantity
                    }
                  >
                    {
                      item.current_stock
                    }
                    {' '}

                    <Text
                      style={
                        styles.unit
                      }
                    >
                      {item.unit}
                    </Text>
                  </Text>
                </View>

                <View
                  style={
                    styles.minimumBox
                  }
                >
                  <Text
                    style={
                      styles.smallLabel
                    }
                  >
                    Minimum
                  </Text>

                  <Text
                    style={
                      styles.minimum
                    }
                  >
                    {
                      item.minimum_stock
                    }
                  </Text>

                  <Text
                    style={
                      styles.minimumUnit
                    }
                  >
                    {item.unit}
                  </Text>
                </View>
              </View>

              <View
                style={styles.divider}
              />

              <View
                style={
                  styles.auditTitleRow
                }
              >
                <Text
                  style={
                    styles.auditHeading
                  }
                >
                  LAST AUDIT
                </Text>

                {audited ? (
                  <View
                    style={
                      styles.auditedBadge
                    }
                  >
                    <Text
                      style={
                        styles.auditedBadgeText
                      }
                    >
                      Audited
                    </Text>
                  </View>
                ) : (
                  <View
                    style={
                      styles.notAuditedBadge
                    }
                  >
                    <Text
                      style={
                        styles.notAuditedBadgeText
                      }
                    >
                      Not Audited
                    </Text>
                  </View>
                )}
              </View>

              {audited ? (
                <View
                  style={
                    styles.auditSection
                  }
                >
                  <AuditRow
                    label="Audit Date"
                    value={
                      item.last_audit_date
                        ? new Date(
                            item.last_audit_date
                          ).toLocaleString()
                        : '-'
                    }
                  />

                  <AuditRow
                    label="Stock at Audit"
                    value={`${
                      item.stock_at_audit ??
                      '-'
                    } ${item.unit}`}
                  />

                  <AuditRow
                    label="Physical Quantity"
                    value={`${
                      item.last_audit_quantity ??
                      '-'
                    } ${item.unit}`}
                  />

                  <View
                    style={
                      styles.auditRow
                    }
                  >
                    <Text
                      style={
                        styles.auditLabel
                      }
                    >
                      Variance
                    </Text>

                    <Text
                      style={[
                        styles.auditValue,

                        item.last_audit_variance !==
                          0 &&
                          styles.varianceWarning,

                        item.last_audit_variance ===
                          0 &&
                          styles.varianceGood,
                      ]}
                    >
                      {item.last_audit_variance !==
                        null &&
                      item.last_audit_variance >
                        0
                        ? '+'
                        : ''}

                      {
                        item.last_audit_variance
                      }
                      {' '}
                      {item.unit}
                    </Text>
                  </View>

                  {!!item.last_audit_remark && (
                    <View
                      style={
                        styles.remarkBox
                      }
                    >
                      <Text
                        style={
                          styles.auditLabel
                        }
                      >
                        Audit Remark
                      </Text>

                      <Text
                        style={
                          styles.remarkText
                        }
                      >
                        {
                          item.last_audit_remark
                        }
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text
                  style={
                    styles.notAuditedText
                  }
                >
                  This item has not been
                  physically audited yet.
                </Text>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

function AuditRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.auditRow}>
      <Text style={styles.auditLabel}>
        {label}
      </Text>

      <Text style={styles.auditValue}>
        {value}
      </Text>
    </View>
  );
}

function FilterButton({
  text,
  selected,
  onPress,
}: {
  text: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterButton,
        selected &&
          styles.filterSelected,
      ]}
    >
      <Text
        style={[
          styles.filterText,
          selected &&
            styles.filterTextSelected,
        ]}
      >
        {text}
      </Text>
    </Pressable>
  );
}

function StockBadge({
  status,
}: {
  status: string;
}) {
  if (
    status === 'OUT_OF_STOCK'
  ) {
    return (
      <View style={styles.badgeOut}>
        <Text
          style={styles.badgeText}
        >
          Out of Stock
        </Text>
      </View>
    );
  }

  if (
    status === 'LOW_STOCK'
  ) {
    return (
      <View style={styles.badgeLow}>
        <Text
          style={
            styles.badgeTextDark
          }
        >
          Low Stock
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.badgeIn}>
      <Text
        style={styles.badgeText}
      >
        In Stock
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F4F6F8',
      paddingTop: 55,
      paddingHorizontal: 18,
    },

    headerRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginBottom: 18,
      gap: 10,
    },

    heading: {
      fontSize: 30,
      fontWeight: '800',
      color: '#0F172A',
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

    exportButtonText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 13,
    },

    exportDisabled: {
      opacity: 0.5,
    },

    search: {
      height: 50,
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      paddingHorizontal: 16,
      fontSize: 16,
      marginBottom: 15,
    },

    filters: {
      flexDirection: 'row',
      gap: 7,
      marginBottom: 12,
    },

    filterButton: {
      paddingVertical: 9,
      paddingHorizontal: 12,
      backgroundColor: '#E2E8F0',
      borderRadius: 20,
    },

    filterSelected: {
      backgroundColor: '#166534',
    },

    filterText: {
      fontSize: 13,
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
      borderRadius: 17,
      padding: 17,
      marginBottom: 12,
    },

    cardTop: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'flex-start',
    },

    info: {
      flex: 1,
      paddingRight: 10,
    },

    itemName: {
      fontSize: 17,
      fontWeight: '700',
      color: '#0F172A',
    },

    stockId: {
      marginTop: 4,
      color: '#166534',
      fontSize: 13,
      fontWeight: '700',
    },

    oldItemId: {
      marginTop: 3,
      color: '#94A3B8',
      fontSize: 11,
    },

    divider: {
      height: 1,
      backgroundColor: '#E2E8F0',
      marginVertical: 14,
    },

    stockRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
    },

    smallLabel: {
      color: '#64748B',
      fontSize: 12,
    },

    quantity: {
      marginTop: 3,
      fontSize: 22,
      fontWeight: '800',
      color: '#0F172A',
    },

    unit: {
      fontSize: 13,
      color: '#64748B',
      fontWeight: '500',
    },

    minimumBox: {
      alignItems: 'flex-end',
    },

    minimum: {
      fontSize: 18,
      fontWeight: '700',
      marginTop: 3,
    },

    minimumUnit: {
      fontSize: 11,
      color: '#64748B',
    },

    auditTitleRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },

    auditHeading: {
      color: '#166534',
      fontSize: 12,
      fontWeight: '800',
    },

    auditedBadge: {
      backgroundColor: '#DCFCE7',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
    },

    auditedBadgeText: {
      color: '#166534',
      fontSize: 10,
      fontWeight: '800',
    },

    notAuditedBadge: {
      backgroundColor: '#F1F5F9',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
    },

    notAuditedBadgeText: {
      color: '#64748B',
      fontSize: 10,
      fontWeight: '700',
    },

    auditSection: {
      gap: 8,
    },

    auditRow: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      alignItems: 'flex-start',
      gap: 15,
    },

    auditLabel: {
      color: '#64748B',
      fontSize: 12,
      flexShrink: 0,
    },

    auditValue: {
      color: '#0F172A',
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'right',
      flex: 1,
    },

    varianceGood: {
      color: '#166534',
    },

    varianceWarning: {
      color: '#B45309',
    },

    remarkBox: {
      backgroundColor: '#F8FAFC',
      borderRadius: 10,
      padding: 11,
      marginTop: 3,
    },

    remarkText: {
      color: '#334155',
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4,
    },

    notAuditedText: {
      color: '#94A3B8',
      fontSize: 12,
      lineHeight: 18,
    },

    badgeIn: {
      backgroundColor: '#166534',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 15,
      alignSelf: 'flex-start',
    },

    badgeLow: {
      backgroundColor: '#FACC15',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 15,
      alignSelf: 'flex-start',
    },

    badgeOut: {
      backgroundColor: '#DC2626',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 15,
      alignSelf: 'flex-start',
    },

    badgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },

    badgeTextDark: {
      color: '#422006',
      fontSize: 11,
      fontWeight: '700',
    },

    emptyText: {
      textAlign: 'center',
      color: '#64748B',
      marginTop: 50,
    },
  });