import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../../context/ThemeContext';
import {useUserContext} from '../../context/UserContext';
import {useToast} from '../../context/ToastContext';
import {CATEGORIES, paymentMethodConfig} from '../theme/colors';
import {
  TransactionType,
  PaymentMethod,
  IWorkflow,
} from '../../domain/types';
import {formatCurrency} from '../../utils/helpers';

const paymentMethods: {id: PaymentMethod; label: string; icon: string}[] = [
  {id: 'bank', label: 'Bank (UPI)', icon: 'card'},
  {id: 'cash', label: 'Cash', icon: 'cash'},
  {id: 'splitwise', label: 'Splitwise', icon: 'swap-horizontal'},
];

export default function AddTransactionScreen({navigation, route}: any) {
  const {colors, isDark} = useTheme();
  const {addTransaction, profile} = useUserContext();
  const {showToast} = useToast();

  const workflow: IWorkflow | undefined = route?.params?.workflow;

  const [type, setType] = useState<TransactionType>(workflow?.type || 'expense');
  const [amount, setAmount] = useState(workflow?.amount?.toString() || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [category, setCategory] = useState(workflow?.category || 'other');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    workflow?.paymentMethod || 'bank',
  );
  const [isSplit, setIsSplit] = useState(
    (workflow?.splitAmount && workflow.splitAmount > 0) || false,
  );
  const [splitAmount, setSplitAmount] = useState(
    workflow?.splitAmount?.toString() || '',
  );
  const [saving, setSaving] = useState(false);

  const availableMethods = paymentMethods.filter(m =>
    profile?.paymentMethods?.includes(m.id),
  );

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }
    if (!description.trim()) {
      showToast('Please enter a description', 'error');
      return;
    }
    if (isSplit && splitAmount && parseFloat(splitAmount) > parseFloat(amount)) {
      showToast('Split amount cannot exceed total amount', 'error');
      return;
    }

    setSaving(true);
    try {
      await addTransaction({
        type,
        amount: parseFloat(amount),
        description: description.trim(),
        category,
        paymentMethod,
        splitAmount: isSplit && splitAmount ? parseFloat(splitAmount) : undefined,
      });
      showToast(
        `${type === 'expense' ? 'Expense' : 'Income'} added successfully`,
        'success',
      );
      navigation.goBack();
    } catch (error) {
      showToast('Failed to add transaction', 'error');
    } finally {
      setSaving(false);
    }
  };

  const netAmount =
    type === 'expense' && isSplit && splitAmount
      ? parseFloat(amount || '0') - parseFloat(splitAmount || '0')
      : null;

  return (
    <KeyboardAvoidingView
      style={[styles.container, {backgroundColor: colors.background}]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={{padding: 16}}
        keyboardShouldPersistTaps="handled">
        {/* Type Selector */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, {color: colors.textMuted}]}>
            Transaction Type
          </Text>
          <View style={{flexDirection: 'row', gap: 12}}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                {
                  backgroundColor:
                    type === 'expense' ? colors.errorBg : colors.card,
                  borderColor:
                    type === 'expense' ? colors.error : colors.border,
                },
              ]}
              onPress={() => setType('expense')}>
              <Icon
                name="arrow-down"
                size={24}
                color={type === 'expense' ? colors.error : colors.textMuted}
              />
              <Text
                style={{
                  marginTop: 8,
                  fontWeight: '600',
                  color: type === 'expense' ? colors.error : colors.textMuted,
                }}>
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                {
                  backgroundColor:
                    type === 'income' ? colors.successBg : colors.card,
                  borderColor:
                    type === 'income' ? colors.success : colors.border,
                },
              ]}
              onPress={() => setType('income')}>
              <Icon
                name="arrow-up"
                size={24}
                color={type === 'income' ? colors.success : colors.textMuted}
              />
              <Text
                style={{
                  marginTop: 8,
                  fontWeight: '600',
                  color: type === 'income' ? colors.success : colors.textMuted,
                }}>
                Income
              </Text>
            </TouchableOpacity>
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
              {backgroundColor: colors.card, borderColor: colors.border},
            ]}>
            <Text style={{fontSize: 24, color: colors.text, marginRight: 8}}>
              ₹
            </Text>
            <TextInput
              style={{
                flex: 1,
                fontSize: 24,
                fontWeight: '600',
                color: colors.text,
                paddingVertical: 16,
              }}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              autoFocus
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
            placeholder="What was this for?"
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
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
                      category === cat.id
                        ? isDark ? `${cat.color}30` : `${cat.color}20`
                        : colors.card,
                    borderColor:
                      category === cat.id ? cat.color : colors.border,
                  },
                ]}
                onPress={() => setCategory(cat.id)}>
                <Text
                  style={{
                    color:
                      category === cat.id ? cat.color : colors.textMuted,
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
              const isSelected = paymentMethod === method.id;
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
                  onPress={() => setPaymentMethod(method.id)}>
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

        {/* Split Toggle */}
        {type === 'expense' && (
          <View style={styles.fieldGroup}>
            <TouchableOpacity
              style={[
                styles.splitToggle,
                {
                  backgroundColor: isSplit ? colors.infoBg : colors.card,
                  borderColor: isSplit ? colors.info : colors.border,
                },
              ]}
              onPress={() => setIsSplit(!isSplit)}>
              <Icon
                name="git-branch-outline"
                size={22}
                color={isSplit ? colors.info : colors.textMuted}
              />
              <View style={{flex: 1, marginLeft: 12}}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: isSplit ? colors.info : colors.text,
                  }}>
                  Split Transaction
                </Text>
                <Text style={{fontSize: 12, color: colors.textMuted, marginTop: 2}}>
                  Someone owes you back part of this
                </Text>
              </View>
              <Icon
                name={isSplit ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={isSplit ? colors.info : colors.border}
              />
            </TouchableOpacity>

            {isSplit && (
              <View style={{marginTop: 12}}>
                <Text style={[styles.fieldLabel, {color: colors.textMuted}]}>
                  Amount Owed Back
                </Text>
                <View
                  style={[
                    styles.amountInput,
                    {backgroundColor: colors.card, borderColor: colors.border},
                  ]}>
                  <Text style={{fontSize: 20, color: colors.text, marginRight: 8}}>
                    ₹
                  </Text>
                  <TextInput
                    style={{
                      flex: 1,
                      fontSize: 20,
                      color: colors.text,
                      paddingVertical: 14,
                    }}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={splitAmount}
                    onChangeText={setSplitAmount}
                  />
                </View>
                {netAmount !== null && netAmount >= 0 && (
                  <View
                    style={[
                      styles.netBanner,
                      {backgroundColor: colors.successBg},
                    ]}>
                    <Text style={{color: colors.success, fontWeight: '600'}}>
                      Your net expense: ₹{formatCurrency(netAmount)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: colors.primary,
              opacity: saving ? 0.7 : 1,
            },
          ]}
          onPress={handleSave}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text
              style={{
                color: colors.primaryForeground,
                fontSize: 16,
                fontWeight: '600',
              }}>
              Add {type === 'expense' ? 'Expense' : 'Income'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  fieldGroup: {marginBottom: 20},
  fieldLabel: {fontSize: 14, fontWeight: '600', marginBottom: 8},
  typeButton: {
    flex: 1,
    padding: 16,
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
  splitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  netBanner: {
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  saveButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
});
