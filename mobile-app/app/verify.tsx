import { AzureTheme } from '../constants/AzureTheme';
import { useTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function VerifyScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleVerify = async () => {
    router.push('/terms');
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
          <Text style={styles.headerTitle}>Verify</Text>
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
            Koontadaadu waa verified. Code looma baahna; sii wad si aad shuruudaha u aqbasho.
          </Text>
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            activeOpacity={0.8}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Continue</Text>
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
    backgroundColor: '#3B82F6',
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
    gap: 8,
    marginBottom: AzureTheme.spacing.xl,
  },
  codeInput: {
    width: 44,
    height: 56,
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
