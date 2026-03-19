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
import {useSignIn, useAuth} from '@clerk/clerk-expo';
import Icon from 'react-native-vector-icons/Ionicons';
import {useTheme} from '../../../context/ThemeContext';

export default function SignInScreen({navigation}: any) {
  const {isDark, colors} = useTheme();
  const {signIn, setActive, isLoaded} = useSignIn();
  const {isSignedIn} = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      // Navigation handled by auth guard
    }
  }, [isSignedIn]);

  const handleSignIn = async () => {
    if (!isLoaded) return;

    if (!identifier || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn!.create({identifier, password});

      if (result.status === 'complete') {
        await setActive!({session: result.createdSessionId});
      } else {
        Alert.alert(
          'Sign In Incomplete',
          `Status: ${result.status}. Please check your account.`,
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Sign In Failed',
        err.errors?.[0]?.message || 'Please check your credentials.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, {backgroundColor: colors.background}]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View
            style={[styles.logoBox, {backgroundColor: colors.primary}]}>
            <Icon name="wallet" size={40} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.title, {color: colors.text}]}>Expenser</Text>
          <Text style={[styles.subtitle, {color: colors.textMuted}]}>
            Sign in to continue
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email/Username */}
          <View>
            <Text style={[styles.label, {color: colors.text}]}>
              Email or Username
            </Text>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.border,
                },
              ]}>
              <Icon name="person-outline" size={20} color={colors.textMuted} />
              <TextInput
                style={[styles.input, {color: colors.text}]}
                placeholder="Enter email or username"
                placeholderTextColor={colors.textMuted}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password */}
          <View>
            <Text style={[styles.label, {color: colors.text}]}>Password</Text>
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
                placeholder="Enter your password"
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
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.primaryButton, {backgroundColor: colors.primary}]}
            onPress={handleSignIn}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text
                style={[
                  styles.primaryButtonText,
                  {color: colors.primaryForeground},
                ]}>
                Sign In
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign Up Link */}
        <View style={styles.linkContainer}>
          <Text style={{color: colors.textMuted}}>
            Don't have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={{color: colors.primary, fontWeight: '600'}}>
              Sign Up
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
  title: {fontSize: 32, fontWeight: 'bold'},
  subtitle: {fontSize: 16, marginTop: 8},
  form: {gap: 16},
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
