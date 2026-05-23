import { AzureTheme } from '../constants/AzureTheme';
import { useTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Config from '../constants/Config';

export default function ResetPasswordScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const params = useLocalSearchParams();
  const whatsappNumber = params.whatsapp_number as string;

  const [form, setForm] = useState({ code: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleReset = async () => {
    if (!form.code || !form.newPassword) {
      setErrorMsg("Fadlan geli koodhka iyo password-ka cusub");
      return;
    }

    if (form.code.length < 6) {
      setErrorMsg("Fadlan geli 6-da lambar ee koodhka");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }
    
    setLoading(true);
    setErrorMsg('');
    
    try {
      const apiUrl = Config.API_URL;
      
      const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          whatsapp_number: whatsappNumber,
          code: form.code,
          newPassword: form.newPassword
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Cilad ayaa dhacday');
      }

      Alert.alert('Success', 'Password-kaaga si guul leh ayaa loo bedelay!');
      router.replace('/login');
      
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
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={colors.secondary} />
            </TouchableOpacity>
            <Text style={styles.title}>reset password</Text>
            <Text style={styles.subtitle}>
              Koodh 6-lambar ah ayaan u dirnay email-ka recovery-ga ee ku xiran {whatsappNumber}. Hoos geli koodhka iyo password-ka cusub.
            </Text>
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
          </View>

          <View style={styles.form}>
            <TextInput 
              style={styles.input} 
              placeholder="6-digit code" 
              placeholderTextColor={colors.neutral}
              keyboardType="number-pad"
              maxLength={6}
              value={form.code}
              onChangeText={(t) => setForm({...form, code: t})}
            />
            <TextInput 
              style={styles.input} 
              placeholder="New password" 
              placeholderTextColor={colors.neutral}
              secureTextEntry
              value={form.newPassword}
              onChangeText={(t) => setForm({...form, newPassword: t})}
            />
            <TextInput 
              style={styles.input} 
              placeholder="Confirm new password" 
              placeholderTextColor={colors.neutral}
              secureTextEntry
              value={form.confirmPassword}
              onChangeText={(t) => setForm({...form, confirmPassword: t})}
            />
          </View>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleReset}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? "PROCESSING..." : "Reset Password"}</Text>
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
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: AzureTheme.spacing.xl,
    paddingTop: AzureTheme.spacing.xl,
  },
  backBtn: {
    marginBottom: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: AzureTheme.spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral,
    lineHeight: 22,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 10,
    fontWeight: '600',
  },
  form: {
    gap: AzureTheme.spacing.m,
    marginBottom: AzureTheme.spacing.xxl,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 18,
    fontSize: 16,
    color: colors.text,
  },
  footer: {
    paddingBottom: AzureTheme.spacing.xl,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  button: {
    backgroundColor: colors.card,
    width: '100%',
    paddingVertical: 18,
    borderRadius: AzureTheme.borderRadius.pill,
    alignItems: 'center',
    marginBottom: AzureTheme.spacing.m ,
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
