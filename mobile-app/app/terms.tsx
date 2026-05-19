import { AzureTheme } from '../constants/AzureTheme';
import { useTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Config from '../constants/Config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TermsScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAcceptTerms = async () => {
    if (!phone) {
      setErrorMsg('Fadlan geli lambarkaaga WhatsApp-ka');
      return;
    }
    
    setLoading(true);
    setErrorMsg('');
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error("Fadlan dib u gal App-ka (Login)");

      const apiUrl = Config.API_URL;
      const response = await fetch(`${apiUrl}/api/auth/terms`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ whatsapp_number: phone })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Waa la keydin waayay');

      router.push('/(tabs)');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={styles.title}>terms and conditions</Text>
          <Text style={styles.subtitle}>
            Please review our updated policies to continue using the application.
          </Text>
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>WhatsApp Number</Text>
            <View style={styles.inputWrapper}>
              <Feather name="phone" size={20} color={colors.neutral} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your WhatsApp number"
                placeholderTextColor={colors.neutral}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          <View style={styles.checkboxContainer}>
            <TouchableOpacity 
              style={[styles.checkbox, accepted && styles.checkboxChecked]}
              onPress={() => setAccepted(!accepted)}
              activeOpacity={0.7}
            >
              {accepted && <Feather name="check" size={14} color="white" />}
            </TouchableOpacity>
            
            <View style={styles.termsTextContainer}>
              <Text style={styles.checkboxLabel}>i accept </Text>
              <TouchableOpacity onPress={() => router.push('/terms-content')}>
                <Text style={styles.termsLink}>terms and conditions</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.button, (!accepted || loading) && styles.buttonDisabled]}
            onPress={handleAcceptTerms}
            disabled={!accepted || loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{loading ? 'PROCESSING...' : 'open the app'}</Text>
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
  content: {
    flex: 1,
    paddingHorizontal: AzureTheme.spacing.xl,
    paddingTop: AzureTheme.spacing.xxl * 1.5,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: AzureTheme.spacing.m,
  },
  subtitle: {
    fontSize: 15,
    color: colors.neutral,
    lineHeight: 24,
    marginBottom: AzureTheme.spacing.xxl,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: -20,
    marginBottom: 20,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: AzureTheme.spacing.xl,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.neutral,
    marginBottom: AzureTheme.spacing.s,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background, // Lighter background for iOS feel
    borderRadius: AzureTheme.borderRadius.m,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 18,
    fontSize: 16,
    color: colors.text,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: AzureTheme.spacing.xl,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB', // Neutral border
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    color: colors.secondary,
  },
  termsLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
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
    backgroundColor: colors.textLight, // Grayed out
  },
  buttonText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
  }
});
