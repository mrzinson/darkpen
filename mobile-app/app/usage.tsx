import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { AzureTheme } from '../constants/AzureTheme';
import Config from '../constants/Config';
import { CustomBlurView as BlurView } from '../components/CustomBlurView';
import { AuthGuard } from '../components/AuthGuard';

const { width } = Dimensions.get('window');

type UsageData = {
  planName: string;
  balance: number;
  limit: number;
  used: number;
  percentage: number;
  expiryDate: string | null;
};

type BreakdownItem = {
  type: string;
  label: string;
  icon: string;
  color: string;
  count: number;
  credits: number;
};

export default function UsageScreen() {
  const { colors, isDark, t } = useTheme();
  const styles = getStyles(colors, isDark);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [standardUsage, setStandardUsage] = useState<UsageData | null>(null);
  const [shukaansiUsage, setShukaansiUsage] = useState<UsageData | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);

  const fetchUsage = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/user/usage`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setStandardUsage(data.standard);
        setShukaansiUsage(data.shukaansi);
        setBreakdown(data.breakdown || []);
      }
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('so-SO', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getRemainingDays = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diffMs = new Date(dateStr).getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <AuthGuard>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={colors.secondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Isticmaalka (Usage)</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => { setLoading(true); fetchUsage(); }} activeOpacity={0.7}>
            <Ionicons name="refresh" size={20} color={colors.secondary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Soo akhrinayaa xogta isticmaalka...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* PLAN & USAGE OVERVIEW */}
            <Text style={styles.sectionTitle}>Qorshayaasha & Isticmaalka</Text>

            {/* Standard Wallet Card */}
            {standardUsage && (
              <View style={styles.usageCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.iconBox, { backgroundColor: colors.primary + '20' }]}>
                      <Ionicons name="sparkles" size={20} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.planLabel}>AI Chat & Imtixaanada</Text>
                      <Text style={styles.planName}>{standardUsage.planName}</Text>
                    </View>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{100 - standardUsage.percentage}% Hadhaaga</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${100 - standardUsage.percentage}%`, backgroundColor: colors.primary }]} />
                  </View>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressText}>{standardUsage.balance} Credits oo u hadhay</Text>
                    <Text style={styles.progressText}>Xadka: {standardUsage.limit}</Text>
                  </View>
                </View>

                {/* Expiration warning */}
                {standardUsage.expiryDate && (
                  <View style={styles.expiryRow}>
                    <Ionicons name="time-outline" size={16} color={getRemainingDays(standardUsage.expiryDate)! <= 2 ? '#EF4444' : colors.neutral} />
                    <Text style={[styles.expiryText, getRemainingDays(standardUsage.expiryDate)! <= 2 ? { color: '#EF4444', fontWeight: 'bold' } : {}]}>
                      {getRemainingDays(standardUsage.expiryDate)! <= 2 
                        ? `Wuxuu dhacayaa ${getRemainingDays(standardUsage.expiryDate)} casho gudahood!` 
                        : `Wuxuu dhacayaa taariikhda: ${formatDate(standardUsage.expiryDate)}`}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Shukaansi Wallet Card */}
            {shukaansiUsage && (
              <View style={styles.usageCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.iconBox, { backgroundColor: '#EC489920' }]}>
                      <Ionicons name="heart" size={20} color="#EC4899" />
                    </View>
                    <View>
                      <Text style={styles.planLabel}>Chat-ka Shukaansiga</Text>
                      <Text style={[styles.planName, { color: '#EC4899' }]}>{shukaansiUsage.planName}</Text>
                    </View>
                  </View>
                  <View style={[styles.badge, { backgroundColor: '#EC489920' }]}>
                    <Text style={[styles.badgeText, { color: '#EC4899' }]}>{100 - shukaansiUsage.percentage}% Hadhaaga</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${100 - shukaansiUsage.percentage}%`, backgroundColor: '#EC4899' }]} />
                  </View>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressText}>{shukaansiUsage.balance} Credits oo u hadhay</Text>
                    <Text style={styles.progressText}>Xadka: {shukaansiUsage.limit}</Text>
                  </View>
                </View>

                {/* Expiration warning - shukaansi wallet does not expire unless subscription */}
                {shukaansiUsage.expiryDate ? (
                  <View style={styles.expiryRow}>
                    <Ionicons name="time-outline" size={16} color={colors.neutral} />
                    <Text style={styles.expiryText}>
                      Bille wuxuu dhacayaa: {formatDate(shukaansiUsage.expiryDate)}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.expiryRow}>
                    <Ionicons name="infinite-outline" size={16} color="#10B981" />
                    <Text style={[styles.expiryText, { color: '#10B981' }]}>
                      Credit-kan ma dhacayo ilaa aad dhameysato (No expiry).
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* BREAKDOWN OF COSTS */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Xisaabta Kharashka ku Baxay</Text>
            
            {breakdown.length === 0 ? (
              <View style={styles.emptyBreakdown}>
                <Ionicons name="pie-chart-outline" size={40} color={colors.neutral} style={{ opacity: 0.4, marginBottom: 8 }} />
                <Text style={styles.emptyText}>Wali wax kharash ah laguma dhex qorin koontadaada.</Text>
              </View>
            ) : (
              <View style={styles.breakdownCard}>
                {breakdown.map((item, idx) => (
                  <View key={item.type}>
                    <View style={styles.breakdownRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <View style={[styles.smallIconBox, { backgroundColor: item.color + '15' }]}>
                          <Ionicons name={item.icon as any} size={18} color={item.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.breakdownLabel}>{item.label}</Text>
                          <Text style={styles.breakdownCount}>{item.count} jeer oo la isticmaalay</Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.breakdownCredits, { color: item.color }]}>-{item.credits} Credits</Text>
                        <Text style={styles.breakdownPercent}>
                          {standardUsage ? `${Math.round((item.credits / standardUsage.limit) * 100)}% qorshaha` : ''}
                        </Text>
                      </View>
                    </View>
                    {idx < breakdown.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            )}

            {/* RECHARGE / UPGRADE ACTION BUTTON */}
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/billing')}
              activeOpacity={0.8}
            >
              <Ionicons name="card-outline" size={20} color="white" />
              <Text style={styles.actionButtonText}>Ku Shubo Credits / Cusboonaysii Bille</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </AuthGuard>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AzureTheme.spacing.l,
    paddingVertical: AzureTheme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || 'rgba(0,0,0,0.05)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.secondary,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: colors.neutral,
    fontSize: 14,
  },
  scrollContent: {
    padding: AzureTheme.spacing.l,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textLight,
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  usageCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 3 }
    })
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planLabel: {
    fontSize: 11,
    color: colors.neutral,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  planName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  badge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 12,
    color: colors.neutral,
    fontWeight: '500',
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
    paddingTop: 12,
  },
  expiryText: {
    fontSize: 12,
    color: colors.neutral,
  },
  emptyBreakdown: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
  },
  emptyText: {
    fontSize: 13,
    color: colors.neutral,
    textAlign: 'center',
  },
  breakdownCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 3 }
    })
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  smallIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.secondary,
  },
  breakdownCount: {
    fontSize: 11,
    color: colors.neutral,
    marginTop: 2,
  },
  breakdownCredits: {
    fontSize: 14,
    fontWeight: '800',
  },
  breakdownPercent: {
    fontSize: 11,
    color: colors.neutral,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  },
  actionButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  }
});
