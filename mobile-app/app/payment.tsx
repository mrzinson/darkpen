import { AzureTheme } from '../constants/AzureTheme';
import { useTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PaymentScreen() {
  const { colors, isDark, setTheme, theme, t } = useTheme();
  const styles = getStyles(colors, isDark);

  const router = useRouter();
  const params = useLocalSearchParams();
  const [senderNumber, setSenderNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const planTitle = Array.isArray(params.title) ? params.title[0] : (params.title || 'Adeegga App-ka');
  const priceDisplay = Array.isArray(params.price) ? params.price[0] : (params.price || '$1.0');

  const handleSubmit = async () => {
    if (!senderNumber) return;

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        Alert.alert('Cilad', t('login_required'));
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userData');
        router.replace('/login');
        return;
      }

      const res = await fetch('http://localhost:5000/api/auth/submit-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reference_number: senderNumber,
          planId: params.planId,
          amount: params.price ? parseFloat((params.price as string).replace('$', '')) : 1.0,
          groupData: params.groupData ? JSON.parse(params.groupData as string) : null,
          service_type: params.service_type // Pass it here
        })
      });

      if (res.status === 401) {
        Alert.alert('Cilad', t('session_expired'));
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userData');
        router.replace('/login');
        return;
      }

      const data = await res.json();
      if (res.ok) {
        Alert.alert('Waa lagu guuleystay', data.message);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Cilad', data.message);
      }
    } catch (err) {
      Alert.alert('Cilad', 'Fadlan hubi internet-kaaga');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color={colors.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          <View style={styles.iconContainer}>
            <View style={styles.shieldIcon}>
              <Ionicons name="card" size={32} color="white" />
            </View>
          </View>

          <Text style={styles.title}>{t('payment_title')}</Text>
          <Text style={styles.subtitle}>{t('payment_subtitle')}</Text>

          <View style={styles.infoCard}>
            <Text style={styles.planName}>{planTitle}</Text>
            <Text style={styles.infoCardText}>
              {t('payment_send_msg')} <Text style={{fontWeight: 'bold'}}>{priceDisplay}</Text> )
            </Text>
            <View style={styles.numberBadge}>
              <Text style={styles.numberBadgeText}>637930329</Text>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t('payment_input_label')}</Text>
            <View style={styles.inputWrapper}>
              <Feather name="smartphone" size={20} color={colors.neutral} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('payment_input_placeholder')}
                placeholderTextColor={colors.neutral}
                keyboardType="phone-pad"
                value={senderNumber}
                onChangeText={setSenderNumber}
                autoFocus={true}
              />
            </View>
          </View>

          <Text style={styles.noticeText}>
            {t('payment_notice')}
          </Text>

        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={{ ...styles.button, ...((!senderNumber || loading) ? styles.buttonDisabled : {}) }}
            onPress={handleSubmit}
            disabled={!senderNumber || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>{t('payment_confirm_btn')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: AzureTheme.spacing.l,
    paddingTop: AzureTheme.spacing.m,
    marginBottom: AzureTheme.spacing.m,
  },
  backButton: {
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: AzureTheme.spacing.xl,
  },
  iconContainer: {
    marginBottom: AzureTheme.spacing.m,
  },
  shieldIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral,
    marginBottom: AzureTheme.spacing.xxl,
  },
  infoCard: {
    width: '100%',
    backgroundColor: colors.tertiary,
    borderRadius: AzureTheme.borderRadius.m,
    padding: AzureTheme.spacing.xl,
    alignItems: 'center',
    marginBottom: AzureTheme.spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 10,
  },
  infoCardText: {
    fontSize: 13,
    color: colors.neutral,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: AzureTheme.spacing.l,
  },
  numberBadge: {
    backgroundColor: colors.card,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: AzureTheme.borderRadius.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  numberBadgeText: {
    fontSize: 28,
    fontWeight: '800',
    
    color: colors.primary,
    letterSpacing: 2,
  },
  inputContainer: {
    width: '100%',
    marginBottom: AzureTheme.spacing.xl,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: AzureTheme.borderRadius.pill,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
  },
  inputIcon: {
    position: 'absolute',
    left: 20,
  },
  input: {
    flex: 1,
    paddingVertical: 18,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  noticeText: {
    fontSize: 11,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: AzureTheme.spacing.l,
  },
  footer: {
    paddingHorizontal: AzureTheme.spacing.xl,
    paddingBottom: AzureTheme.spacing.xl,
  },
  button: {
    backgroundColor: colors.primary,
    width: '100%',
    paddingVertical: 18,
    borderRadius: AzureTheme.borderRadius.pill,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  }
});
