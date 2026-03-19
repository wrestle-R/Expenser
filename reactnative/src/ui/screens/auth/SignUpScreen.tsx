import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import {useSignUp, useAuth} from '@clerk/clerk-expo';
import Icon from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../../../context/ThemeContext';

export default function SignUpScreen({navigation}: any) {
  const {isDark, colors} = useTheme();
  const {signUp, setActive, isLoaded} = useSignUp();
  const {isSignedIn} = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (isSignedIn) {
      // Handled by auth guard
    }
  }, [isSignedIn]);

  const handleSignUp = async () => {
    if (!isLoaded) return;

    if (!username || !email || !password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const result = await signUp!.create({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        username: username.trim(),
        emailAddress: email.trim(),
      });

      if (result.status === 'complete') {
        await setActive!({session: result.createdSessionId});
      } else if (result.status === 'missing_requirements') {
        const unverifiedEmail =
          result.unverifiedFields?.includes('email_address');
        if (unverifiedEmail) {
          await signUp!.prepareEmailAddressVerification({
            strategy: 'email_code',
          });
          setPendingVerification(true);
        } else {
          Alert.alert('Error', 'Sign up incomplete. Please try again.');
        }
      }
    } catch (err: any) {
      Alert.alert(
        'Sign Up Failed',
        err.errors?.[0]?.message || 'Please try again',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return;

    setLoading(true);
    try {
      const result = await signUp!.attemptEmailAddressVerification({code});

      if (result.status === 'complete') {
        await setActive!({session: result.createdSessionId});
      } else {
        Alert.alert('Error', 'Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      Alert.alert(
        'Verification Failed',
        err.errors?.[0]?.message || 'Invalid code',
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── Verification Screen ───
  if (pendingVerification) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, {backgroundColor: colors.background}]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.logoContainer}>
            <View
              style={[
                styles.verifyIcon,
                {backgroundColor: colors.primary + '20'},
              ]}>
              <Icon name="mail" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.title, {color: colors.text, fontSize: 24}]}>
              Verify Email
            </Text>
            <Text
              style={[
                styles.subtitle,
                {color: colors.textMuted, textAlign: 'center'},
              ]}>
              We sent a verification code to {email}
            </Text>
          </View>

          <View style={styles.form}>
            <View>
              <Text style={[styles.label, {color: colors.text}]}>
                Verification Code
              </Text>
              <TextInput
                style={[
                  styles.codeInput,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="000000"
                placeholderTextColor={colors.textMuted}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, {backgroundColor: colors.primary}]}
              onPress={handleVerify}
              disabled={loading || code.length < 6}>
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text
                  style={[
                    styles.primaryButtonText,
                    {color: colors.primaryForeground},
                  ]}>
                  Verify
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{alignItems: 'center', padding: 8}}
              onPress={async () => {
                if (!isLoaded) return;
                try {
                  await signUp!.prepareEmailAddressVerification({
                    strategy: 'email_code',
                  });
                  Alert.alert('Sent', 'New code sent to ' + email);
                } catch {
                  Alert.alert('Error', 'Failed to resend code');
                }
              }}>
              <Text style={{color: colors.textMuted, fontWeight: '500'}}>
                Didn't receive a code?{' '}
                <Text style={{color: colors.primary}}>Resend</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{alignItems: 'center', marginTop: 8}}
              onPress={() => {
                setPendingVerification(false);
                setCode('');
              }}>
              <Text style={{color: colors.primary, fontWeight: '600'}}>
                Back to Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Sign Up Form ───
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, {backgroundColor: colors.background}]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={[styles.logoContainer, {marginBottom: 40}]}>
          <View
            style={[styles.logoBox, {backgroundColor: colors.primary}]}>
            <Icon name="wallet" size={40} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.title, {color: colors.text}]}>Sign Up</Text>
          <Text style={[styles.subtitle, {color: colors.textMuted}]}>
            Create your account
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Name Row */}
          <View style={styles.row}>
            <View style={{flex: 1}}>
              <Text style={[styles.label, {color: colors.text}]}>
                First Name
              </Text>
              <TextInput
                style={[
                  styles.singleInput,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="First name"
                placeholderTextColor={colors.textMuted}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>
            <View style={{flex: 1}}>
              <Text style={[styles.label, {color: colors.text}]}>
                Last Name
              </Text>
              <TextInput
                style={[
                  styles.singleInput,
                  {
                    backgroundColor: colors.backgroundSecondary,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Last name"
                placeholderTextColor={colors.textMuted}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Username */}
          <View>
            <Text style={[styles.label, {color: colors.text}]}>
              Username{' '}
              <Text style={{color: colors.textMuted}}>(required)</Text>
            </Text>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.border,
                },
              ]}>
              <Icon name="at" size={20} color={colors.textMuted} />
              <TextInput
                style={[styles.input, {color: colors.text}]}
                placeholder="Choose a username"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Email */}
          <View>
            <Text style={[styles.label, {color: colors.text}]}>
              Email <Text style={{color: colors.textMuted}}>(required)</Text>
            </Text>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.border,
                },
              ]}>
              <Icon name="mail-outline" size={20} color={colors.textMuted} />
              <TextInput
                style={[styles.input, {color: colors.text}]}
                placeholder="Enter your email"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password */}
          <View>
            <Text style={[styles.label, {color: colors.text}]}>
              Password{' '}
              <Text style={{color: colors.textMuted}}>(required)</Text>
            </Text>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.border,
                },
              ]}>
              <Icon
                name="lock-closed-outline"
                size={20}
                color={colors.textMuted}
              />
              <TextInput
                style={[styles.input, {color: colors.text}]}
                placeholder="Create a password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}>
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
            <Text style={{fontSize: 12, color: colors.textMuted, marginTop: 4}}>
              Minimum 8 characters
            </Text>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[styles.primaryButton, {backgroundColor: colors.primary}]}
            onPress={handleSignUp}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text
                style={[
                  styles.primaryButtonText,
                  {color: colors.primaryForeground},
                ]}>
                Sign Up
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign In Link */}
        <View style={styles.linkContainer}>
          <Text style={{color: colors.textMuted}}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
            <Text style={{color: colors.primary, fontWeight: '600'}}>
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {alignItems: 'center', marginBottom: 48},
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {fontSize: 32, fontWeight: 'bold'},
  subtitle: {fontSize: 16, marginTop: 8},
  form: {gap: 16},
  row: {flexDirection: 'row', gap: 12},
  label: {fontSize: 14, fontWeight: '500', marginBottom: 8},
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  singleInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  codeInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 8,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {fontSize: 16, fontWeight: '600'},
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
});
