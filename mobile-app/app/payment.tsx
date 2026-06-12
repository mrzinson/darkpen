import { AzureTheme } from '../constants/AzureTheme';
import { useTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import Config from '../constants/Config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';

export default function PaymentScreen() {
  const { colors, isDark, t } = useTheme();
  const styles = getStyles(colors, isDark);

  const router = useRouter();
  const params = useLocalSearchParams();
  const [senderNumber, setSenderNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentNumbers, setPaymentNumbers] = useState<string[]>(['637930329', '659119779']);

  React.useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await Promise.race([
          fetch(`${Config.API_URL}/api/auth/payment-config`),
          new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000))
        ]);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.numbers)) {
            setPaymentNumbers(data.numbers);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch payment config from backend:', err);
      }
    };
    fetchConfig();
  }, []);

  const planTitle = Array.isArray(params.title) ? params.title[0] : (params.title || 'Adeegga App-ka');
  const priceDisplay = Array.isArray(params.price) ? params.price[0] : (params.price || '$1.0');

  const handleCopy = async (num: string) => {
    await Clipboard.setStringAsync(num);
    Alert.alert('La koobiyeeyay', `Lambarada ${num} waa la koobiyeeyay.`);
  };

  const validatePhoneNumber = (phone: string): string | null => {
    // Remove spaces, hyphens, and plus sign
    const cleaned = phone.replace(/[\s\-+]/g, '');
    
    // Check if empty
    if (!cleaned) {
      return 'Fadlan geli nambarka aad lacagta ka soo dirtay.';
    }
    
    // Check if all characters are digits
    if (!/^\d+$/.test(cleaned)) {
      return 'Nambarku waa inuu ka koobnaadaa tiro oo kaliya (e.g. 634XXXXXX).';
    }
    
    // Check minimum length (must be at least 7 digits)
    if (cleaned.length < 7) {
      return 'Nambarka taleefanka aad soo gelisay aad ayuu u gaaban yahay (ugu yaraan waa 7 tiro).';
    }
    
    // Check maximum length
    if (cleaned.length > 15) {
      return 'Nambarka taleefanka aad soo gelisay aad ayuu u dheer yahay.';
    }
    
    // Check prefix validation if it seems to be a local Somalia/Somaliland number
    // Cleaned local number can be 7 digits (e.g. 4XXXXXX) or 9 digits (e.g. 63XXXXXXX)
    // International format: 252XXXXXXXXX (12 digits)
    if (cleaned.length === 9) {
      const prefix = cleaned.substring(0, 2);
      const validPrefixes = ['61', '62', '63', '65', '77', '90'];
      if (!validPrefixes.includes(prefix)) {
        return 'Nambarku waa inuu ku bilowdaa mid ka mid ah lambaradan: 63, 65, 61, 90, ama 77.';
      }
    } else if (cleaned.length === 12 && cleaned.startsWith('252')) {
      const prefix = cleaned.substring(3, 5);
      const validPrefixes = ['61', '62', '63', '65', '77', '90'];
      if (!validPrefixes.includes(prefix)) {
        return 'Nambarka u dambeeya ee 9-ka ah ee ku xiga 252 waa inuu ku bilowdaa 63, 65, 61, 90, ama 77.';
      }
    }
    
    return null; // Valid
  };

  const handleSubmit = async () => {
    const validationError = validatePhoneNumber(senderNumber);
    if (validationError) {
      Alert.alert('Nambar Khaldan', validationError);
      return;
    }

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

      const cleanedNumber = senderNumber.replace(/[\s\-+]/g, '');
      const res = await Promise.race([
        fetch(`${Config.API_URL}/api/auth/submit-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            reference_number: cleanedNumber,
            planId: params.planId,
            amount: params.price ? parseFloat((params.price as string).replace('$', '')) : 1.0,
            groupData: params.groupData ? JSON.parse(params.groupData as string) : null,
            service_type: params.service_type
          })
        }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), 12000)
        )
      ]);

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
    } catch (err: any) {
      if (err && err.message === 'TIMEOUT') {
        Alert.alert('Cilad', 'Cilad dhinaca server-ka ah (Muu soo jawaabin wakhtigii loogu talagalay). Fadlan mar kale isku day.');
      } else {
        Alert.alert('Cilad', 'Fadlan hubi internet-kaaga');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color={colors.secondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('payment_title')}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Plan & Pricing Card */}
          <View style={styles.planCard}>
            <View style={styles.planHeader}>
              <View style={styles.badgeContainer}>
                <Ionicons name="sparkles" size={16} color="#3B82F6" />
                <Text style={styles.planBadge}>{planTitle}</Text>
              </View>
            </View>

            {/* Price section - premium coloring */}
            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>Lacagta Laga Rabo (Price)</Text>
              <View style={styles.priceBadge}>
                <Text style={styles.priceText}>{priceDisplay}</Text>
              </View>
            </View>
          </View>

          {/* Numbers list for sending payment */}
          <View style={styles.numbersCard}>
            <Text style={styles.cardSectionTitle}>Fadlan lacagta kusoo dir mid ka mid ah lambaradan hoose kadibna halka hoose kusoo qor numberka aad ka soo dirtey.</Text>
            
            {paymentNumbers.map((num, idx) => (
              <View key={idx} style={styles.numberItem}>
                <View style={styles.numberTextContainer}>
                  <Ionicons name="phone-portrait-outline" size={18} color={colors.neutral} />
                  <Text style={styles.numberValue}>{num}</Text>
                </View>
                <TouchableOpacity style={styles.copyBtn} onPress={() => handleCopy(num)} activeOpacity={0.7}>
                  <Feather name="copy" size={16} color={colors.primary} />
                  <Text style={styles.copyBtnText}>Copy</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Input field */}
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>{t('payment_input_label')}</Text>
            <View style={styles.inputWrapper}>
              <Feather name="hash" size={20} color={colors.neutral} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('payment_input_placeholder')}
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
                keyboardType="phone-pad"
                value={senderNumber}
                onChangeText={setSenderNumber}
              />
            </View>
            <Text style={styles.noticeText}>
              {t('payment_notice')}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={StyleSheet.flatten([
              styles.button,
              (!senderNumber || loading) && styles.buttonDisabled
            ])}
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
    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#1E293B' : '#E2E8F0',
    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  planCard: {
    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: isDark ? '#334155' : '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  planBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
  },
  priceContainer: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: isDark ? '#334155' : '#F1F5F9',
    paddingTop: 16,
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral,
    marginBottom: 8,
  },
  priceBadge: {
    backgroundColor: '#10B981', // Premium green
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 30,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  priceText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  numbersCard: {
    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: isDark ? '#334155' : '#E2E8F0',
    gap: 12,
  },
  cardSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 18,
  },
  numberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: isDark ? '#334155' : '#E2E8F0',
  },
  numberTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  numberValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  inputCard: {
    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: isDark ? '#334155' : '#E2E8F0',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.secondary,
    marginBottom: 10,
    textAlign: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: isDark ? '#334155' : '#CBD5E1',
    marginBottom: 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  noticeText: {
    fontSize: 11,
    color: colors.neutral,
    textAlign: 'center',
    lineHeight: 16,
  },
  footer: {
    padding: 16,
    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: isDark ? '#334155' : '#E2E8F0',
  },
  button: {
    backgroundColor: '#3B82F6',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: isDark ? '#334155' : '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  }
});
