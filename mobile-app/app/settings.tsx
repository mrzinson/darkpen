import { useTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthGuard } from '../components/AuthGuard';
import { AppLogo } from '../components/AppLogo';

export default function SettingsScreen() {
  const { colors, isDark, setTheme, theme, language, setLanguage, t } = useTheme();
  const styles = getStyles(colors, isDark);

  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);

  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem('userData').then(data => {
        if (data) setUserData(JSON.parse(data));
      });
    }, [])
  );

  return (
    <AuthGuard>
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color="#3B82F6" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('settings').toUpperCase()}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <TouchableOpacity 
              style={styles.profileImageContainer}
              onPress={() => router.push('/edit-profile')}
              activeOpacity={0.8}
            >
              {userData?.profile_picture ? (
                <Image 
                  source={{ uri: userData.profile_picture }} 
                  style={styles.profileImage} 
                />
              ) : (
                <View style={[styles.profileImage, { backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' }]}>
                  <AppLogo size={70} variant="white" />
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="pencil" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <Text style={styles.profileName}>{userData ? userData.name : '...'}</Text>
            <View style={styles.usernameBadge}>
              <Text style={styles.profileMeta}>{userData?.username ? `@${userData.username}` : '@user'}</Text>
            </View>
          </View>

          {/* Settings Cards */}
          
          {/* 1. Account */}
          <TouchableOpacity 
            style={styles.settingCard} 
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#3B82F6' }]}>
              <Ionicons name="person" size={22} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{t('account')}</Text>
              <Text style={styles.cardDesc}>Name, Username, Password</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.neutral} />
          </TouchableOpacity>

          {/* 2. Privacy & Security */}
          <TouchableOpacity 
            style={styles.settingCard} 
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#10B981' }]}>
              <Ionicons name="lock-closed" size={22} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{t('privacy_security')}</Text>
              <Text style={styles.cardDesc}>Password, Passkeys</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.neutral} />
          </TouchableOpacity>

          {/* 3. Notifications */}
          <TouchableOpacity 
            style={styles.settingCard} 
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#EF4444' }]}>
              <Ionicons name="notifications" size={22} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{t('notifications')}</Text>
              <Text style={styles.cardDesc}>Sounds & Alerts</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.neutral} />
          </TouchableOpacity>

          {/* 4. Appearance (Dark Mode) */}
          <View style={styles.settingCard}>
            <View style={[styles.iconBox, { backgroundColor: '#A855F7' }]}>
              <Ionicons name="moon" size={22} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{t('dark_mode')}</Text>
              <Text style={styles.cardDesc}>{t('dark_mode_sub')}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.toggleSwitch, isDark && styles.toggleSwitchActive]}
              onPress={() => setTheme(isDark ? 'light' : 'dark')}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleKnob, isDark && styles.toggleKnobActive]} />
            </TouchableOpacity>
          </View>

          {/* 5. Language */}
          <View style={styles.settingCard}>
            <View style={[styles.iconBox, { backgroundColor: '#F59E0B' }]}>
              <Ionicons name="globe" size={22} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{t('language')}</Text>
              <Text style={styles.cardDesc}>{t('language_sub')}</Text>
            </View>
            <View style={styles.langSelectorRow}>
              <TouchableOpacity 
                style={[styles.langBtn, language === 'en' && styles.langBtnActive]} 
                onPress={() => setLanguage('en')}
                activeOpacity={0.8}
              >
                <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>EN</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.langBtn, language === 'so' && styles.langBtnActive]} 
                onPress={() => setLanguage('so')}
                activeOpacity={0.8}
              >
                <Text style={[styles.langBtnText, language === 'so' && styles.langBtnTextActive]}>SO</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: {
    backgroundColor: colors.card,
    padding: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3B82F6',
    letterSpacing: 1.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 10,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.3 : 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#3B82F6',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  usernameBadge: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#DBEAFE',
  },
  profileMeta: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '700',
  },
  settingCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.1 : 0.02,
    shadowRadius: 8,
    elevation: 3,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '500',
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#3B82F6',
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    transform: [{ translateX: 20 }],
  },
  langSelectorRow: {
    flexDirection: 'row',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F3F4F6',
    borderRadius: 16,
    padding: 2,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
  },
  langBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langBtnActive: {
    backgroundColor: '#3B82F6',
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textLight,
  },
  langBtnTextActive: {
    color: '#FFFFFF',
  }
});
