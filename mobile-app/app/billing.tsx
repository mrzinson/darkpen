import { AzureTheme } from '../constants/AzureTheme';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../constants/Config';

export default function BillingScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const { chatType } = useLocalSearchParams();

  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.user) {
        setPaymentStatus(data.user.payment_status || null);
        setPaymentReference(data.user.payment_reference || null);
      }
    } catch (error) {
      console.error('Error fetching profile in billing:', error);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const plans = [
    {
      id: 'pay_as_you_go',
      title: 'Pay as you go',
      price: '$0.5',
      somaliland: '5,000 SL Shilling',
      description: 'Ku hel 100 Credits ',
      color: '#0A84FF',
      icon: 'flash'
    },
    {
      id: 'monthly_basic',
      title: 'Bille (Basic)',
      price: '$3',
      somaliland: '30,000 SL Shilling',
      description: 'Isticmaal chat-ka hal bil adiga oo aan xadidnayn.',
      color: '#32D74B',
      icon: 'calendar'
    },
    {
      id: 'monthly_premium',
      title: 'Bille (Premium)',
      price: '$11',
      somaliland: '110,000 SL Shilling',
      description: 'Hel dhamaan adeegyada App-ka (Exams, Books, AI Voice).',
      color: '#3882f6',
      icon: 'star'
    }
  ];

  const handleSelect = (plan: any) => {
    // Navigate to payment details screen with selected plan info
    router.push({
      pathname: '/payment',
      params: { 
        planId: plan.id, 
        price: plan.price,
        title: plan.title,
        service_type: chatType || 'general'
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.title}>PAY BILLE</Text>
        <Text style={styles.subtitle}>Si aad u sii wadato isticmaalka Darkpen AI, fadlan dooro mid ka mid ah BIILLESHAN.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Pending Payment Notice Card */}
        {paymentStatus === 'pending' && (
          <View style={{
            backgroundColor: isDark ? '#1F2937' : '#FEF3C7',
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#FCD34D',
            borderRadius: 16,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12
          }}>
            <Ionicons name="time" size={28} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text }}>
                Dalabkaaga wuu qabsoomay (Pending)
              </Text>
              <Text style={{ fontSize: 12, color: isDark ? '#D1D5DB' : '#4B5563', marginTop: 4, lineHeight: 18 }}>
                Fadlan sug, lacagtii aad ka dirtay {paymentReference} waa la hubinayaa hadda si credit loogu shubo koontadaada.
              </Text>
            </View>
          </View>
        )}
        {plans.map((plan) => (
          <TouchableOpacity 
            key={plan.id} 
            style={{ ...styles.planCard, borderLeftColor: plan.color }}
            onPress={() => handleSelect(plan)}
            activeOpacity={0.7}
          >
            <View style={styles.planInfo}>
              <View style={{ ...styles.iconContainer, backgroundColor: plan.color + '20' }}>
                <Ionicons name={plan.icon as any} size={24} color={plan.color} />
              </View>
              <View style={styles.planText}>
                <Text style={styles.planTitle}>{plan.title}</Text>
                <Text style={styles.planDesc}>{plan.description}</Text>
              </View>
            </View>
            <View style={styles.planPrice}>
              <Text style={{ ...styles.priceText, color: plan.color }}>{plan.price}</Text>
              <Text style={styles.slText}>{plan.somaliland}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral} />
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Markaad doorato qorshaha, waxaa lagu tusi doonaa numberka aad lacagta ku soo dirayso (EVC/Zaad/Sahal).
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: AzureTheme.spacing.xl,
    paddingTop: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: colors.neutral,
    lineHeight: 22,
  },
  scrollContent: {
    padding: AzureTheme.spacing.xl,
    gap: 16,
  },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 6,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 4 }
    })
  },
  planInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 15,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planText: {
    flex: 1,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.secondary,
    marginBottom: 4,
  },
  planDesc: {
    fontSize: 13,
    color: colors.neutral,
  },
  planPrice: {
    alignItems: 'flex-end',
    gap: 2,
  },
  priceText: {
    fontSize: 20,
    fontWeight: '800',
  },
  slText: {
    fontSize: 11,
    color: colors.neutral,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.primary + '10',
    padding: 16,
    borderRadius: 12,
    gap: 10,
    marginTop: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.primary,
    lineHeight: 18,
  }
});
