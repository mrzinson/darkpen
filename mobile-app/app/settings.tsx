import { useTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthGuard } from '../components/AuthGuard';

export default function SettingsScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userData, setUserData] = useState<any>(null);

  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem('userData').then(data => {
        if (data) setUserData(JSON.parse(data));
      });
    }, [])
  );

  const renderSettingItem = (
    iconName: keyof typeof Ionicons.glyphMap, 
    iconColor: string, 
    title: string, 
    subtitle?: string, 
    isLast: boolean = false
  ) => (
    <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
      <View style={[styles.settingIconBox, { backgroundColor: iconColor }]}>
        <Ionicons name={iconName} size={18} color="#FFFFFF" />
      </View>
      <View style={[styles.settingTextContainer, !isLast && styles.settingBorder]}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <AuthGuard>
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Top Navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Ionicons name="arrow-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="search" size={24} color={colors.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="ellipsis-vertical" size={24} color={colors.secondary} />
          </TouchableOpacity>
        </View>
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
              <View style={[styles.profileImage, { backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="person" size={50} color="white" />
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="pencil" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{userData ? userData.name : '...'}</Text>
          <Text style={styles.profileMeta}>{userData?.username ? `@${userData.username}` : '@user'}</Text>
        </View>

        {/* Primary Settings Block */}
        <View style={styles.cardGroup}>
          <TouchableOpacity onPress={() => router.push('/edit-profile')}>
            {renderSettingItem("person", "#3B82F6", "Account", "Name, Username, Password")}
          </TouchableOpacity>
          {renderSettingItem("lock-closed", "#10B981", "Privacy & Security", "Password, Passkeys")}
          {renderSettingItem("notifications", "#EF4444", "Notifications", "Sounds & Alerts", true)}
        </View>

        {/* Appearance Settings Block */}
        <Text style={styles.sectionHeader}>APPEARANCE</Text>
        <View style={styles.cardGroup}>
          <View style={[styles.settingItem, { paddingVertical: 8 }]}>
            <View style={[styles.settingIconBox, { backgroundColor: '#A855F7' }]}>
              <Ionicons name="moon" size={18} color="#FFFFFF" />
            </View>
            <View style={[styles.settingTextContainer, { borderBottomWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <View>
                <Text style={styles.settingTitle}>Dark Mode</Text>
                <Text style={styles.settingSubtitle}>Midnight Blue theme</Text>
              </View>
              <TouchableOpacity 
                style={[styles.toggleSwitch, isDark && styles.toggleSwitchActive]}
                onPress={() => setTheme(isDark ? 'light' : 'dark')}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleKnob, isDark && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
    </AuthGuard>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background, // Light gray background matching Telegram style
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  headerIcon: {
    padding: 12,
  },
  headerRight: {
    flexDirection: 'row',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  
  // Profile
  profileSection: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    backgroundColor: '#A855F7', // Purple badge
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
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  profileMeta: {
    fontSize: 14,
    color: colors.textLight,
    fontWeight: '500',
  },

  // Cards
  cardGroup: {
    backgroundColor: colors.card,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    paddingVertical: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
  },
  settingIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12, // Rounded squares
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingTextContainer: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 16,
  },
  settingBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  settingSubtitle: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 2,
  },
  
  // Custom Toggle Switch Styles
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textLight,
    letterSpacing: 1.5,
    marginTop: 10,
    marginBottom: 8,
    marginLeft: 16,
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5E7EB',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#3B82F6', // Blue for active Dark Mode
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    transform: [{ translateX: 20 }],
  }
});
