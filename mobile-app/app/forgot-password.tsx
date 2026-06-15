import { AzureTheme } from '../constants/AzureTheme';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Animated, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Config from '../constants/Config';
import { normalizePhoneInput } from '../utils/authInput';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();

  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [noEmailLinked, setNoEmailLinked] = useState(false);

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

  const handleRequestCode = async () => {
    const normalizedPhone = normalizePhoneInput(whatsappNumber);
    if (!normalizedPhone) {
      setErrorMsg('Fadlan geli WhatsApp number sax ah');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const apiUrl = Config.API_URL;

      const response = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_number: normalizedPhone }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error_type === 'no_email') {
          setNoEmailLinked(true);
        }
        throw new Error(data.message || 'Something went wrong');
      }

      router.push({ pathname: '/reset-password', params: { whatsapp_number: normalizedPhone } });
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSupport = () => {
    const normalizedPhone = normalizePhoneInput(whatsappNumber) || whatsappNumber;
    const message = encodeURIComponent(`Salaan Darkpen, waxaan rabaa password reset. Number-kaygu waa: ${normalizedPhone}`);
    Linking.openURL(`https://wa.me/252659119779?text=${message}`).catch(() => {
      setErrorMsg('Ma awoodno inaan furno WhatsApp Support.');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#3B82F6" />
            </TouchableOpacity>
            <Text style={styles.title}>forgot password?</Text>
            <Text style={styles.subtitle}>
              Geli WhatsApp number-kaaga. Haddii profile-kaaga email ku jiro, koodh reset ah ayaan email-kaas kuugu diraynaa.
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>

            {/* Phone Input with Floating Label */}
            <View style={styles.inputContainer}>
              <Text style={[styles.floatingLabel, (phoneFocused || whatsappNumber.length > 0) && styles.floatingLabelActive]}>
                WhatsApp Number
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                autoCapitalize="none"
                value={whatsappNumber}
                onChangeText={(val) => {
                  setWhatsappNumber(val);
                  if (noEmailLinked) setNoEmailLinked(false);
                }}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
              />
            </View>

            {/* Error */}
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            {/* Send Button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }], width: '100%' }}>
              <TouchableOpacity
                style={[
                  styles.button, 
                  loading && styles.buttonDisabled,
                  noEmailLinked && { backgroundColor: '#10B981' }
                ]}
                onPress={noEmailLinked ? handleSupport : handleRequestCode}
                activeOpacity={0.8}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'SENDING...' : noEmailLinked ? 'La xiriir WhatsApp Bot' : 'Send Reset Code'}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Back to login */}
            <View style={styles.loginContainer}>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.loginText}>Back to Login</Text>
              </TouchableOpacity>
            </View>

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
    paddingTop: AzureTheme.spacing.xl,
    paddingBottom: AzureTheme.spacing.xl,
  },
  header: {
    marginBottom: AzureTheme.spacing.xl,
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
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#3B82F6',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral,
    lineHeight: 22,
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
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: -10,
    marginBottom: 16,
    textAlign: 'center',
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
    alignItems: 'center',
    marginTop: 4,
  },
  loginText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  supportText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '700',
  },
});
