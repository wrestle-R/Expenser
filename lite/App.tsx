import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import type { Session } from '@supabase/supabase-js';
import { ThemeProvider, useTheme } from '../expo/context/ThemeContext';
import { UserProvider, useUserContext } from '../expo/context/UserContext';
import { Colors } from '../expo/constants/theme';
import { initialSession, supabase } from '../expo/lib/supabase';
import { indexTransactions, searchTransactions } from '../expo/lib/transaction-list';
import SyncStatusBanner from '../expo/components/SyncStatusBanner';
import { getBankNotificationAccessEnabled, openBankNotificationAccessSettings } from '../expo/lib/bank-imports';
import { getTransactionDisplayFields } from '../expo/lib/transaction-review';
import { generateTempId } from '../expo/lib/utils';
import { parseTransactionDraft } from './transaction-draft';
import type { ITransaction, PaymentMethod, TransactionType } from '../expo/lib/types';

void SplashScreen.preventAutoHideAsync().catch(() => {});
const logo = require('../expo/assets/images/splash-icon.png');
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
type Palette = typeof Colors.light;

function Button({ label, onPress, colors, secondary = false, disabled = false, danger = false }: { label: string; onPress: () => void; colors: Palette; secondary?: boolean; disabled?: boolean; danger?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: danger ? colors.errorBg : secondary ? colors.muted : colors.primary, opacity: disabled ? .45 : pressed ? .7 : 1 }]}><Text style={{ color: danger ? colors.error : secondary ? colors.text : colors.primaryForeground, fontWeight: '600', fontSize: 14 }}>{label}</Text></Pressable>;
}
function Field({ label, colors, ...props }: { label: string; colors: Palette } & React.ComponentProps<typeof TextInput>) {
  return <View style={{ marginBottom: 16 }}><Text style={[styles.label, { color: colors.text }]}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }, props.style]} /></View>;
}
function SignIn({ colors, onDone }: { colors: Palette; onDone: () => void }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = async () => {
    if (busy) return;
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true); setError('');
    try { const result = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (result.error) throw result.error; onDone(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not sign in. Please try again.'); }
    finally { setBusy(false); }
  };
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }}><View style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>
    <Image source={logo} style={{ width: 64, height: 64, marginBottom: 24 }} resizeMode="contain" accessibilityLabel="Expenser logo" />
    <Text style={[styles.title, { color: colors.text }]}>Expenser <Text style={{ color: colors.textMuted }}>lite</Text></Text>
    <Text style={{ color: colors.textMuted, lineHeight: 22, marginTop: 8, marginBottom: 28 }}>{'Your transactions. A little lighter.\nSign in with your existing Expenser account.'}</Text>
    <Field label="Email" colors={colors} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" editable={!busy} />
    <Field label="Password" colors={colors} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" editable={!busy} onSubmitEditing={() => void submit()} />
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.error, marginBottom: 16 }}>{error}</Text>}
    <Button label={busy ? 'Signing in…' : 'Sign in'} onPress={() => void submit()} colors={colors} disabled={busy} />
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://expenser-rdp.vercel.app/sign-up')} style={{ paddingVertical: 20 }}><Text style={{ textAlign: 'center', color: colors.textMuted }}>New here? Create an account</Text></Pressable>
  </View></ScrollView></KeyboardAvoidingView>;
}
const Row = memo(function Row({ item, colors, onEdit }: { item: ITransaction; colors: Palette; onEdit: (item: ITransaction) => void }) {
  const display = getTransactionDisplayFields(item);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${display.description}, ${money.format(item.amount)}`} onPress={() => onEdit(item)} style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.muted : colors.card, borderColor: colors.border }]}>
    <View style={{ width: 28, alignItems: 'center' }}><Text style={{ color: item.type === 'income' ? colors.success : colors.textMuted, fontSize: 24 }}>{item.type === 'income' ? '↙' : '↗'}</Text></View>
    <View style={{ flex: 1, marginHorizontal: 12 }}><Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{display.description}</Text><Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12, marginTop: 5 }}>{item.reviewStatus === 'needs_category' ? 'Choose category' : item.category} · {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {item.paymentMethod}</Text></View>
    <Text numberOfLines={1} style={{ color: item.type === 'income' ? colors.success : colors.text, fontWeight: '600', fontVariant: ['tabular-nums'], fontSize: 15, maxWidth: '40%' }}>{item.type === 'income' ? '+' : '−'}{money.format(item.amount)}</Text>
  </Pressable>;
});
function Editor({ item, colors, onClose }: { item: ITransaction | null; colors: Palette; onClose: () => void }) {
  const { addTransaction, updateTransaction, deleteTransaction } = useUserContext();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState(item?.amount.toString() ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [category, setCategory] = useState(item?.category === 'bank import' ? '' : item?.category ?? '');
  const [type, setType] = useState<TransactionType>(item?.type ?? 'expense');
  const [method, setMethod] = useState<PaymentMethod>(item?.paymentMethod ?? 'bank');
  const [date, setDate] = useState((item ? new Date(item.date) : new Date()).toLocaleDateString('en-CA'));
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const requestId = useRef(generateTempId());
  const save = async () => {
    if (saving.current) return;
    try {
      const payload = parseTransactionDraft({ amount, description, category, type, paymentMethod: method, date });
      if (item?.splitAmount && payload.amount < item.splitAmount) throw new Error('Amount cannot be less than the existing split.');
      saving.current = true; setBusy(true); setError('');
      // Preserve the original timestamp when the calendar date is unchanged.
      if (item && new Date(item.date).toLocaleDateString('en-CA') === date) payload.date = item.date;
      if (item) await updateTransaction(item._id, payload); else await addTransaction({ ...payload, clientRequestId: requestId.current });
      onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save. Please try again.'); }
    finally { saving.current = false; setBusy(false); }
  };
  const remove = () => {
    if (!item || saving.current) return;
    Alert.alert('Delete transaction?', 'This also deletes it from your Expenser account when you sync.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
      if (saving.current) return;
      saving.current = true; setBusy(true);
      try { await deleteTransaction(item._id); onClose(); } catch { setError('Could not delete. Please try again.'); }
      finally { saving.current = false; setBusy(false); }
    } }]);
  };
  const categories = type === 'expense' ? ['food', 'transport', 'shopping', 'other'] : ['salary', 'gift', 'other'];
  return <Modal animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}><View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
    <View style={styles.between}><Text style={[styles.title, { color: colors.text, fontSize: 25 }]}>{item ? 'Edit transaction' : 'Add transaction'}</Text><Button label="Cancel" colors={colors} secondary disabled={busy} onPress={onClose} /></View>
    <View style={[styles.chips, { marginVertical: 24 }]}>{(['expense', 'income'] as const).map((value) => <Button key={value} label={value === 'expense' ? 'Expense' : 'Income'} colors={colors} secondary={type !== value} disabled={busy} onPress={() => setType(value)} />)}</View>
    <Field label="Amount (₹)" colors={colors} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" editable={!busy} style={{ fontSize: 30, fontVariant: ['tabular-nums'] }} />
    <Field label="Description" colors={colors} value={description} onChangeText={setDescription} placeholder="What was it for?" maxLength={200} editable={!busy} />
    <Field label="Category" colors={colors} value={category} onChangeText={setCategory} placeholder="Choose or enter a category" maxLength={80} editable={!busy} />
    <View style={[styles.chips, { marginBottom: 20 }]}>{categories.map((value) => <Button key={value} label={value} colors={colors} secondary={category !== value} disabled={busy} onPress={() => setCategory(value)} />)}</View>
    <Text style={[styles.label, { color: colors.text }]}>Payment method</Text><View style={[styles.chips, { marginBottom: 20 }]}>{(['bank', 'cash', 'splitwise'] as const).map((value) => <Button key={value} label={value} colors={colors} secondary={method !== value} disabled={busy} onPress={() => setMethod(value)} />)}</View>
    <Field label="Date (YYYY-MM-DD)" colors={colors} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" editable={!busy} />
    {!!item?.splitAmount && <Text style={{ color: colors.textMuted, marginBottom: 16 }}>Existing split of {money.format(item.splitAmount)} will be preserved.</Text>}
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.error, marginBottom: 16 }}>{error}</Text>}
    <Button label={busy ? 'Saving…' : 'Save transaction'} colors={colors} disabled={busy} onPress={() => void save()} />
    {item && <View style={{ marginTop: 20 }}><Button label="Delete transaction" colors={colors} danger disabled={busy} onPress={remove} /></View>}
    <Text style={{ color: colors.textMuted, marginTop: 20, fontSize: 12, textAlign: 'center' }}>Saved on this device first. Syncs with your account when online.</Text>
  </ScrollView></KeyboardAvoidingView></View></Modal>;
}
function Transactions({ colors, onSignIn }: { colors: Palette; onSignIn: () => void }) {
  const { transactions, loading, manualRefresh, syncStatus, bankImportStatus, bankReviewEvents, retryBankReviewEvent } = useUserContext();
  const { toggleTheme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(''), deferred = useDeferredValue(query);
  const index = useMemo(() => indexTransactions(transactions), [transactions]);
  const data = useMemo(() => searchTransactions(index, deferred), [index, deferred]);
  const [editor, setEditor] = useState<{ item: ITransaction | null } | null>(null);
  const [access, setAccess] = useState(getBankNotificationAccessEnabled), [reviewsOpen, setReviewsOpen] = useState(false);
  useEffect(() => { const sub = AppState.addEventListener('change', (state) => { if (state === 'active') setAccess(getBankNotificationAccessEnabled()); }); return () => sub.remove(); }, []);
  const edit = useCallback((item: ITransaction) => setEditor({ item }), []);
  const renderRow = useCallback(({ item }: { item: ITransaction }) => <Row item={item} colors={colors} onEdit={edit} />, [colors, edit]);
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
    <View style={[styles.between, { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20 }]}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Image source={logo} style={{ width: 32, height: 32 }} resizeMode="contain" accessibilityLabel="Expenser logo" /><Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, letterSpacing: -.6 }}>expenser <Text style={{ color: colors.textMuted, fontWeight: '400' }}>lite</Text></Text></View><Pressable accessibilityRole="button" accessibilityLabel={isDark ? 'Use light theme' : 'Use dark theme'} onPress={toggleTheme} hitSlop={10} style={{ padding: 8 }}><Text style={{ color: colors.text, fontSize: 22 }}>{isDark ? '☀' : '☾'}</Text></Pressable></View>
    <View style={[styles.between, { paddingHorizontal: 20, marginBottom: 20 }]}><View><Text style={[styles.title, { color: colors.text }]}>Transactions</Text><Text style={{ color: colors.textMuted, marginTop: 6 }}>{data.length.toLocaleString('en-IN')} {query ? 'matching' : 'saved'} · all accounts</Text></View><Button label="+ Add" colors={colors} onPress={() => setEditor({ item: null })} /></View>
    <SyncStatusBanner status={syncStatus} colors={colors} onRetry={() => void manualRefresh()} onSignIn={onSignIn} />
    {!access && <Pressable accessibilityRole="button" onPress={() => void openBankNotificationAccessSettings()} style={{ paddingHorizontal: 20, paddingBottom: 14 }}><Text style={{ color: colors.text, fontSize: 13, textDecorationLine: 'underline' }}>Enable SMS notification import</Text><Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Reads transaction alerts from your SMS app.</Text></Pressable>}
    {bankImportStatus.queuedCandidates > 0 && <Text accessibilityLiveRegion="polite" style={{ color: colors.textMuted, fontSize: 12, marginHorizontal: 20, marginBottom: 12 }}>{bankImportStatus.queuedCandidates} SMS {syncStatus.isOnline ? 'waiting to be checked' : 'saved for parsing when online'}.</Text>}
    {bankReviewEvents.length > 0 && <View style={{ paddingHorizontal: 20, marginBottom: 12 }}><Pressable accessibilityRole="button" onPress={() => setReviewsOpen(!reviewsOpen)}><Text style={{ color: colors.warning, fontSize: 13 }}>{bankReviewEvents.length} SMS alerts need review {reviewsOpen ? '−' : '+'}</Text></Pressable>{reviewsOpen && <ScrollView style={{ maxHeight: 160 }}>{bankReviewEvents.map((event) => <View key={event.importSourceKey} style={{ paddingVertical: 10 }}><Text style={{ color: colors.text }}>{event.summary}</Text><Text style={{ color: colors.textMuted, fontSize: 12 }}>{event.failureReason ?? 'No transaction was added automatically.'}</Text>{event.rawMessage && <Button label="Retry parsing" colors={colors} secondary onPress={() => { void retryBankReviewEvent(event.importSourceKey).catch(() => Alert.alert('Could not retry', 'Your SMS alert is still saved. Try again when online.')); }} />}</View>)}</ScrollView>}</View>}
    <View style={{ paddingHorizontal: 16, marginBottom: 12 }}><TextInput accessibilityLabel="Search transactions" value={query} onChangeText={setQuery} placeholder="Search transactions" placeholderTextColor={colors.textMuted} autoCorrect={false} style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} /></View>
    <FlatList data={data} keyExtractor={(item) => item._id} renderItem={renderRow} initialNumToRender={12} maxToRenderPerBatch={10} windowSize={7} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }} refreshControl={<RefreshControl refreshing={syncStatus.isSyncing} onRefresh={() => void manualRefresh()} tintColor={colors.text} />} ListEmptyComponent={<View style={{ padding: 36, alignItems: 'center' }}>{loading ? <ActivityIndicator color={colors.text} /> : <><Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>{query ? 'No matching transactions' : 'Start with one transaction'}</Text><Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>{query ? 'Try a description, category, amount or reference.' : 'Add it here, or enable SMS import. Your existing account transactions appear when you sync.'}</Text></>}</View>} />
    {editor && <Editor item={editor.item} colors={colors} onClose={() => setEditor(null)} />}
  </View>;
}
function Content() {
  const { isDark } = useTheme(), colors = isDark ? Colors.dark : Colors.light;
  const [session, setSession] = useState<Session | null>(null), [ready, setReady] = useState(false), [reauth, setReauth] = useState(false);
  useEffect(() => {
    let mounted = true, changed = false;
    initialSession.then((value) => { if (mounted && !changed) { setSession(value); setReady(true); } });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { changed = true; setSession(next); setReady(true); });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => { if (ready) void SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  return <View style={{ flex: 1, backgroundColor: colors.background }}><StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />{!ready ? <ActivityIndicator style={{ flex: 1 }} color={colors.text} /> : !session?.user || reauth ? <SignIn colors={colors} onDone={() => setReauth(false)} /> : <Transactions colors={colors} onSignIn={() => setReauth(true)} />}</View>;
}
export default function App() { return <SafeAreaProvider><ThemeProvider><UserProvider><Content /></UserProvider></ThemeProvider></SafeAreaProvider>; }
const styles = StyleSheet.create({
  title: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -1.3 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { minHeight: 84, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8, borderRadius: 14, borderWidth: 1 },
});
