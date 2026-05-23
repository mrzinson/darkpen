import { AzureTheme } from '../constants/AzureTheme';
import { useTheme } from '../context/ThemeContext';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Image, ActivityIndicator } from 'react-native';
import { AuthGuard } from '../components/AuthGuard';
import Config from '../constants/Config';
import { AppLogo } from '../components/AppLogo';

export default function ProfileScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      // 1. Try to load from cache first
      const cached = await AsyncStorage.getItem('userData');
      if (cached) setUserData(JSON.parse(cached));
      
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${Config.API_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.user) {
        setUserData(data.user);
        await AsyncStorage.setItem('userData', JSON.stringify(data.user));
      }
    } catch (err) {
      console.log('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
    }, [])
  );

  return (
    <AuthGuard>
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading && !userData ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', height: 300 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 12, color: colors.neutral }}>Soo raryaa xogta...</Text>
          </View>
        ) : (
          <>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatar, userData?.profile_picture ? { backgroundColor: 'transparent' } : {}]}>
                {userData?.profile_picture ? (
                  <Image source={{ uri: userData.profile_picture }} style={{ width: 100, height: 100, borderRadius: 50 }} />
                ) : (
                  <AppLogo size={76} variant="white" />
                )}
              </View>
              <Text style={styles.name}>{userData ? userData.name : 'User'}</Text>
              <Text style={styles.role}>{userData?.username ? `@${userData.username}` : '@user'}</Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="logo-whatsapp" size={22} color={colors.primary} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>WhatsApp Number</Text>
                  <Text style={styles.infoValue}>{userData ? userData.whatsapp_number : '...'}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.infoRow}>
                <Ionicons name="card-outline" size={22} color={colors.primary} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Payment Status</Text>
                  <Text style={[
                    styles.infoValue,
                    userData?.payment_status === 'approved'
                      ? { color: '#10B981' }
                      : userData?.payment_status === 'pending'
                        ? { color: '#F59E0B' }
                        : { color: colors.neutral }
                  ]}>
                    {userData?.payment_status ? userData.payment_status.toUpperCase() : 'NO PAYMENT'}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => router.push('/edit-profile')}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
    </AuthGuard>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
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
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.secondary,
  },
  content: {
    padding: AzureTheme.spacing.l,
    paddingTop: AzureTheme.spacing.xl,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: AzureTheme.spacing.xxl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.secondary,
    marginBottom: 4,
  },
  role: {
    fontSize: 14,
    color: colors.neutral,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: AzureTheme.spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.background,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.secondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.background,
    marginVertical: 16,
  },
  editButton: {
    backgroundColor: colors.background,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.secondary,
  }
});
