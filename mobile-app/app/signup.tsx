import { AzureTheme } from '../constants/AzureTheme';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../constants/Config';
import { normalizePhoneInput, normalizeUsernameInput, usernameError } from '../utils/authInput';
import { AppLogo } from '../components/AppLogo';

export default function SignUpScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();

  const [form, setForm] = useState({ name: '', username: '', whatsappNumber: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [focused, setFocused] = useState({ name: false, username: false, whatsappNumber: false, password: false, confirmPassword: false });

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

  const handleFocus = (field: keyof typeof focused, value: boolean) => {
    setFocused(prev => ({ ...prev, [field]: value }));
  };

  const isActive = (field: keyof typeof form) => focused[field] || form[field].length > 0;

  const handleSignup = async () => {
    const normalizedPhone = normalizePhoneInput(form.whatsappNumber);
    const cleanUsername = normalizeUsernameInput(form.username);
    const usernameValidation = usernameError(cleanUsername);

    if (!form.name.trim() || !cleanUsername || !form.whatsappNumber.trim() || !form.password) {
      setErrorMsg('Fadlan buuxi magaca, username-ka, number-ka iyo password-ka');
      return;
    }
    if (usernameValidation) {
      setErrorMsg(usernameValidation);
      return;
    }
    if (!normalizedPhone) {
      setErrorMsg('Fadlan geli number sax ah, tusaale +25261XXXXXXX');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setErrorMsg('Password-ku waa inuu ahaadaa ugu yaraan 8 xaraf');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const apiUrl = Config.API_URL;

      const response = await fetch(`${apiUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          username: cleanUsername,
          whatsapp_number: normalizedPhone,
          password: form.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      await AsyncStorage.setItem('userToken', data.token);
      await AsyncStorage.setItem('userData', JSON.stringify(data.user));

      router.push('/terms');
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



          {/* Card */}
          <View style={styles.card}>
            <View style={styles.header}>
              <AppLogo size={68} variant="blue" style={styles.logo} />
              <Text style={styles.title}>signup</Text>

            </View>

            {/* Name */}
            <View style={styles.inputContainer}>
              <Text style={[styles.floatingLabel, isActive('name') && styles.floatingLabelActive]}>
                Full Name
              </Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
                onFocus={() => handleFocus('name', true)}
                onBlur={() => handleFocus('name', false)}
              />
            </View>

            {/* Username */}
            <View style={styles.inputContainer}>
              <Text style={[styles.floatingLabel, isActive('username') && styles.floatingLabelActive]}>
                Username
              </Text>
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                value={form.username}
                onChangeText={(t) => setForm({ ...form, username: normalizeUsernameInput(t) })}
                onFocus={() => handleFocus('username', true)}
                onBlur={() => handleFocus('username', false)}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.floatingLabel, isActive('whatsappNumber') && styles.floatingLabelActive]}>
                WhatsApp Number
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                autoCapitalize="none"
                value={form.whatsappNumber}
                onChangeText={(t) => setForm({ ...form, whatsappNumber: t })}
                onFocus={() => handleFocus('whatsappNumber', true)}
                onBlur={() => handleFocus('whatsappNumber', false)}
              />
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
              <Text style={[styles.floatingLabel, isActive('password') && styles.floatingLabelActive]}>
                Password
              </Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                value={form.password}
                onChangeText={(t) => setForm({ ...form, password: t })}
                onFocus={() => handleFocus('password', true)}
                onBlur={() => handleFocus('password', false)}
              />
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Text style={[styles.floatingLabel, isActive('confirmPassword') && styles.floatingLabelActive]}>
                Confirm Password
              </Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                value={form.confirmPassword}
                onChangeText={(t) => setForm({ ...form, confirmPassword: t })}
                onFocus={() => handleFocus('confirmPassword', true)}
                onBlur={() => handleFocus('confirmPassword', false)}
              />
            </View>

            {/* Error */}
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            {/* Signup Button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }], width: '100%' }}>
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSignup}
                activeOpacity={0.8}
                disabled={loading}
              >
                <Text style={styles.buttonText}>{loading ? 'PROCESSING...' : 'Create Account'}</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Login link */}
            <View style={styles.loginContainer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.loginText}>Log in here</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.divider} />
            </View>

            {/* Google Button */}
            <TouchableOpacity style={styles.googleButton} activeOpacity={0.7}>
              <Ionicons name="logo-google" size={20} color="#ffffff" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

          </View>
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
    marginTop: -10,
    marginBottom: 16,
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
    backgroundColor: 'transparent',
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
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 12,
    fontSize: 16,
    color: '#111827',
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
    borderColor: '#3B82F6',
    backgroundColor: '#3B82F6',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 10,
  },
});
