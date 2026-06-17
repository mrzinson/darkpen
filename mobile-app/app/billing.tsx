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
  const [userCountry, setUserCountry] = useState<string>('Somaliland');

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
        setUserCountry(data.user.country || 'Somaliland');
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
      title: 'Pay As You Go',
      price: '$0.5',
      somaliland: userCountry === 'Somaliland' ? '5,000 SL Shilling' : '',
      description: 'Get credits to try out Darkpen AI features.',
      color: '#0A84FF',
      icon: 'flash',
      expiry: 'Expires in 10 days',
      benefits: '100 Credits',
      features: [
        'Ask general questions in the chat',
        'Credits are deducted based on your usage',
        'Perfect for testing and light use'
      ]
    },
    {
      id: 'monthly_basic',
      title: 'Monthly (Basic)',
      price: '$3',
      somaliland: userCountry === 'Somaliland' ? '30,000 SL Shilling' : '',
      description: 'Unlimited AI chat plan for everyday use.',
      color: '#32D74B',
      icon: 'calendar',
      expiry: 'Expires in 30 days',
      benefits: 'One month of unlimited chat',
      features: [
        'Unlimited conversations and assistance',
        'Uses the standard AI model (Basic)',
        'Not suitable for complex math or science problems'
      ]
    },
    {
      id: 'monthly_premium',
      title: 'Monthly (Premium)',
      price: '$11',
      somaliland: userCountry === 'Somaliland' ? '110,000 SL Shilling' : '',
      description: 'Access the most powerful and advanced AI model.',
      color: '#EAB308',
      icon: 'star',
      expiry: 'Expires in 30 days',
      benefits: 'Unlimited chat + Premium AI model',
      features: [
        'Solve complex math & science problems',
        'Send images and get exam solutions instantly',
        'Ultra-fast and 100% accurate responses'
      ]
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
        <Text style={styles.title}>CHOOSE A PLAN</Text>
        <Text style={styles.subtitle}>To continue using Darkpen AI, please select one of the plans below.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
            gap: 12,
            marginBottom: 8
          }}>
            <Ionicons name="time" size={28} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text }}>
                Payment Pending
              </Text>
              <Text style={{ fontSize: 12, color: isDark ? '#D1D5DB' : '#4B5563', marginTop: 4, lineHeight: 18 }}>
                Your payment from {paymentReference} is being verified. Credits will be added to your account shortly.
              </Text>
            </View>
          </View>
        )}

        {plans.map((plan) => (
          <TouchableOpacity 
            key={plan.id} 
            style={styles.planCard}
            onPress={() => handleSelect(plan)}
            activeOpacity={0.8}
          >
            {/* Card Header: Icon & Plan Title & Price */}
            <View style={styles.cardHeader}>
              <View style={styles.planHeaderLeft}>
                <View style={{ ...styles.iconContainer, backgroundColor: plan.color + '20' }}>
                  <Ionicons name={plan.icon as any} size={24} color={plan.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <Text style={styles.planDescText}>{plan.description}</Text>
                </View>
              </View>
              <View style={styles.planPriceSection}>
                <Text style={{ ...styles.priceText, color: plan.color }}>{plan.price}</Text>
                {plan.somaliland ? <Text style={styles.slText}>{plan.somaliland}</Text> : null}
              </View>
            </View>

            {/* Plan Specs: Benefits & Expiry */}
            <View style={styles.specsContainer}>
              <View style={styles.specRow}>
                <Ionicons name="gift-outline" size={16} color={plan.color} />
                <Text style={styles.specLabel}>You get: <Text style={styles.specValue}>{plan.benefits}</Text></Text>
              </View>
              <View style={styles.specRow}>
                <Ionicons name="time-outline" size={16} color={plan.color} />
                <Text style={styles.specLabel}>Validity: <Text style={styles.specValue}>{plan.expiry}</Text></Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Features List */}
            <View style={styles.featuresList}>
              <Text style={styles.featuresTitle}>What's included:</Text>
              {plan.features.map((feature, idx) => (
                <View key={idx} style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color={plan.color} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {/* Select Plan Button */}
            <TouchableOpacity 
              style={[styles.selectBtn, { backgroundColor: plan.color }]}
              onPress={() => handleSelect(plan)}
            >
              <Text style={styles.selectBtnText}>Select This Plan →</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            After selecting a plan, you will be shown the payment number to send money to (EVC/Zaad/Sahal).
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
    flexDirection: 'column',
    marginBottom: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 4 }
    })
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.secondary,
    marginBottom: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 12,
    gap: 12,
  },
  planHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  planPriceSection: {
    alignItems: 'flex-end',
    gap: 2,
  },
  planDescText: {
    fontSize: 13,
    color: colors.textLight || '#64748B',
    lineHeight: 18,
  },
  specsContainer: {
    backgroundColor: colors.tertiary || '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border || '#E2E8F0',
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  specLabel: {
    fontSize: 13,
    color: colors.neutral,
    fontWeight: '600',
  },
  specValue: {
    color: colors.text,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border || '#E2E8F0',
    marginVertical: 12,
  },
  featuresList: {
    gap: 8,
    marginBottom: 16,
  },
  featuresTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.secondary,
    marginBottom: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  selectBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
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
