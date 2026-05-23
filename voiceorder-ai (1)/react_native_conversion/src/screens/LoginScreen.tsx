import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Lock, Eye, EyeOff, AlertTriangle, Play, CheckCircle2, HelpCircle } from 'lucide-react-native';
import { COLORS, SPACING } from '../theme';
import { CONFIG } from '../config';

interface LoginScreenProps {
  onLoginSuccess: (token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMockMode = CONFIG.USE_MOCK_AUTH;

  const handleLogin = async () => {
    const trimmedUsername = username.trim().toLowerCase();

    if (!trimmedUsername || !password.trim()) {
      setError('Please fill in both username and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    // 1. LOCAL SEED METHOD (Mock simulation)
    if (isMockMode) {
      setTimeout(async () => {
        const correctPassword = CONFIG.SEED_ACCOUNTS[trimmedUsername];
        if (correctPassword && correctPassword === password) {
          const generatedToken = `mock_token_rn_${trimmedUsername}_${Date.now()}`;
          try {
            await AsyncStorage.setItem('auth_token', generatedToken);
            setIsLoading(false);
            onLoginSuccess(generatedToken);
          } catch (err) {
            setError('Failed to persist authentication session locally.');
            setIsLoading(false);
          }
        } else {
          setError(
            "Incorrect username or password. Available seed: 'admin' (pass: 'admin123'), 'sales_user' (pass: 'sales123')"
          );
          setIsLoading(false);
        }
      }, 1000);
      return;
    }

    // 2. LIVE NETWORK REQUEST WAY (Toggled via CONFIG.USE_MOCK_AUTH = false)
    try {
      // Remove trailing slash if any
      const cleanedBaseUrl = CONFIG.LOGIN_API_URL.endsWith('/')
        ? CONFIG.LOGIN_API_URL.slice(0, -1)
        : CONFIG.LOGIN_API_URL;
      
      const endpoint = `${cleanedBaseUrl}/login`;

      console.log('Sending live React Native auth request to:', endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: trimmedUsername,
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const token = data.token;
        if (token) {
          await AsyncStorage.setItem('auth_token', token);
          onLoginSuccess(token);
        } else {
          setError('Invalid API response structure: Missing auth token.');
        }
      } else {
        setError(data.error || 'Identity verification failed. Please check credentials.');
      }
    } catch (err: any) {
      console.error('Network failure in live React Native login:', err);
      setError(
        'Network unreachable: Make sure you have an active internet connection and CONFIG.LOGIN_API_URL is configured correctly.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const autoFillAdmin = () => {
    setUsername('admin');
    setPassword('admin123');
    setError(null);
  };

  const autoFillSales = () => {
    setUsername('sales_user');
    setPassword('sales123');
    setError(null);
  };

  const autoFillTest = () => {
    setUsername('test_user');
    setPassword('test123');
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          {/* Logo representation */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBadge}>
              <User size={30} color={COLORS.white} />
            </View>
            <Text style={styles.appTitle}>VoiceOrder AI</Text>
            <Text style={styles.subtitleTitle}>
              Enter credentials to access stock catalog and speak orders
            </Text>
          </View>

          {/* Config Indicator Banner depending on Mock vs Real */}
          <View
            style={[
              styles.configBanner,
              !isMockMode && {
                backgroundColor: '#EFF6FF',
                borderColor: '#BFDBFE',
              },
            ]}
          >
            {isMockMode ? (
              <CheckCircle2 size={16} color={COLORS.emeraldPrimary} />
            ) : (
              <HelpCircle size={16} color="#2563EB" />
            )}
            <View style={styles.configBannerTextWrapper}>
              <Text
                style={[
                  styles.configTitleText,
                  !isMockMode && { color: '#1E40AF' },
                ]}
              >
                {isMockMode
                  ? 'Active Mode: Local Seed Accounts'
                  : 'Active Mode: Central Network Login'}
              </Text>
              <Text
                style={[
                  styles.configSubText,
                  !isMockMode && { color: '#3182CE' },
                ]}
              >
                {isMockMode
                  ? 'Predefined prototype accounts active. Change inside config.ts when ready.'
                  : `Config URL: ${CONFIG.LOGIN_API_URL}`}
              </Text>
            </View>
          </View>

          {/* Input cards */}
          <View style={styles.cardForm}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Username</Text>
              <View style={styles.inputWrapper}>
                <User size={16} color={COLORS.zinc400} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="e.g. admin or sales_user"
                  placeholderTextColor="#A1A1AA"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Lock size={16} color={COLORS.zinc400} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#A1A1AA"
                  secureTextEntry={!isPasswordVisible}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                  style={styles.eyeBtn}
                >
                  {isPasswordVisible ? (
                    <EyeOff size={16} color={COLORS.zinc700} />
                  ) : (
                    <Eye size={16} color={COLORS.zinc700} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!username.trim() || !password.trim()) && styles.disabledBtn,
              ]}
              onPress={handleLogin}
              disabled={isLoading || !username.trim() || !password.trim()}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.submitBtnText}>Sign In</Text>
                  <Play size={12} color={COLORS.white} style={{ marginLeft: 6 }} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Error Banner Callout */}
          {error && (
            <View style={styles.errorBanner}>
              <AlertTriangle size={16} color={COLORS.red500} style={{ marginRight: 8 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Testing helper */}
          <View style={styles.testCard}>
            <Text style={styles.testHeader}>Instant Mock Test Accounts</Text>
            <Text style={styles.testSub}>
              {isMockMode
                ? 'Tap any system account below to auto-fill prototype mock credentials:'
                : 'Router is active. Tapping these will autofill, but mock must be activated in config.ts.'}
            </Text>
            <View style={styles.testBtnRow}>
              <TouchableOpacity style={styles.miniBtnActive} onPress={autoFillAdmin}>
                <Text style={styles.miniBtnTextActive}>admin</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.miniBtnSales} onPress={autoFillSales}>
                <Text style={styles.miniBtnTextSales}>sales_user</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.miniBtn} onPress={autoFillTest}>
                <Text style={styles.miniBtnText}>test_user</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  formContainer: {
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: COLORS.emeraldPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.darkZinc,
    marginBottom: 6,
  },
  subtitleTitle: {
    fontSize: 12,
    color: COLORS.zinc700,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  configBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.emeraldContainer,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    width: '100%',
    marginBottom: SPACING.lg,
  },
  configBannerTextWrapper: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  configTitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.emeraldOnContainer,
  },
  configSubText: {
    fontSize: 10,
    color: '#047857',
    marginTop: 2,
    lineHeight: 13,
  },
  cardForm: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    borderRadius: 20,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.darkZinc,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.darkZinc,
  },
  eyeBtn: {
    padding: SPACING.xs,
  },
  submitBtn: {
    backgroundColor: COLORS.emeraldPrimary,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  disabledBtn: {
    backgroundColor: COLORS.zinc200,
  },
  submitBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.red100,
    borderWidth: 1,
    borderColor: COLORS.red200,
    borderRadius: 12,
    padding: SPACING.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.red900,
    fontWeight: '500',
  },
  testCard: {
    width: '100%',
    backgroundColor: COLORS.lightZincBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    padding: SPACING.md,
  },
  testHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.darkZinc,
    marginBottom: SPACING.xs,
  },
  testSub: {
    fontSize: 10,
    color: COLORS.zinc700,
    lineHeight: 13,
    marginBottom: SPACING.sm,
  },
  testBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniBtnActive: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  miniBtnTextActive: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.emeraldOnContainer,
  },
  miniBtnSales: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  miniBtnTextSales: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  miniBtn: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: COLORS.zinc200,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.zinc700,
  },
});
