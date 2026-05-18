import { AzureTheme } from '../constants/AzureTheme';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function VerifyScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const [code, setCode] = useState(['', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [timer, setTimer] = useState(60);
  const inputs = useRef<Array<TextInput | null>>([]);

  React.useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(prev => prev - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 4) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join('');
    if (fullCode.length < 5) {
      setErrorMsg('Fadlan geli 5-ta lambar');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error("Fadlan dib ugu noqo signup/login");

      const apiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: fullCode })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Koodhku waa khalad');

      // Success! Move to terms (WhatsApp number)
      router.push('/terms');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error("Fadlan dib ugu noqo signup/login");

      const apiUrl = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/auth/resend-code`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Waa la dirayaa koodhka...');

      setTimer(60);
      setCode(['', '', '', '', '']);
      inputs.current[0]?.focus();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleHelp = () => {
    Alert.alert('Help', 'Contact support at help@darkpen.com');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        
        {/* Header updated as per request */}
        <View style={styles.header}>
          <View /> {/* Empty view to push right item to edge */}
          <Text style={styles.headerTitle}>vrify</Text>
          <TouchableOpacity style={styles.menuButton} onPress={handleHelp}>
            <Feather name="more-horizontal" size={24} color={colors.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <View style={styles.shieldIcon}>
              <Feather name="shield" size={40} color="white" />
            </View>
          </View>

          <Text style={styles.title}>Enter Code</Text>
          <Text style={styles.subtitle}>
            We've sent a 5-digit verification code to your email address.
          </Text>
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          {/* Telegram-style code inputs */}
          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputs.current[index] = ref; }}
                style={[
                  styles.codeInput, 
                  digit ? styles.codeInputFilled : styles.codeInputEmpty
                ]}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={(text) => handleChange(text, index)}
              />
            ))}
          </View>

          {timer > 0 ? (
            <Text style={styles.resendText}>Resend code in 00:{timer < 10 ? `0${timer}` : timer}</Text>
          ) : (
            <TouchableOpacity onPress={handleResendCode} disabled={loading}>
              <Text style={styles.resendButtonText}>Resend Code</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            activeOpacity={0.8}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'VERIFYING...' : 'GO →'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: AzureTheme.spacing.xl,
    paddingTop: AzureTheme.spacing.m,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.secondary,
    marginLeft: 30, // to center it visually
  },
  menuButton: {
    backgroundColor: colors.background, // Rounded background like new ChatGPT UI
    padding: 8,
    borderRadius: 20,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: AzureTheme.spacing.xl,
    paddingTop: AzureTheme.spacing.xxl,
  },
  iconContainer: {
    marginBottom: AzureTheme.spacing.xl,
  },
  shieldIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: AzureTheme.spacing.s,
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
    marginBottom: AzureTheme.spacing.xxl,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: -20,
    marginBottom: 20,
    fontWeight: '600',
  },
  codeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: AzureTheme.spacing.xl,
  },
  codeInput: {
    width: 50,
    height: 60,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
  codeInputEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.border || '#333', // Light gray border like Telegram empty state
  },
  codeInputFilled: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary, // Blue border when filled
  },
  resendText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  resendButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  footer: {
    paddingHorizontal: AzureTheme.spacing.xl,
    paddingBottom: AzureTheme.spacing.xl,
  },
  button: {
    backgroundColor: colors.card,
    width: '100%',
    paddingVertical: 18,
    borderRadius: AzureTheme.borderRadius.pill,
    alignItems: 'center' ,
    borderWidth: 1,
    borderColor: colors.border || '#333',
  },
  buttonDisabled: {
    backgroundColor: colors.textLight,
  },
  buttonText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
  }
});
