import { AzureTheme } from '../constants/AzureTheme';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
  Modal, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../constants/Config';
import { normalizePhoneInput, combinePhoneAndCode } from '../utils/authInput';
import { AppLogo } from '../components/AppLogo';

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();

  const [form, setForm] = useState({ whatsappNumber: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('Fadlan geli WhatsApp number-ka iyo password-ka');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Country Code Dropdown States
  const [countryCode, setCountryCode] = useState('+252');
  const [countryFlag, setCountryFlag] = useState('🇸🇴');
  const [modalVisible, setModalVisible] = useState(false);

  const COUNTRIES = [
    { code: '+252', name: 'Somalia', flag: '🇸🇴' },
    { code: '+254', name: 'Kenya', flag: '🇰🇪' },
    { code: '+251', name: 'Ethiopia', flag: '🇪🇹' },
    { code: '+253', name: 'Djibouti', flag: '🇩🇯' },
    { code: '+256', name: 'Uganda', flag: '🇺🇬' },
    { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
    { code: '+1', name: 'United States/Canada', flag: '🇺🇸' },
    { code: '+90', name: 'Turkey', flag: '🇹🇷' },
    { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '+971', name: 'United Arab Emirates', flag: '🇦🇪' },
    { code: '+46', name: 'Sweden', flag: '🇸🇪' },
    { code: '+47', name: 'Norway', flag: '🇳🇴' },
    { code: '+358', name: 'Finland', flag: '🇫🇮' }
  ];

  const buttonScale = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (loading) {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(buttonScale, { toValue: 1.05, duration: 300, useNativeDriver: true }),
          Animated.timing(buttonScale, { toValue: 1, duration: 300, useNativeDriver: true }),
        ])
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      buttonScale.setValue(1);
    }
  }, [loading]);

  const handleFocus = (field: 'phone' | 'password', focused: boolean) => {
    if (field === 'phone') setPhoneFocused(focused);
    else setPasswordFocused(focused);
  };

  const handleLogin = async () => {
    setErrorMsg('');
    const fullNumber = combinePhoneAndCode(countryCode, form.whatsappNumber);
    const normalizedPhone = normalizePhoneInput(fullNumber);
    if (!normalizedPhone || !form.password) {
      setErrorMsg('Fadlan geli number sax ah iyo password-ka');
      return;
    }

    setLoading(true);



    try {
      const apiUrl = Config.API_URL;
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_number: normalizedPhone, password: form.password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      await AsyncStorage.setItem('userToken', data.token);
      await AsyncStorage.setItem('userData', JSON.stringify(data.user));

      if (data.requires_verification) {
        router.push('/verify');
      } else if (!data.user?.terms_accepted_at) {
        router.push('/terms');
      } else if (!data.user?.country || !data.user?.gender) {
        router.push('/onboarding');
      } else {
        router.push('/(tabs)');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#3B82F6" />
          </TouchableOpacity>


          {/* Card */}
          <View style={styles.card}>
            <View style={styles.header}>
              <AppLogo size={68} variant="blue" style={styles.logo} />
              <Text style={styles.title}>login</Text>




            </View>

            <View style={styles.phoneFieldContainer}>
              <Text style={styles.phoneLabel}>WhatsApp Number</Text>
              <View style={styles.phoneInputWrapper}>
                <TouchableOpacity 
                  style={styles.countryCodeSelector} 
                  onPress={() => setModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.countryCodeText}>{countryFlag} {countryCode}</Text>
                  <Ionicons name="chevron-down" size={12} color="#64748B" style={{ marginLeft: 2 }} />
                </TouchableOpacity>
                <TextInput
                  style={styles.phoneInput}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  value={form.whatsappNumber}
                  onChangeText={(t) => setForm({ ...form, whatsappNumber: t })}
                  onFocus={() => handleFocus('phone', true)}
                  onBlur={() => handleFocus('phone', false)}
                  placeholder="61XXXXXXX"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.floatingLabel, (passwordFocused || form.password.length > 0) && styles.floatingLabelActive]}>
                Password
              </Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  secureTextEntry={!showPassword}
                  value={form.password}
                  onChangeText={(t) => setForm({ ...form, password: t })}
                  onFocus={() => handleFocus('password', true)}
                  onBlur={() => handleFocus('password', false)}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(v => !v)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={() => router.push('/forgot-password')}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            {/* Login Button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }], width: '100%' }}>
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                activeOpacity={0.8}
                disabled={loading}
              >
                <Text style={styles.buttonText}>{loading ? 'PROCESSING...' : 'Log in'}</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Sign up link */}
            <View style={styles.loginContainer}>
              <Text style={styles.footerText}>Do not have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text style={styles.loginText}>Sign up here</Text>
              </TouchableOpacity>
            </View>

          </View>

          {/* Country Code Modal */}
          <Modal visible={modalVisible} transparent animationType="slide">
            <TouchableOpacity 
              style={styles.modalOverlay} 
              activeOpacity={1} 
              onPress={() => setModalVisible(false)}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Dooro Waddanka</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#1E293B" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={COUNTRIES}
                  keyExtractor={(item) => item.code}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={styles.countryItem} 
                      onPress={() => {
                        setCountryCode(item.code);
                        setCountryFlag(item.flag);
                        setModalVisible(false);
                      }}
                    >
                      <Text style={styles.countryItemText}>{item.flag} {item.name} ({item.code})</Text>
                      {countryCode === item.code && (
                        <Ionicons name="checkmark" size={20} color="#3B82F6" />
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: AzureTheme.spacing.xl,
    paddingTop: AzureTheme.spacing.xxl,
    paddingBottom: AzureTheme.spacing.xl,
  },
  header: {
    marginBottom: AzureTheme.spacing.xl,
    alignItems: 'center',
  },
  logo: {
    marginBottom: 10,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#3B82F6',
    marginBottom: 8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral,
    lineHeight: 22,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: -20,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3B82F6',
    padding: 24,
    shadowColor: '#3B82F6',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  floatingLabel: {
    position: 'absolute',
    left: 14,
    top: 16,
    fontSize: 16,
    color: '#9CA3AF',
    zIndex: 1,
  },
  floatingLabelActive: {
    top: -10,
    fontSize: 12,
    color: '#3B82F6',
    backgroundColor: '#ffffff',
    paddingHorizontal: 4,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#d4dce9ff',
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 12,
    fontSize: 16,
    color: '#111827',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#d4dce9ff',
    overflow: 'hidden',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 12,
    fontSize: 16,
    color: '#111827',
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#3B82F6',
    width: '100%',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: AzureTheme.spacing.m,
  },
  buttonDisabled: {
    backgroundColor: '#93C5FD',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loginContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  footerText: {
    fontSize: 13,
    color: colors.textLight,
  },
  loginText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: AzureTheme.spacing.m,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#3B82F6',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.secondary,
    marginLeft: 10,
  },
  backBtn: {
    marginBottom: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  phoneFieldContainer: {
    marginBottom: 20,
  },
  phoneLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 6,
    marginLeft: 2,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d4dce9ff',
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  countryCodeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRightWidth: 1.5,
    borderRightColor: '#d4dce9ff',
    height: 56,
    gap: 4,
    backgroundColor: '#F1F5F9',
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  phoneInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#111827',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 20,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  countryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  countryItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
});
