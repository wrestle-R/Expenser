import React, {useState, useCallback} from 'react';
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
import {useToast} from '../../../context/ToastContext';
import {formatCurrency} from '../../../utils/helpers';
import {CATEGORIES, paymentMethodConfig} from '../../theme/colors';
import ConfirmModal from '../../components/ConfirmModal';
import SyncStatusBanner from '../../components/SyncStatusBanner';

export default function WorkflowsScreen({navigation}: any) {
  const {colors, isDark} = useTheme();
  const {workflows, deleteWorkflow, manualRefresh} = useUserContext();
  const {showToast} = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await manualRefresh();
    setRefreshing(false);
  }, [manualRefresh]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteWorkflow(deleteId);
      showToast('Workflow deleted', 'success');
      setDeleteId(null);
    } catch (error) {
      showToast('Failed to delete workflow', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleUseWorkflow = (wf: any) => {
    navigation.navigate('AddTransaction', {workflow: wf});
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, {color: colors.text}]}>
            Workflows
          </Text>
          <Text style={[styles.headerSubtitle, {color: colors.textMuted}]}>
            Quick transaction templates
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, {backgroundColor: colors.primary}]}
          onPress={() => navigation.navigate('AddWorkflow')}>
          <Icon name="add" size={22} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <SyncStatusBanner />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {workflows.length === 0 ? (
          <View style={[styles.emptyState, {backgroundColor: colors.card}]}>
            <Icon name="flash-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, {color: colors.text}]}>
              No workflows yet
            </Text>
            <Text style={[styles.emptySubtitle, {color: colors.textMuted}]}>
              Create templates for recurring transactions
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, {backgroundColor: colors.primary}]}
              onPress={() => navigation.navigate('AddWorkflow')}>
              <Icon name="add" size={18} color={colors.primaryForeground} />
              <Text
                style={{
                  color: colors.primaryForeground,
                  fontWeight: '600',
                  marginLeft: 6,
                }}>
                Create Workflow
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          workflows.map(wf => {
            const cat = CATEGORIES.find(c => c.id === wf.category);
            const pmConfig =
              paymentMethodConfig[wf.paymentMethod as keyof typeof paymentMethodConfig];
            const pmColor = pmConfig
              ? isDark ? pmConfig.darkColor : pmConfig.lightColor
              : colors.textMuted;
            const pmBg = pmConfig
              ? isDark ? pmConfig.darkBg : pmConfig.lightBg
              : colors.card;

            return (
              <TouchableOpacity
                key={wf._id}
                style={[
                  styles.card,
                  {backgroundColor: colors.card, borderColor: colors.border},
                ]}
                onPress={() => handleUseWorkflow(wf)}
                onLongPress={() => {
                  if (!wf.isLocal) setDeleteId(wf._id);
                }}>
                {/* Top Row */}
                <View style={styles.cardTop}>
                  <View style={{flex: 1}}>
                    <Text
                      style={[styles.cardName, {color: colors.text}]}
                      numberOfLines={1}>
                      {wf.name}
                    </Text>
                    <Text
                      style={[styles.cardDesc, {color: colors.textMuted}]}
                      numberOfLines={1}>
                      {wf.description}
                    </Text>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.useBtn, {backgroundColor: colors.primary + '15'}]}
                      onPress={() => handleUseWorkflow(wf)}>
                      <Icon name="flash" size={14} color={colors.primary} />
                      <Text style={{color: colors.primary, fontWeight: '600', fontSize: 12, marginLeft: 4}}>
                        Use
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Bottom Row - badges */}
                <View style={styles.badgeRow}>
                  {/* Type badge */}
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor:
                          wf.type === 'expense'
                            ? colors.errorBg
                            : colors.successBg,
                      },
                    ]}>
                    <Icon
                      name={wf.type === 'expense' ? 'arrow-down' : 'arrow-up'}
                      size={12}
                      color={wf.type === 'expense' ? colors.error : colors.success}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: wf.type === 'expense' ? colors.error : colors.success,
                        marginLeft: 3,
                      }}>
                      {wf.type}
                    </Text>
                  </View>

                  {/* Payment Method badge */}
                  <View style={[styles.badge, {backgroundColor: pmBg}]}>
                    <Text style={{fontSize: 11, fontWeight: '600', color: pmColor}}>
                      {pmConfig?.label || wf.paymentMethod}
                    </Text>
                  </View>

                  {/* Category badge */}
                  {cat && (
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: isDark
                            ? `${cat.color}30`
                            : `${cat.color}20`,
                        },
                      ]}>
                      <Text style={{fontSize: 11, fontWeight: '600', color: cat.color}}>
                        {cat.label}
                      </Text>
                    </View>
                  )}

                  {/* Amount */}
                  {wf.amount && (
                    <View style={[styles.badge, {backgroundColor: colors.backgroundSecondary}]}>
                      <Text style={{fontSize: 11, fontWeight: '700', color: colors.text}}>
                        ₹{formatCurrency(wf.amount)}
                      </Text>
                    </View>
                  )}

                  {/* Split badge */}
                  {wf.splitAmount && wf.splitAmount > 0 && (
                    <View style={[styles.badge, {backgroundColor: colors.infoBg}]}>
                      <Text style={{fontSize: 11, fontWeight: '600', color: colors.info}}>
                        Split: ₹{formatCurrency(wf.splitAmount)}
                      </Text>
                    </View>
                  )}

                  {/* Pending badge */}
                  {wf.isLocal && (
                    <View style={[styles.badge, {backgroundColor: colors.warningBg}]}>
                      <Icon name="time" size={10} color={colors.warning} />
                      <Text style={{fontSize: 10, fontWeight: '600', color: colors.warning, marginLeft: 3}}>
                        Pending
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{height: 30}} />
      </ScrollView>

      <ConfirmModal
        visible={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Workflow"
        message="Are you sure you want to delete this workflow?"
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
  headerSubtitle: {fontSize: 14, marginTop: 2},
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    margin: 16,
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {fontSize: 18, fontWeight: '600'},
  emptySubtitle: {fontSize: 14, textAlign: 'center'},
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  card: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardName: {fontSize: 17, fontWeight: '700'},
  cardDesc: {fontSize: 13, marginTop: 2},
  cardActions: {flexDirection: 'row', gap: 8},
  useBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  badgeRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
