import { useTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, Platform, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthGuard } from '../components/AuthGuard';
import { AppLogo } from '../components/AppLogo';
import Config from '../constants/Config';

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

  const handleDeleteAccount = () => {
    Alert.alert(
      language === 'so' ? "Tirtirida Akoonka" : "Delete Account",
      language === 'so' 
        ? "Ma hubtaa inaad tirtirto akoonkaaga? Tani waxay tirtiri doontaa dhammaan xogtaada, fariimahaaga, iyo lacag bixintaadii oo dhan. Go'aankan lagama noqon karo." 
        : "Are you sure you want to delete your account? This will permanently delete all your data, messages, and payments. This action cannot be undone.",
      [
        { text: language === 'so' ? "Jooji" : "Cancel", style: "cancel" },
        { 
          text: language === 'so' ? "Haa, Tirtir" : "Yes, Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              const res = await fetch(`${Config.API_URL}/api/user/account`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (res.ok) {
                await AsyncStorage.removeItem('userToken');
                await AsyncStorage.removeItem('userData');
                router.replace('/login');
              } else {
                const data = await res.json();
                Alert.alert("Error", data.message || "Failed to delete account");
              }
            } catch (err) {
              Alert.alert("Error", "Network error occurred.");
            }
          }
        }
      ]
    );
  };

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
                  source={{ uri: Config.getMediaUrl(userData.profile_picture) || undefined }} 
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

          {/* 6. Terms & Conditions */}
          <TouchableOpacity 
            style={styles.settingCard} 
            onPress={() => router.push('/terms-content')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#3B82F6' }]}>
              <Ionicons name="document-text" size={22} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{t('terms')}</Text>
              <Text style={styles.cardDesc}>Rules and Guidelines</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.neutral} />
          </TouchableOpacity>

          {/* 7. Privacy Policy */}
          <TouchableOpacity 
            style={styles.settingCard} 
            onPress={() => Linking.openURL('https://darkpen-privacy-policy.onrender.com/')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#10B981' }]}>
              <Ionicons name="shield-checkmark" size={22} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{t('privacy_policy')}</Text>
              <Text style={styles.cardDesc}>External Link</Text>
            </View>
            <Feather name="external-link" size={20} color={colors.neutral} />
          </TouchableOpacity>

          {/* 8. Social Media */}
          <View style={styles.settingCard}>
            <View style={[styles.iconBox, { backgroundColor: '#6366F1' }]}>
              <Ionicons name="share-social" size={22} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{language === 'so' ? 'Baraha Bulshada' : 'Social Media'}</Text>
              <View style={styles.socialRow}>
                <TouchableOpacity 
                  onPress={() => Linking.openURL('https://www.facebook.com/share/1YXK1Nffvh/')} 
                  style={[styles.socialMiniIcon, { backgroundColor: '#E7F3FF' }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => Linking.openURL('https://www.instagram.com/darkpenapp?igsh=Znh5MnUwb2p5cmdj')} 
                  style={[styles.socialMiniIcon, { backgroundColor: '#FDF2F8' }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="logo-instagram" size={18} color="#E1306C" />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => Linking.openURL('https://www.tiktok.com/@darkpenapp?_r=1&_t=ZS-96s28GW9i6s')} 
                  style={[styles.socialMiniIcon, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="logo-tiktok" size={18} color={isDark ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => Linking.openURL('https://t.me/darkpenapp')} 
                  style={[styles.socialMiniIcon, { backgroundColor: '#E0F2FE' }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="paper-plane" size={18} color="#229ED9" />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => Linking.openURL('https://x.com/Darkpenapp')} 
                  style={[styles.socialMiniIcon, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="logo-twitter" size={18} color={isDark ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => Linking.openURL('https://wa.me/252659119779')} 
                  style={[styles.socialMiniIcon, { backgroundColor: '#DCFCE7' }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 8. Delete Account */}
          <TouchableOpacity 
            style={[styles.settingCard, { borderColor: '#EF4444' }]} 
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#EF4444' }]}>
              <Ionicons name="trash" size={22} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: '#EF4444' }]}>
                {language === 'so' ? 'Tirtir Akoonkayga' : 'Delete My Account'}
              </Text>
              <Text style={styles.cardDesc}>Permanently delete all your data</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#EF4444" />
          </TouchableOpacity>

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
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  socialMiniIcon: {
    padding: 8,
    borderRadius: 10,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
