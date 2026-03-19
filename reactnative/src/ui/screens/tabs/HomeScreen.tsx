import React, {useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../../../context/ThemeContext';
import {useUserContext} from '../../../context/UserContext';
import {formatCurrency, formatDate} from '../../../utils/helpers';
import {paymentMethodConfig} from '../../theme/colors';
import SyncStatusBanner from '../../components/SyncStatusBanner';

export default function HomeScreen({navigation}: any) {
  const {colors, isDark} = useTheme();
  const {
    profile,
    transactions,
    workflows,
    balances,
    loading,
    isOnline,
    manualRefresh,
  } = useUserContext();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await manualRefresh();
    setRefreshing(false);
  }, [manualRefresh]);

  const totalBalance =
    (balances?.bank || 0) +
    (balances?.cash || 0) +
    (balances?.splitwise || 0);

  const recentTransactions = transactions.slice(0, 5);

  const quickActions = workflows.slice(0, 4);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, {color: colors.textMuted}]}>
              {greeting()},
            </Text>
            <Text style={[styles.userName, {color: colors.text}]}>
              {profile?.name || 'User'} 👋
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View
              style={[
                styles.onlineDot,
                {backgroundColor: isOnline ? colors.success : colors.warning},
              ]}
            />
            <Text style={{fontSize: 12, color: colors.textMuted}}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        <SyncStatusBanner />

        {/* Total Balance */}
        <View
          style={[
            styles.balanceCard,
            {
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
            },
          ]}>
          <Text style={[styles.balanceLabel, {color: colors.primaryForeground + 'aa'}]}>
            Total Balance
          </Text>
          <Text style={[styles.balanceAmount, {color: colors.primaryForeground}]}>
            ₹{formatCurrency(totalBalance)}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddTransaction')}>
            <Icon name="add" size={20} color={colors.primary} />
            <Text style={[styles.addButtonText, {color: colors.primary}]}>
              Add Transaction
            </Text>
          </TouchableOpacity>
        </View>

        {/* Payment Method Balances */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>
            Payment Methods
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.methodCards}>
              {(
                Object.entries(balances || {}) as [string, number][]
              ).map(([method, balance]) => {
                const config =
                  paymentMethodConfig[method as keyof typeof paymentMethodConfig];
                if (!config) return null;
                const methodColor = isDark ? config.darkColor : config.lightColor;
                const methodBg = isDark ? config.darkBg : config.lightBg;

                return (
                  <View
                    key={method}
                    style={[
                      styles.methodCard,
                      {backgroundColor: methodBg, borderColor: methodColor + '30'},
                    ]}>
                    <Icon
                      name={
                        method === 'bank'
                          ? 'card'
                          : method === 'cash'
                            ? 'cash'
                            : 'swap-horizontal'
                      }
                      size={22}
                      color={methodColor}
                    />
                    <Text style={[styles.methodLabel, {color: methodColor}]}>
                      {config.label}
                    </Text>
                    <Text style={[styles.methodAmount, {color: colors.text}]}>
                      ₹{formatCurrency(balance)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Quick Actions */}
        {quickActions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, {color: colors.text}]}>
                Quick Actions
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('WorkflowsTab')}>
                <Text style={{color: colors.primary, fontSize: 14}}>
                  See All
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{flexDirection: 'row', gap: 10, paddingHorizontal: 16}}>
                {quickActions.map(wf => (
                  <TouchableOpacity
                    key={wf._id}
                    style={[
                      styles.quickAction,
                      {backgroundColor: colors.card, borderColor: colors.border},
                    ]}
                    onPress={() =>
                      navigation.navigate('AddTransaction', {workflow: wf})
                    }>
                    <Icon
                      name={
                        wf.type === 'expense' ? 'arrow-down' : 'arrow-up'
                      }
                      size={18}
                      color={
                        wf.type === 'expense' ? colors.error : colors.success
                      }
                    />
                    <Text
                      style={[styles.quickActionName, {color: colors.text}]}
                      numberOfLines={1}>
                      {wf.name}
                    </Text>
                    {wf.amount && (
                      <Text
                        style={[
                          styles.quickActionAmount,
                          {color: colors.textMuted},
                        ]}>
                        ₹{formatCurrency(wf.amount)}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Recent Transactions */}
        <View style={[styles.section, {paddingBottom: 30}]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>
              Recent Transactions
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('TransactionsTab')}>
              <Text style={{color: colors.primary, fontSize: 14}}>See All</Text>
            </TouchableOpacity>
          </View>

          {recentTransactions.length === 0 ? (
            <View style={[styles.emptyState, {backgroundColor: colors.card}]}>
              <Icon name="receipt-outline" size={40} color={colors.textMuted} />
              <Text
                style={[styles.emptyText, {color: colors.textMuted}]}>
                No transactions yet
              </Text>
              <TouchableOpacity
                style={[styles.emptyButton, {backgroundColor: colors.primary}]}
                onPress={() => navigation.navigate('AddTransaction')}>
                <Text
                  style={{
                    color: colors.primaryForeground,
                    fontWeight: '600',
                  }}>
                  Add First Transaction
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            recentTransactions.map(txn => (
              <View
                key={txn._id}
                style={[
                  styles.txnCard,
                  {backgroundColor: colors.card, borderColor: colors.border},
                ]}>
                <View
                  style={[
                    styles.txnIcon,
                    {
                      backgroundColor:
                        txn.type === 'expense' ? colors.errorBg : colors.successBg,
                    },
                  ]}>
                  <Icon
                    name={txn.type === 'expense' ? 'arrow-down' : 'arrow-up'}
                    size={18}
                    color={txn.type === 'expense' ? colors.error : colors.success}
                  />
                </View>
                <View style={{flex: 1}}>
                  <Text
                    style={[styles.txnDesc, {color: colors.text}]}
                    numberOfLines={1}>
                    {txn.description}
                  </Text>
                  <Text style={[styles.txnMeta, {color: colors.textMuted}]}>
                    {formatDate(txn.date)} · {txn.category}
                  </Text>
                </View>
                <View style={{alignItems: 'flex-end'}}>
                  <Text
                    style={[
                      styles.txnAmount,
                      {
                        color:
                          txn.type === 'expense' ? colors.error : colors.success,
                      },
                    ]}>
                    {txn.type === 'expense' ? '-' : '+'}₹
                    {formatCurrency(txn.amount)}
                  </Text>
                  {txn.isLocal && (
                    <View style={styles.pendingBadge}>
                      <Icon name="time" size={10} color={colors.warning} />
                      <Text
                        style={[styles.pendingText, {color: colors.warning}]}>
                        Pending
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: {fontSize: 14},
  userName: {fontSize: 24, fontWeight: 'bold', marginTop: 2},
  headerRight: {flexDirection: 'row', alignItems: 'center', gap: 6},
  onlineDot: {width: 8, height: 8, borderRadius: 4},
  balanceCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  balanceLabel: {fontSize: 14, fontWeight: '500'},
  balanceAmount: {fontSize: 36, fontWeight: 'bold', marginTop: 4},
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 16,
    gap: 6,
  },
  addButtonText: {fontWeight: '600', fontSize: 14},
  section: {marginBottom: 20},
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  methodCards: {flexDirection: 'row', gap: 12, paddingHorizontal: 16},
  methodCard: {
    width: 130,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  methodLabel: {fontSize: 12, fontWeight: '600'},
  methodAmount: {fontSize: 18, fontWeight: 'bold'},
  quickAction: {
    width: 120,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  quickActionName: {fontSize: 13, fontWeight: '600'},
  quickActionAmount: {fontSize: 12},
  emptyState: {
    marginHorizontal: 16,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {fontSize: 16, fontWeight: '500'},
  emptyButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  txnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txnDesc: {fontSize: 15, fontWeight: '600'},
  txnMeta: {fontSize: 12, marginTop: 2},
  txnAmount: {fontSize: 16, fontWeight: '700'},
  pendingBadge: {flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2},
  pendingText: {fontSize: 10, fontWeight: '600'},
});
