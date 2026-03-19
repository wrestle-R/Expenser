import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../../../context/ThemeContext';
import {useUserContext} from '../../../context/UserContext';
import {useToast} from '../../../context/ToastContext';
import {paymentMethodConfig} from '../../theme/colors';
import ConfirmModal from '../../components/ConfirmModal';
import {PaymentMethod} from '../../../domain/types';

const ALL_PAYMENT_METHODS: {id: PaymentMethod; label: string; icon: string}[] = [
  {id: 'bank', label: 'Bank (UPI)', icon: 'card'},
  {id: 'cash', label: 'Cash', icon: 'cash'},
  {id: 'splitwise', label: 'Splitwise', icon: 'swap-horizontal'},
];

export default function ProfileScreen() {
  const {colors, isDark, toggleTheme} = useTheme();
  const {profile, updateProfile, isOnline, pendingCount, signOut} =
    useUserContext();
  const {showToast} = useToast();

  const [name, setName] = useState(profile?.name || '');
  const [occupation, setOccupation] = useState(profile?.occupation || '');
  const [selectedMethods, setSelectedMethods] = useState<string[]>(
    profile?.paymentMethods || ['bank'],
  );
  const [saving, setSaving] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Update local state when profile changes
  React.useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setOccupation(profile.occupation || '');
      setSelectedMethods(profile.paymentMethods || ['bank']);
    }
  }, [profile]);

  const toggleMethod = (methodId: string) => {
    setSelectedMethods(prev => {
      if (prev.includes(methodId)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(m => m !== methodId);
      }
      return [...prev, methodId];
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Please enter your name', 'error');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        occupation: occupation.trim(),
        paymentMethods: selectedMethods,
      });
      showToast('Profile updated', 'success');
    } catch (error) {
      showToast('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      showToast('Failed to sign out', 'error');
    } finally {
      setSigningOut(false);
      setShowSignOut(false);
    }
  };

  const initials =
    profile?.name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, {color: colors.text}]}>
            Profile
          </Text>
        </View>

        {/* Avatar + Status */}
        <View style={styles.avatarSection}>
          <View
            style={[styles.avatar, {backgroundColor: colors.primary}]}>
            <Text
              style={[styles.avatarText, {color: colors.primaryForeground}]}>
              {initials}
            </Text>
          </View>
          <Text style={[styles.profileName, {color: colors.text}]}>
            {profile?.name || 'User'}
          </Text>
          <Text style={[styles.profileEmail, {color: colors.textMuted}]}>
            {profile?.email || ''}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {backgroundColor: isOnline ? colors.success : colors.warning},
              ]}
            />
            <Text style={{color: colors.textMuted, fontSize: 13}}>
              {isOnline ? 'Online' : 'Offline'}
              {pendingCount > 0 && ` · ${pendingCount} pending`}
            </Text>
          </View>
        </View>

        {/* Personal Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>
            Personal Information
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, {color: colors.textMuted}]}>
              Name
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
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, {color: colors.textMuted}]}>
              Occupation
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
              value={occupation}
              onChangeText={setOccupation}
              placeholder="Your occupation"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>
            Payment Methods
          </Text>
          <Text style={[styles.sectionSubtitle, {color: colors.textMuted}]}>
            Select which payment methods you use
          </Text>

          <View style={{gap: 8, marginTop: 12}}>
            {ALL_PAYMENT_METHODS.map(method => {
              const config = paymentMethodConfig[method.id];
              const isSelected = selectedMethods.includes(method.id);
              const methodColor = isDark ? config.darkColor : config.lightColor;
              const methodBg = isDark ? config.darkBg : config.lightBg;

              return (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.methodCard,
                    {
                      backgroundColor: isSelected ? methodBg : colors.card,
                      borderColor: isSelected ? methodColor : colors.border,
                    },
                  ]}
                  onPress={() => toggleMethod(method.id)}>
                  <Icon
                    name={method.icon}
                    size={24}
                    color={isSelected ? methodColor : colors.textMuted}
                  />
                  <Text
                    style={{
                      flex: 1,
                      marginLeft: 12,
                      fontSize: 16,
                      fontWeight: '500',
                      color: isSelected ? methodColor : colors.text,
                    }}>
                    {method.label}
                  </Text>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: isSelected ? methodColor : 'transparent',
                        borderColor: isSelected ? methodColor : colors.border,
                      },
                    ]}>
                    {isSelected && (
                      <Icon name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Theme Toggle */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, {color: colors.text}]}>
            Appearance
          </Text>
          <View
            style={[
              styles.themeToggle,
              {backgroundColor: colors.card, borderColor: colors.border},
            ]}>
            <Icon
              name={isDark ? 'moon' : 'sunny'}
              size={22}
              color={colors.primary}
            />
            <Text
              style={{flex: 1, marginLeft: 12, fontSize: 16, color: colors.text}}>
              Dark Mode
            </Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{false: colors.border, true: colors.primary + '60'}}
              thumbColor={isDark ? colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.saveButton, {backgroundColor: colors.primary}]}
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
                Save Changes
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <View style={[styles.section, {paddingBottom: 40}]}>
          <TouchableOpacity
            style={[
              styles.signOutButton,
              {borderColor: colors.error},
            ]}
            onPress={() => setShowSignOut(true)}>
            <Icon name="log-out-outline" size={20} color={colors.error} />
            <Text
              style={{
                color: colors.error,
                fontSize: 16,
                fontWeight: '600',
                marginLeft: 8,
              }}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={showSignOut}
        onClose={() => setShowSignOut(false)}
        onConfirm={handleSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out? Your local data will be cleared."
        confirmText="Sign Out"
        confirmColor="destructive"
        icon="log-out-outline"
        loading={signingOut}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {fontSize: 28, fontWeight: 'bold'},
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {fontSize: 28, fontWeight: 'bold'},
  profileName: {fontSize: 22, fontWeight: '700'},
  profileEmail: {fontSize: 14, marginTop: 4},
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  statusDot: {width: 8, height: 8, borderRadius: 4},
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {fontSize: 18, fontWeight: '700', marginBottom: 4},
  sectionSubtitle: {fontSize: 13},
  fieldGroup: {marginTop: 12},
  fieldLabel: {fontSize: 14, fontWeight: '600', marginBottom: 8},
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  saveButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});
