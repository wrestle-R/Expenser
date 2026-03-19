import React, {useState, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../../../context/ThemeContext';
import {useUserContext} from '../../../context/UserContext';
import {useToast} from '../../../context/ToastContext';
import {formatCurrency, formatDate, formatFullDate} from '../../../utils/helpers';
import {CATEGORIES, paymentMethodConfig} from '../../theme/colors';
import ConfirmModal from '../../components/ConfirmModal';
import SyncStatusBanner from '../../components/SyncStatusBanner';
import {
  ITransaction,
  TransactionType,
  PaymentMethod,
} from '../../../domain/types';

const ITEMS_PER_PAGE = 20;

export default function TransactionsScreen() {
  const {colors, isDark} = useTheme();
  const {
    transactions,
    updateTransaction,
    deleteTransaction,
    manualRefresh,
    isOnline,
    profile,
  } = useUserContext();
  const {showToast} = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Edit modal
  const [editingTxn, setEditingTxn] = useState<ITransaction | null>(null);
  const [editType, setEditType] = useState<TransactionType>('expense');
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState('other');
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('bank');
  const [editSplitAmount, setEditSplitAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await manualRefresh();
    setRefreshing(false);
  }, [manualRefresh]);

  const sortedTransactions = useMemo(
    () =>
      [...transactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [transactions],
  );

  const visibleTxns = sortedTransactions.slice(0, visibleCount);
  const hasMore = visibleCount < sortedTransactions.length;

  const openEdit = (txn: ITransaction) => {
    if (txn.isLocal) {
      showToast('Cannot edit pending transactions', 'warning');
      return;
    }
    setEditingTxn(txn);
    setEditType(txn.type);
    setEditAmount(txn.amount.toString());
    setEditDesc(txn.description);
    setEditCategory(txn.category);
    setEditPaymentMethod(txn.paymentMethod);
    setEditSplitAmount(txn.splitAmount ? txn.splitAmount.toString() : '');
  };

  const handleEdit = async () => {
    if (!editingTxn) return;
    setSaving(true);
    try {
      await updateTransaction(editingTxn._id, {
        type: editType,
        amount: parseFloat(editAmount),
        description: editDesc,
        category: editCategory,
        paymentMethod: editPaymentMethod,
        splitAmount: editSplitAmount ? parseFloat(editSplitAmount) : undefined,
      });
      showToast('Transaction updated', 'success');
      setEditingTxn(null);
    } catch (error) {
      showToast('Failed to update transaction', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteTransaction(deleteId);
      showToast('Transaction deleted', 'success');
      setDeleteId(null);
    } catch (error) {
      showToast('Failed to delete transaction', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const availableMethods = [
    {id: 'bank' as PaymentMethod, label: 'Bank (UPI)', icon: 'card'},
    {id: 'cash' as PaymentMethod, label: 'Cash', icon: 'cash'},
    {id: 'splitwise' as PaymentMethod, label: 'Splitwise', icon: 'swap-horizontal'},
  ].filter(m => profile?.paymentMethods?.includes(m.id));

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, {color: colors.text}]}>
          Transactions
        </Text>
        <Text style={[styles.headerCount, {color: colors.textMuted}]}>
          {transactions.length} total
        </Text>
      </View>

      <SyncStatusBanner />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {visibleTxns.length === 0 ? (
          <View style={[styles.emptyState, {backgroundColor: colors.card}]}>
            <Icon name="receipt-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, {color: colors.text}]}>
              No transactions yet
            </Text>
            <Text style={[styles.emptySubtitle, {color: colors.textMuted}]}>
              Start tracking your income and expenses
            </Text>
          </View>
        ) : (
          visibleTxns.map(txn => {
            const pmConfig =
              paymentMethodConfig[txn.paymentMethod as keyof typeof paymentMethodConfig];
            const pmColor = pmConfig
              ? isDark ? pmConfig.darkColor : pmConfig.lightColor
              : colors.textMuted;

            return (
              <TouchableOpacity
                key={txn._id}
                style={[
                  styles.txnCard,
                  {backgroundColor: colors.card, borderColor: colors.border},
                ]}
                onPress={() => openEdit(txn)}
                onLongPress={() => {
                  if (!txn.isLocal) setDeleteId(txn._id);
                }}>
                <View
                  style={[
                    styles.txnIcon,
                    {
                      backgroundColor:
                        txn.type === 'expense'
                          ? colors.errorBg
                          : colors.successBg,
                    },
                  ]}>
                  <Icon
                    name={txn.type === 'expense' ? 'arrow-down' : 'arrow-up'}
                    size={18}
                    color={
                      txn.type === 'expense' ? colors.error : colors.success
                    }
                  />
                </View>
                <View style={{flex: 1}}>
                  <Text
                    style={[styles.txnDesc, {color: colors.text}]}
                    numberOfLines={1}>
                    {txn.description}
                  </Text>
                  <View style={styles.txnMetaRow}>
                    <Text style={[styles.txnMeta, {color: colors.textMuted}]}>
                      {formatDate(txn.date)}
                    </Text>
                    <View
                      style={[styles.categoryBadge, {backgroundColor: pmColor + '20'}]}>
                      <Text style={{color: pmColor, fontSize: 10, fontWeight: '600'}}>
                        {txn.category}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={{alignItems: 'flex-end'}}>
                  <Text
                    style={[
                      styles.txnAmount,
                      {
                        color:
                          txn.type === 'expense'
                            ? colors.error
                            : colors.success,
                      },
                    ]}>
                    {txn.type === 'expense' ? '-' : '+'}₹
                    {formatCurrency(txn.amount)}
                  </Text>
                  {txn.splitAmount && txn.splitAmount > 0 && (
                    <Text style={[styles.splitText, {color: colors.info}]}>
                      Split: ₹{formatCurrency(txn.splitAmount)}
                    </Text>
                  )}
                  {txn.isLocal && (
                    <View style={styles.pendingBadge}>
                      <Icon name="time" size={10} color={colors.warning} />
                      <Text style={{fontSize: 10, color: colors.warning, fontWeight: '600'}}>
                        Pending
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {hasMore && (
          <TouchableOpacity
            style={[styles.loadMore, {borderColor: colors.border}]}
            onPress={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}>
            <Text style={{color: colors.primary, fontWeight: '600'}}>
              Load More
            </Text>
          </TouchableOpacity>
        )}

        <View style={{height: 30}} />
      </ScrollView>

      {/* ─── Edit Modal ─── */}
      <Modal
        visible={!!editingTxn}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingTxn(null)}>
        <View style={[styles.modalOverlay]}>
          <View
            style={[
              styles.modalContent,
              {backgroundColor: colors.background},
            ]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, {color: colors.text}]}>
                Edit Transaction
              </Text>
              <TouchableOpacity onPress={() => setEditingTxn(null)}>
                <Icon name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, {color: colors.textMuted}]}>
                  Type
                </Text>
                <View style={{flexDirection: 'row', gap: 12}}>
                  {['expense', 'income'].map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.typeButton,
                        {
                          backgroundColor:
                            editType === t
                              ? t === 'expense'
                                ? colors.errorBg
                                : colors.successBg
                              : colors.card,
                          borderColor:
                            editType === t
                              ? t === 'expense'
                                ? colors.error
                                : colors.success
                              : colors.border,
                        },
                      ]}
                      onPress={() => setEditType(t as TransactionType)}>
                      <Text
                        style={{
                          fontWeight: '600',
                          color:
                            editType === t
                              ? t === 'expense'
                                ? colors.error
                                : colors.success
                              : colors.textMuted,
                        }}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Amount */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, {color: colors.textMuted}]}>
                  Amount
                </Text>
                <View
                  style={[
                    styles.amountInput,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}>
                  <Text style={{fontSize: 24, color: colors.text}}>₹</Text>
                  <TextInput
                    style={{flex: 1, fontSize: 24, fontWeight: '600', color: colors.text, paddingVertical: 12}}
                    keyboardType="numeric"
                    value={editAmount}
                    onChangeText={setEditAmount}
                  />
                </View>
              </View>

              {/* Description */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, {color: colors.textMuted}]}>
                  Description
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={editDesc}
                  onChangeText={setEditDesc}
                />
              </View>

              {/* Category */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, {color: colors.textMuted}]}>
                  Category
                </Text>
                <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryPill,
                        {
                          backgroundColor:
                            editCategory === cat.id
                              ? isDark ? `${cat.color}30` : `${cat.color}20`
                              : colors.card,
                          borderColor:
                            editCategory === cat.id ? cat.color : colors.border,
                        },
                      ]}
                      onPress={() => setEditCategory(cat.id)}>
                      <Text
                        style={{
                          color:
                            editCategory === cat.id
                              ? cat.color
                              : colors.textMuted,
                          fontWeight: '500',
                        }}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Payment Method */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, {color: colors.textMuted}]}>
                  Payment Method
                </Text>
                <View style={{gap: 8}}>
                  {availableMethods.map(method => {
                    const config = paymentMethodConfig[method.id];
                    const isSelected = editPaymentMethod === method.id;
                    const methodColor = isDark ? config.darkColor : config.lightColor;
                    const methodBg = isDark ? config.darkBg : config.lightBg;

                    return (
                      <TouchableOpacity
                        key={method.id}
                        style={[
                          styles.paymentMethodBtn,
                          {
                            backgroundColor: isSelected ? methodBg : colors.card,
                            borderColor: isSelected ? methodColor : colors.border,
                          },
                        ]}
                        onPress={() => setEditPaymentMethod(method.id)}>
                        <Icon
                          name={method.icon}
                          size={24}
                          color={isSelected ? methodColor : colors.textMuted}
                        />
                        <Text
                          style={{
                            marginLeft: 12,
                            fontSize: 16,
                            fontWeight: '500',
                            color: isSelected ? methodColor : colors.text,
                          }}>
                          {method.label}
                        </Text>
                        {isSelected && (
                          <Icon
                            name="checkmark-circle"
                            size={20}
                            color={methodColor}
                            style={{marginLeft: 'auto'}}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Split Amount */}
              {editPaymentMethod === 'splitwise' && (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, {color: colors.textMuted}]}>
                    Split Amount
                  </Text>
                  <View
                    style={[
                      styles.amountInput,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}>
                    <Text style={{fontSize: 20, color: colors.text}}>₹</Text>
                    <TextInput
                      style={{flex: 1, fontSize: 20, color: colors.text, paddingVertical: 12}}
                      keyboardType="numeric"
                      value={editSplitAmount}
                      onChangeText={setEditSplitAmount}
                    />
                  </View>
                </View>
              )}

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, {backgroundColor: colors.primary}]}
                onPress={handleEdit}
                disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={{color: colors.primaryForeground, fontSize: 16, fontWeight: '600'}}>
                    Save Changes
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        visible={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        confirmText="Delete"
        confirmColor="destructive"
        icon="trash-outline"
        loading={deleting}
      />
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
    paddingVertical: 16,
  },
  headerTitle: {fontSize: 28, fontWeight: 'bold'},
  headerCount: {fontSize: 14},
  emptyState: {
    margin: 16,
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {fontSize: 18, fontWeight: '600'},
  emptySubtitle: {fontSize: 14, textAlign: 'center'},
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
  txnMetaRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3},
  txnMeta: {fontSize: 12},
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  txnAmount: {fontSize: 16, fontWeight: '700'},
  splitText: {fontSize: 11, marginTop: 1},
  pendingBadge: {flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2},
  loadMore: {
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  // Edit Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {fontSize: 20, fontWeight: '700'},
  fieldGroup: {marginBottom: 20},
  fieldLabel: {fontSize: 14, fontWeight: '600', marginBottom: 8},
  typeButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    gap: 8,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  paymentMethodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  saveButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
});
