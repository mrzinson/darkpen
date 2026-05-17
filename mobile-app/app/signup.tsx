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

export default function SignUpScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [focused, setFocused] = useState({ name: false, email: false, password: false, confirmPassword: false });

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
    if (!form.name || !form.email || !form.password) {
      setErrorMsg('Please fill in all fields');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const apiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

      const response = await fetch(`${apiUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      await AsyncStorage.setItem('userToken', data.token);
      await AsyncStorage.setItem('userData', JSON.stringify(data.user));

      router.push('/verify');
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

            {/* Email */}
            <View style={styles.inputContainer}>
              <Text style={[styles.floatingLabel, isActive('email') && styles.floatingLabelActive]}>
                Email
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={(t) => setForm({ ...form, email: t })}
                onFocus={() => handleFocus('email', true)}
                onBlur={() => handleFocus('email', false)}
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
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#3B82F6',
    marginBottom: 8,
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
