import {
    useCallback,
    useState,
} from 'react';

import {
    Image,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
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
    DashboardStats,
    getDashboardStats,
} from '../repositories/dashboardRepository';


const EMPTY_STATS: DashboardStats = {
  totalItems: 0,
  inStock: 0,
  lowStock: 0,
  outOfStock: 0,

  transactionsToday: 0,
  issuedToday: 0,
  receivedToday: 0,
  auditsToday: 0,
};


type HealthAccent =
  | 'good'
  | 'warning'
  | 'danger';

type QuickTone =
  | 'green'
  | 'yellow'
  | 'red'
  | 'blue'
  | 'purple'
  | 'slate'
  | 'teal';


export default function DashboardScreen() {
  const [stats, setStats] =
    useState<DashboardStats>(
      EMPTY_STATS
    );

  const [loading, setLoading] =
    useState(true);


  async function loadDashboard() {
    try {
      setLoading(true);

      const data =
        await getDashboardStats();

      setStats(data);
    } catch (error) {
      console.error(
        'DASHBOARD ERROR:',
        error
      );
    } finally {
      setLoading(false);
    }
  }


  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );


  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadDashboard}
            tintColor="#0B7A45"
            colors={['#0B7A45']}
          />
        }
      >
        {/* HEADER */}

        <View style={styles.header}>
          <Image
            source={require(
              '../../assets/images/splash-icon.png'
            )}
            style={
              styles.headerWatermark
            }
            resizeMode="contain"
          />

          <View style={styles.headerText}>
            <Text style={styles.brand}>
              R58 INVENTORY
            </Text>

            <Text style={styles.title}>
              Dashboard
            </Text>

            <Text style={styles.subtitle}>
              Live inventory overview
            </Text>
          </View>

          <View style={styles.logoShell}>
            <Image
              source={require(
                '../../assets/images/splash-icon.png'
              )}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>


        {/* MAIN SCAN BUTTON */}

        <Pressable
          onPress={() =>
            router.push('/new-transaction')
          }
          style={({ pressed }) => [
            styles.scanButton,
            pressed &&
              styles.buttonPressed,
          ]}
        >
          <View
            style={
              styles.scanDecorationLarge
            }
          />

          <View
            style={
              styles.scanDecorationSmall
            }
          />

          <View style={styles.scanLeft}>
            <View style={styles.scanIconBox}>
              <ScanCorners />
            </View>

            <View style={styles.scanTextBox}>
              <Text style={styles.scanTitle}>
                Scan Item
              </Text>

              <Text
                style={
                  styles.scanSubtitle
                }
              >
                Issue or receive stock
              </Text>
            </View>
          </View>

          <View style={styles.scanArrowBox}>
            <Text style={styles.scanArrow}>
              ›
            </Text>
          </View>
        </Pressable>


        {/* INVENTORY HEALTH */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Inventory Health
          </Text>

          <Text style={styles.sectionCount}>
            {stats.totalItems} items
          </Text>
        </View>

        <View style={styles.inventoryGrid}>
          <InventoryCard
            label="In Stock"
            value={stats.inStock}
            accent="good"
            symbol="◇"
          />

          <InventoryCard
            label="Low Stock"
            value={stats.lowStock}
            accent="warning"
            symbol="△"
          />

          <InventoryCard
            label="Out of Stock"
            value={stats.outOfStock}
            accent="danger"
            symbol="⊘"
          />
        </View>


        {/* TODAY */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Today's Activity
          </Text>
        </View>

        <View style={styles.activityCard}>
          <ActivityItem
            label="Transactions"
            value={
              stats.transactionsToday
            }
            symbol="▤"
          />

          <Divider />

          <ActivityItem
            label="Issued"
            value={stats.issuedToday}
            symbol="↑"
          />

          <Divider />

          <ActivityItem
            label="Received"
            value={stats.receivedToday}
            symbol="↓"
          />

          <Divider />

          <ActivityItem
            label="Audits"
            value={stats.auditsToday}
            symbol="◇"
          />
        </View>


        {/* QUICK ACTIONS */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Quick Actions
          </Text>
        </View>

        <View style={styles.quickGrid}>
          <QuickAction
            title="Inventory"
            subtitle="View all stock"
            symbol="◇"
            tone="green"
            onPress={() =>
              router.push('/inventory')
            }
          />

          <QuickAction
            title="Audit"
            subtitle="Physical stock"
            symbol="✓"
            tone="yellow"
            onPress={() =>
              router.push(
                '/audit-scan'
              )
            }
          />

          <QuickAction
            title="Transactions"
            subtitle="History & export"
            symbol="⇅"
            tone="red"
            onPress={() =>
              router.push(
                '/transactions'
              )
            }
          />

          <QuickAction
            title="Device & Sync"
            subtitle="Multi-phone settings"
            symbol="↻"
            tone="blue"
            onPress={() =>
              router.push(
                '/device-sync'
              )
            }
          />

          <QuickAction
            title="Manage Items"
            subtitle="Add new stock item"
            symbol="+"
            tone="purple"
            onPress={() =>
              router.push(
                '/manage-items'
              )
            }
          />

          <QuickAction
            title="Departments & People"
            subtitle="Manage staff names"
            symbol="👥"
            tone="teal"
            onPress={() =>
              router.push(
                '/manage-people'
              )
            }
          />

          <QuickAction
            title="Backup & Restore"
            subtitle="Protect inventory data"
            symbol="⟳"
            tone="slate"
            onPress={() =>
              router.push(
                '/backup-restore'
              )
            }
          />
        </View>

        <Text style={styles.footer}>
          Pull down to refresh
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}


function ScanCorners() {
  return (
    <View style={styles.scanIcon}>
      <View
        style={[
          styles.scanCorner,
          styles.scanCornerTL,
        ]}
      />

      <View
        style={[
          styles.scanCorner,
          styles.scanCornerTR,
        ]}
      />

      <View
        style={[
          styles.scanCorner,
          styles.scanCornerBL,
        ]}
      />

      <View
        style={[
          styles.scanCorner,
          styles.scanCornerBR,
        ]}
      />

      <View style={styles.scanLine} />
    </View>
  );
}


function InventoryCard({
  label,
  value,
  accent,
  symbol,
}: {
  label: string;
  value: number;
  accent: HealthAccent;
  symbol: string;
}) {
  const isGood =
    accent === 'good';

  const isWarning =
    accent === 'warning';

  return (
    <View
      style={[
        styles.inventoryCard,

        isGood &&
          styles.inventoryCardGood,

        isWarning &&
          styles.inventoryCardWarning,

        accent === 'danger' &&
          styles.inventoryCardDanger,
      ]}
    >
      <View style={styles.inventoryTopRow}>
        <View
          style={[
            styles.statusDot,

            isGood &&
              styles.goodDot,

            isWarning &&
              styles.warningDot,

            accent === 'danger' &&
              styles.dangerDot,
          ]}
        />

        <Text style={styles.inventoryLabel}>
          {label}
        </Text>
      </View>

      <View style={styles.inventoryBottomRow}>
        <Text style={styles.inventoryValue}>
          {value}
        </Text>

        <Text
          style={[
            styles.inventorySymbol,

            isGood &&
              styles.goodSymbol,

            isWarning &&
              styles.warningSymbol,

            accent === 'danger' &&
              styles.dangerSymbol,
          ]}
        >
          {symbol}
        </Text>
      </View>
    </View>
  );
}


function ActivityItem({
  label,
  value,
  symbol,
}: {
  label: string;
  value: number;
  symbol: string;
}) {
  return (
    <View style={styles.activityItem}>
      <Text style={styles.activityValue}>
        {value}
      </Text>

      <View style={styles.activityLabelRow}>
        <Text style={styles.activitySymbol}>
          {symbol}
        </Text>

        <Text style={styles.activityLabel}>
          {label}
        </Text>
      </View>
    </View>
  );
}


function Divider() {
  return (
    <View style={styles.divider} />
  );
}


function QuickAction({
  title,
  subtitle,
  symbol,
  tone,
  onPress,
}: {
  title: string;
  subtitle: string;
  symbol: string;
  tone: QuickTone;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickCard,
        pressed &&
          styles.buttonPressed,
      ]}
    >
      <View
        style={[
          styles.iconBox,

          tone === 'green' &&
            styles.iconBoxGreen,

          tone === 'yellow' &&
            styles.iconBoxYellow,

          tone === 'red' &&
            styles.iconBoxRed,

          tone === 'blue' &&
            styles.iconBoxBlue,

          tone === 'purple' &&
            styles.iconBoxPurple,

          tone === 'slate' &&
            styles.iconBoxSlate,

          tone === 'teal' &&
            styles.iconBoxTeal,
        ]}
      >
        <Text
          style={[
            styles.iconText,

            tone === 'green' &&
              styles.iconTextGreen,

            tone === 'yellow' &&
              styles.iconTextYellow,

            tone === 'red' &&
              styles.iconTextRed,

            tone === 'blue' &&
              styles.iconTextBlue,

            tone === 'purple' &&
              styles.iconTextPurple,

            tone === 'slate' &&
              styles.iconTextSlate,

            tone === 'teal' &&
              styles.iconTextTeal,
          ]}
        >
          {symbol}
        </Text>
      </View>

      <View style={styles.quickTextBox}>
        <Text style={styles.quickTitle}>
          {title}
        </Text>

        <Text style={styles.quickSubtitle}>
          {subtitle}
        </Text>
      </View>

      <Text style={styles.quickArrow}>
        ›
      </Text>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },

  container: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },

  content: {
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 24,
  },


  /*
    HEADER
  */

  header: {
    minHeight: 80,
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    overflow: 'hidden',
    marginBottom: 8,
  },

  headerText: {
    flex: 1,
    paddingTop: 4,
    zIndex: 3,
  },

  brand: {
    color: '#08783E',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.8,
  },

  title: {
    color: '#071225',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: -0.8,
  },

  subtitle: {
    color: '#6B7E9B',
    fontSize: 14,
    marginTop: 1,
    fontWeight: '400',
  },

  logoShell: {
    width: 70,
    height: 70,
    marginTop: 0,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#1A2638',
    shadowOpacity: 0.12,
    shadowRadius: 9,

    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 5,
    zIndex: 4,
  },

  logoImage: {
    width: 59,
    height: 59,
  },

  headerWatermark: {
    position: 'absolute',
    width: 165,
    height: 165,
    right: -34,
    top: 0,
    opacity: 0.045,
    zIndex: 1,
  },


  /*
    SCAN CARD
  */

  scanButton: {
    minHeight: 77,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 12,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    backgroundColor: '#08783E',
    overflow: 'hidden',

    shadowColor: '#07592E',
    shadowOpacity: 0.15,
    shadowRadius: 9,

    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 4,
  },

  scanLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 4,
  },

  scanIconBox: {
    width: 56,
    height: 56,
    borderRadius: 17,

    backgroundColor:
      'rgba(255,255,255,0.10)',

    alignItems: 'center',
    justifyContent: 'center',
  },

  scanIcon: {
    width: 32,
    height: 32,
    position: 'relative',
  },

  scanCorner: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderColor: '#FFFFFF',
  },

  scanCornerTL: {
    left: 0,
    top: 0,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 3,
  },

  scanCornerTR: {
    right: 0,
    top: 0,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 3,
  },

  scanCornerBL: {
    left: 0,
    bottom: 0,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 3,
  },

  scanCornerBR: {
    right: 0,
    bottom: 0,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 3,
  },

  scanLine: {
    position: 'absolute',
    width: 18,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    left: 7,
    top: 15,
  },

  scanTextBox: {
    marginLeft: 13,
    flexShrink: 1,
  },

  scanTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.2,
  },

  scanSubtitle: {
    color: '#DCFCE7',
    marginTop: 2,
    fontSize: 12,
  },

  scanArrowBox: {
    width: 40,
    height: 40,
    borderRadius: 20,

    backgroundColor:
      'rgba(255,255,255,0.13)',

    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },

  scanArrow: {
    color: '#FFFFFF',
    fontSize: 31,
    lineHeight: 33,
    fontWeight: '300',
    marginTop: -3,
  },

  scanDecorationLarge: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    right: -44,
    bottom: -86,

    backgroundColor:
      'rgba(255,255,255,0.055)',
  },

  scanDecorationSmall: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    right: 46,
    bottom: -63,

    backgroundColor:
      'rgba(255,255,255,0.045)',
  },


  /*
    SECTION HEADERS
  */

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    marginTop: 17,
    marginBottom: 8,
  },

  sectionTitle: {
    color: '#0B1220',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },

  sectionCount: {
    color: '#60728F',
    fontSize: 13,
    fontWeight: '500',
  },


  /*
    INVENTORY HEALTH
  */

  inventoryGrid: {
    flexDirection: 'row',
    gap: 7,
  },

  inventoryCard: {
    flex: 1,
    minHeight: 94,

    borderRadius: 17,

    paddingHorizontal: 10,
    paddingVertical: 11,

    justifyContent: 'space-between',

    borderWidth: 1,

    shadowColor: '#203047',
    shadowOpacity: 0.055,
    shadowRadius: 7,

    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 2,
  },

  inventoryCardGood: {
    backgroundColor: '#F0FBF5',
    borderColor: '#D2EFE0',
  },

  inventoryCardWarning: {
    backgroundColor: '#FFF9EC',
    borderColor: '#F7EAC5',
  },

  inventoryCardDanger: {
    backgroundColor: '#FFF2F3',
    borderColor: '#F5DADF',
  },

  inventoryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    marginRight: 6,
  },

  goodDot: {
    backgroundColor: '#19B568',
  },

  warningDot: {
    backgroundColor: '#F6B817',
  },

  dangerDot: {
    backgroundColor: '#EC3442',
  },

  inventoryLabel: {
    flexShrink: 1,
    color: '#334B6B',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '600',
  },

  inventoryBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  inventoryValue: {
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '900',
    color: '#071225',
  },

  inventorySymbol: {
    fontSize: 23,
    lineHeight: 25,
    fontWeight: '800',
  },

  goodSymbol: {
    color: '#13A95C',
  },

  warningSymbol: {
    color: '#EEAD0D',
  },

  dangerSymbol: {
    color: '#C42C36',
  },


  /*
    TODAY'S ACTIVITY
  */

  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,

    flexDirection: 'row',
    alignItems: 'center',

    paddingVertical: 12,
    paddingHorizontal: 3,

    shadowColor: '#21334D',
    shadowOpacity: 0.055,
    shadowRadius: 8,

    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 3,
  },

  activityItem: {
    flex: 1,
    alignItems: 'center',
  },

  activityValue: {
    color: '#071225',
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
  },

  activityLabelRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },

  activitySymbol: {
    color: '#627A9B',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 3,
  },

  activityLabel: {
    color: '#627A9B',
    fontSize: 8.5,
    fontWeight: '600',
  },

  divider: {
    height: 34,
    width: 1,
    backgroundColor: '#DDE4EC',
  },


  /*
    QUICK ACTIONS
  */

  quickGrid: {
    gap: 7,
  },

  quickCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,

    minHeight: 54,

    paddingHorizontal: 10,
    paddingVertical: 6,

    flexDirection: 'row',
    alignItems: 'center',

    shadowColor: '#21334D',
    shadowOpacity: 0.045,
    shadowRadius: 7,

    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 2,
  },

  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconBoxGreen: {
    backgroundColor: '#ECFAF3',
  },

  iconBoxYellow: {
    backgroundColor: '#FFF5DB',
  },

  iconBoxRed: {
    backgroundColor: '#FEEBEC',
  },

  iconBoxBlue: {
    backgroundColor: '#E8F3FF',
  },

  iconBoxPurple: {
    backgroundColor: '#F2E9FF',
  },

  iconBoxSlate: {
    backgroundColor: '#EEF2F7',
  },

  iconBoxTeal: {
    backgroundColor: '#E7F8F7',
  },

  iconText: {
    fontSize: 20,
    fontWeight: '900',
  },

  iconTextGreen: {
    color: '#08783E',
  },

  iconTextYellow: {
    color: '#09804A',
  },

  iconTextRed: {
    color: '#C12834',
  },

  iconTextBlue: {
    color: '#0B6FC6',
  },

  iconTextPurple: {
    color: '#7436D7',
  },

  iconTextSlate: {
    color: '#54657C',
  },

  iconTextTeal: {
    color: '#0F766E',
  },

  quickTextBox: {
    flex: 1,
    marginLeft: 11,
  },

  quickTitle: {
    color: '#0B1220',
    fontWeight: '900',
    fontSize: 14,
  },

  quickSubtitle: {
    color: '#8291AA',
    fontSize: 11,
    marginTop: 0,
  },

  quickArrow: {
    color: '#647996',
    fontSize: 27,
    lineHeight: 29,
    marginRight: 2,
    marginTop: -2,
  },

  buttonPressed: {
    opacity: 0.74,

    transform: [
      {
        scale: 0.992,
      },
    ],
  },

  footer: {
    color: '#9AA7B8',
    textAlign: 'center',
    fontSize: 9,
    marginTop: 13,
  },
});

