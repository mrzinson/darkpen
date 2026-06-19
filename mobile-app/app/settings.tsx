import { useTheme } from '../context/ThemeContext';
import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, Platform, Linking, Alert, Modal, Animated, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AuthGuard } from '../components/AuthGuard';
import { AppLogo } from '../components/AppLogo';
import Config from '../constants/Config';

export default function SettingsScreen() {
  const { colors, isDark, setTheme, theme, language, setLanguage, t } = useTheme();
  const styles = getStyles(colors, isDark);

  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // New States for functional cards
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [cacheSize, setCacheSize] = useState('14.2 MB');
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Settings Toggles State
  const [notifSound, setNotifSound] = useState(true);
  const [notifAlerts, setNotifAlerts] = useState(true);
  const [notifUpdates, setNotifUpdates] = useState(true);
  
  const [privSaveHistory, setPrivSaveHistory] = useState(true);
  const [privIncognito, setPrivIncognito] = useState(false);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  
  const privScaleAnim = useRef(new Animated.Value(0)).current;
  const privOpacityAnim = useRef(new Animated.Value(0)).current;
  const notifScaleAnim = useRef(new Animated.Value(0)).current;
  const notifOpacityAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem('userData').then(data => {
        if (data) setUserData(JSON.parse(data));
      });

      // Load Settings
      AsyncStorage.getItem('settings_notif_sound').then(v => {
        if (v !== null) setNotifSound(v === 'true');
      });
      AsyncStorage.getItem('settings_notif_alerts').then(v => {
        if (v !== null) setNotifAlerts(v === 'true');
      });
      AsyncStorage.getItem('settings_notif_updates').then(v => {
        if (v !== null) setNotifUpdates(v === 'true');
      });
      AsyncStorage.getItem('settings_priv_save_history').then(v => {
        if (v !== null) setPrivSaveHistory(v === 'true');
      });
      AsyncStorage.getItem('settings_priv_incognito').then(v => {
        if (v !== null) setPrivIncognito(v === 'true');
      });
      AsyncStorage.getItem('settings_cache_size').then(v => {
        if (v !== null) {
          setCacheSize(v);
        } else {
          setCacheSize('14.2 MB');
        }
      });
    }, [])
  );

  const toggleNotifSound = async () => {
    const newVal = !notifSound;
    setNotifSound(newVal);
    await AsyncStorage.setItem('settings_notif_sound', String(newVal));
  };

  const toggleNotifAlerts = async () => {
    const newVal = !notifAlerts;
    setNotifAlerts(newVal);
    await AsyncStorage.setItem('settings_notif_alerts', String(newVal));
  };

  const toggleNotifUpdates = async () => {
    const newVal = !notifUpdates;
    setNotifUpdates(newVal);
    await AsyncStorage.setItem('settings_notif_updates', String(newVal));
  };

  const togglePrivSaveHistory = async () => {
    const newVal = !privSaveHistory;
    setPrivSaveHistory(newVal);
    await AsyncStorage.setItem('settings_priv_save_history', String(newVal));
  };

  const togglePrivIncognito = async () => {
    const newVal = !privIncognito;
    setPrivIncognito(newVal);
    await AsyncStorage.setItem('settings_priv_incognito', String(newVal));
  };

  const openDeleteModal = () => {
    setShowDeleteModal(true);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 200 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const closeDeleteModal = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.8, useNativeDriver: true, damping: 14, stiffness: 200 }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setShowDeleteModal(false));
  };

  const handleDeleteAccount = openDeleteModal;

  const openPrivacyModal = () => {
    setShowPrivacyModal(true);
    Animated.parallel([
      Animated.spring(privScaleAnim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 200 }),
      Animated.timing(privOpacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const closePrivacyModal = () => {
    Animated.parallel([
      Animated.spring(privScaleAnim, { toValue: 0.8, useNativeDriver: true, damping: 14, stiffness: 200 }),
      Animated.timing(privOpacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setShowPrivacyModal(false));
  };

  const openNotifModal = () => {
    setShowNotificationsModal(true);
    Animated.parallel([
      Animated.spring(notifScaleAnim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 200 }),
      Animated.timing(notifOpacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const closeNotifModal = () => {
    Animated.parallel([
      Animated.spring(notifScaleAnim, { toValue: 0.8, useNativeDriver: true, damping: 14, stiffness: 200 }),
      Animated.timing(notifOpacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setShowNotificationsModal(false));
  };

  const handleClearCache = () => {
    if (cacheSize === '0.0 MB') {
      Alert.alert(
        language === 'so' ? 'Khasnadda' : 'Cache Clean',
        language === 'so' ? 'Khasnadda app-ka mar hore ayaa la nadiifiyey!' : 'App cache is already cleared!'
      );
      return;
    }

    Alert.alert(
      language === 'so' ? 'Nadiifi Cache-ka' : 'Clear Cache',
      language === 'so' 
        ? `Ma hubtaa inaad rabto inaad nadiifiso ${cacheSize} oo xog kumeel-gaar ah? Tani waxba uma dhimayso akoonkaaga.` 
        : `Are you sure you want to clear ${cacheSize} of temporary cached data? This will not affect your account details.`,
      [
        {
          text: language === 'so' ? 'Jooji' : 'Cancel',
          style: 'cancel'
        },
        {
          text: language === 'so' ? 'Haa, Nadiifi' : 'Yes, Clear',
          onPress: async () => {
            setIsClearingCache(true);
            setShowClearCacheModal(true);
            
            try {
              await AsyncStorage.removeItem('home_books');
              await AsyncStorage.removeItem('home_exams');
              await AsyncStorage.removeItem('manhajka_books');
              await AsyncStorage.removeItem('exams_list');
            } catch (e) {
              console.warn(e);
            }

            setTimeout(async () => {
              setCacheSize('0.0 MB');
              await AsyncStorage.setItem('settings_cache_size', '0.0 MB');
              setIsClearingCache(false);
              setShowClearCacheModal(false);
              
              setTimeout(() => {
                Alert.alert(
                  language === 'so' ? 'Guul' : 'Success',
                  language === 'so' ? 'Khasnadda app-ka (Cache) si guul leh ayaa loo nadiifiyey! 🧹' : 'App cache has been cleared successfully! 🧹'
                );
              }, 300);
            }, 1800);
          }
        }
      ]
    );
  };

  const performDelete = async () => {
    setIsDeleting(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${Config.API_URL}/api/user/account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userData');
        setShowDeleteModal(false);
        router.replace('/login');
      } else {
        const data = await res.json();
        setIsDeleting(false);
        closeDeleteModal();
        setTimeout(() => Alert.alert("Error", data.message || "Failed to delete account"), 400);
      }
    } catch (err) {
      setIsDeleting(false);
      closeDeleteModal();
      setTimeout(() => Alert.alert("Error", "Network error occurred."), 400);
    }
  };

  const DeleteModal = () => (
    <Modal transparent visible={showDeleteModal} animationType="none" onRequestClose={closeDeleteModal}>
      <Animated.View style={[styles.modalOverlay, { opacity: opacityAnim }]}>
        <Animated.View style={[styles.modalCard, { transform: [{ scale: scaleAnim }] }]}>
          {/* Icon */}
          <View style={styles.modalIconWrapper}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="trash" size={32} color="#EF4444" />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.modalTitle}>
            {language === 'so' ? 'Tirtirida Akoonka' : 'Delete Account'}
          </Text>

          {/* Message */}
          <Text style={styles.modalMessage}>
            {language === 'so'
              ? "Ma hubtaa? Dhammaan xogtaada, fariimahaaga, iyo lacag bixintaadii ayaa si joogto ah loo tirtirayaa. Go'aankan lagama noqon karo."
              : "Are you sure? All your data, messages, and payment history will be permanently deleted. This action cannot be undone."}
          </Text>

          {/* Divider */}
          <View style={styles.modalDivider} />

          {/* Buttons */}
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={closeDeleteModal}
              activeOpacity={0.8}
              disabled={isDeleting}
            >
              <Text style={styles.modalCancelText}>
                {language === 'so' ? 'Jooji' : 'Cancel'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalDeleteBtn, isDeleting && { opacity: 0.7 }]}
              onPress={performDelete}
              activeOpacity={0.8}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="hourglass" size={16} color="#fff" />
                  <Text style={styles.modalDeleteText}>
                    {language === 'so' ? 'Tirtirayaa...' : 'Deleting...'}
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="trash" size={16} color="#fff" />
                  <Text style={styles.modalDeleteText}>
                    {language === 'so' ? 'Haa, Tirtir' : 'Yes, Delete'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );

  const PrivacyModal = () => (
    <Modal transparent visible={showPrivacyModal} animationType="none" onRequestClose={closePrivacyModal}>
      <Animated.View style={[styles.modalOverlay, { opacity: privOpacityAnim }]}>
        <Animated.View style={[styles.modalCard, { transform: [{ scale: privScaleAnim }] }]}>
          {/* Icon */}
          <View style={styles.modalIconWrapper}>
            <View style={[styles.modalIconCircle, { borderColor: '#10B981', backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5' }]}>
              <Ionicons name="lock-closed" size={32} color="#10B981" />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.modalTitle}>
            {language === 'so' ? 'Khaasnimada & Amniga' : 'Privacy & Security'}
          </Text>

          {/* Message / Description */}
          <Text style={styles.modalMessage}>
            {language === 'so'
              ? "Habayso xogtaada khaaska ah iyo badbaadada akoonkaaga."
              : "Manage your private data settings and account security."}
          </Text>

          {/* Settings Options */}
          <View style={styles.modalOptionsContainer}>
            {/* Save Chat History Toggle */}
            <View style={styles.modalOptionRow}>
              <View style={styles.optionInfo}>
                <Text style={styles.optionLabel}>
                  {language === 'so' ? 'Keydi Wada-hadalka' : 'Save Chat History'}
                </Text>
                <Text style={styles.optionSubLabel}>
                  {language === 'so' ? 'Wada-hadallada ku keydi talefanka' : 'Store chat sessions locally'}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.toggleSwitchMini, privSaveHistory && styles.toggleSwitchMiniActive]}
                onPress={togglePrivSaveHistory}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleKnobMini, privSaveHistory && styles.toggleKnobMiniActive]} />
              </TouchableOpacity>
            </View>

            {/* Incognito Mode Toggle */}
            <View style={styles.modalOptionRow}>
              <View style={styles.optionInfo}>
                <Text style={styles.optionLabel}>
                  {language === 'so' ? 'Habka Qarsoodi' : 'Incognito Mode'}
                </Text>
                <Text style={styles.optionSubLabel}>
                  {language === 'so' ? 'Ha u dirin xogta isticmaalka server-ka' : 'Do not send usage logs to server'}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.toggleSwitchMini, privIncognito && styles.toggleSwitchMiniActive]}
                onPress={togglePrivIncognito}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleKnobMini, privIncognito && styles.toggleKnobMiniActive]} />
              </TouchableOpacity>
            </View>

            {/* Change Password Shortcut */}
            <TouchableOpacity 
              style={styles.modalActionLink}
              onPress={() => {
                closePrivacyModal();
                router.push('/edit-profile');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="key-outline" size={18} color="#3B82F6" />
              <Text style={styles.modalActionLinkText}>
                {language === 'so' ? 'Beddel Password-ka' : 'Change Password'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.modalDivider} />

          {/* Close Button */}
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={closePrivacyModal}
            activeOpacity={0.8}
          >
            <Text style={styles.modalCloseText}>
              {language === 'so' ? 'Xir' : 'Close'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );

  const NotificationsModal = () => (
    <Modal transparent visible={showNotificationsModal} animationType="none" onRequestClose={closeNotifModal}>
      <Animated.View style={[styles.modalOverlay, { opacity: notifOpacityAnim }]}>
        <Animated.View style={[styles.modalCard, { transform: [{ scale: notifScaleAnim }] }]}>
          {/* Icon */}
          <View style={styles.modalIconWrapper}>
            <View style={[styles.modalIconCircle, { borderColor: '#EF4444', backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2' }]}>
              <Ionicons name="notifications" size={32} color="#EF4444" />
            </View>
          </View>

          {/* Title */}
          <Text style={styles.modalTitle}>
            {language === 'so' ? 'Ogeysiisyada' : 'Notifications'}
          </Text>

          {/* Message / Description */}
          <Text style={styles.modalMessage}>
            {language === 'so'
              ? "Habayso sida aad u helayso ogeysiisyada mobile-ka."
              : "Manage how you receive alerts and updates on your phone."}
          </Text>

          {/* Settings Options */}
          <View style={styles.modalOptionsContainer}>
            {/* Sound Effects Toggle */}
            <View style={styles.modalOptionRow}>
              <View style={styles.optionInfo}>
                <Text style={styles.optionLabel}>
                  {language === 'so' ? 'Codka Farriinta' : 'Message Sound'}
                </Text>
                <Text style={styles.optionSubLabel}>
                  {language === 'so' ? 'Daar codka marka fariin ku soo dhacdo' : 'Play alert tone for messages'}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.toggleSwitchMini, notifSound && styles.toggleSwitchMiniActive]}
                onPress={toggleNotifSound}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleKnobMini, notifSound && styles.toggleKnobMiniActive]} />
              </TouchableOpacity>
            </View>

            {/* Push Alerts Toggle */}
            <View style={styles.modalOptionRow}>
              <View style={styles.optionInfo}>
                <Text style={styles.optionLabel}>
                  {language === 'so' ? 'Ogeysiiska Kore' : 'Push Alerts'}
                </Text>
                <Text style={styles.optionSubLabel}>
                  {language === 'so' ? 'Ku tus digniinta ogeysiisyada shaashadda' : 'Show notification banners'}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.toggleSwitchMini, notifAlerts && styles.toggleSwitchMiniActive]}
                onPress={toggleNotifAlerts}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleKnobMini, notifAlerts && styles.toggleKnobMiniActive]} />
              </TouchableOpacity>
            </View>

            {/* Updates Toggle */}
            <View style={styles.modalOptionRow}>
              <View style={styles.optionInfo}>
                <Text style={styles.optionLabel}>
                  {language === 'so' ? 'Digniinaha App-ka' : 'App Updates'}
                </Text>
                <Text style={styles.optionSubLabel}>
                  {language === 'so' ? 'Ka hel digniino ku saabsan manhajka ama AI' : 'Receive educational updates'}
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.toggleSwitchMini, notifUpdates && styles.toggleSwitchMiniActive]}
                onPress={toggleNotifUpdates}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleKnobMini, notifUpdates && styles.toggleKnobMiniActive]} />
              </TouchableOpacity>
            </View>

            {/* Test Notification Button */}
            <TouchableOpacity 
              style={styles.modalActionLink}
              onPress={async () => {
                try {
                  const { status } = await Notifications.getPermissionsAsync();
                  if (status === 'granted') {
                    await Notifications.scheduleNotificationAsync({
                      content: {
                        title: "Darkpen AI 🎨",
                        body: language === 'so' 
                          ? "Ogeysiiskaagu wuxuu u shaqaynayaa si guul leh! ⚡" 
                          : "Your notifications are working successfully! ⚡",
                        sound: notifSound,
                      },
                      trigger: null,
                    });
                  } else {
                    const req = await Notifications.requestPermissionsAsync();
                    if (req.status === 'granted') {
                      await Notifications.scheduleNotificationAsync({
                        content: {
                          title: "Darkpen AI 🎨",
                          body: language === 'so' 
                            ? "Waad ku mahadsantahay fasaxa ogeysiisyada! ⚡" 
                            : "Thank you for enabling notifications! ⚡",
                          sound: notifSound,
                        },
                        trigger: null,
                      });
                    } else {
                      Alert.alert(
                        language === 'so' ? 'Xayiraad ayaa jirta' : 'Permission Blocked',
                        language === 'so'
                          ? 'Fadlan ka fasax ogeysiisyada Settings-ka talefankaaga.'
                          : 'Please enable notifications permission in your phone system settings.'
                      );
                    }
                  }
                } catch (err) {
                  console.warn(err);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={18} color="#3B82F6" />
              <Text style={styles.modalActionLinkText}>
                {language === 'so' ? 'Tijaabi Ogeysiiska hadda' : 'Trigger Test Notification'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.modalDivider} />

          {/* Close Button */}
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={closeNotifModal}
            activeOpacity={0.8}
          >
            <Text style={styles.modalCloseText}>
              {language === 'so' ? 'Xir' : 'Close'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );

  const ClearCacheModal = () => (
    <Modal transparent visible={showClearCacheModal} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { maxWidth: 300, paddingVertical: 36, alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={[styles.modalTitle, { fontSize: 18, marginTop: 20, marginBottom: 8 }]}>
            {language === 'so' ? 'Nadiifinaya...' : 'Clearing Cache...'}
          </Text>
          <Text style={[styles.modalMessage, { marginBottom: 0 }]}>
            {language === 'so' ? 'Fadlan sug cabbaar...' : 'Please wait a moment...'}
          </Text>
        </View>
      </View>
    </Modal>
  );

  return (
    <AuthGuard>
      <DeleteModal />
      <PrivacyModal />
      <NotificationsModal />
      <ClearCacheModal />
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
            onPress={openPrivacyModal}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#10B981' }]}>
              <Ionicons name="lock-closed" size={22} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{t('privacy_security')}</Text>
              <Text style={styles.cardDesc}>Password, Passkeys & Data Settings</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.neutral} />
          </TouchableOpacity>

          {/* 3. Notifications */}
          <TouchableOpacity 
            style={styles.settingCard} 
            onPress={openNotifModal}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#EF4444' }]}>
              <Ionicons name="notifications" size={22} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{t('notifications')}</Text>
              <Text style={styles.cardDesc}>Sounds, Alerts & Test Notification</Text>
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

          {/* Share App Card */}
          <TouchableOpacity 
            style={styles.settingCard} 
            onPress={async () => {
              try {
                await Share.share({
                  message: `🌟 Kusoo dhawaaw Darkpen AI – Caawiyahaaga Kowaad ee Aqoonta iyo Madadaalada! 🚀\n\nHaddii aad tahay arday, macallin, ama qof raba inuu nolosha iyo shaqada fududeeyo, Darkpen AI waa app-ka kaliya ee kulansaday dhammaan qalabkan casriga ah:\n\n1️⃣ Chat AI oo Caqli Badan: Wuxuu ku qalabaysan yahay moodelladii ugu dambeeyay ee 2026. Wuxuu si heer sare ah ugu hadlaa luuqadda Soomaaliga. Waxaad weydiin kartaa su'aal kasta, wuxuu kuu sharxi karaa faylasha (PDF/Docs).\n2️⃣ Maktabad Bilaash ah (Books & Exams): Ka akhriso buugaagta iyo imtixaanada manhajka Puntland, Somaliland, iyo Soomaaliya iyadoo loo eegayo goobta aad joogto.\n3️⃣ Chat-ka Shukaansiga (Love Chat): AI si gaar ah loo tababaray inuu kuu shukaansado, ku maaweeliyo, kuuna weheliyo waqtiyada firaaqada.\n4️⃣ Tartanka Quiz-ka: Ka qaybgal tartamada aqooneed ee app-ka oo u tartam abaalmarinno lacageed oo gaaraya $1,000 iyo ka badan!\n5️⃣ AI Exam Generator: Qalab u gaar ah macallimiinta iyo ardayda oo si fudud kuugu diyaarinaya imtixaanno heerar kala duwan leh.\n\nFursadan ha moogaan! La soo deg Darkpen AI hadda oo bilow safarkaaga aqoonta:\n👉 https://play.google.com/store/apps/details?id=com.zinson.darkpen`,
                });
              } catch (err) {
                console.error(err);
              }
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#F43F5E' }]}>
              <Ionicons name="share-social-outline" size={22} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{language === 'so' ? 'La Wadaag App-ka' : 'Share App'}</Text>
              <Text style={styles.cardDesc}>{language === 'so' ? 'U yeer asxaabtaada si ay kuugu soo biiraan' : 'Invite your friends to join you'}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.neutral} />
          </TouchableOpacity>

          {/* Usage & Credits Card */}
          <TouchableOpacity 
            style={styles.settingCard} 
            onPress={() => router.push('/usage')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#8B5CF6' }]}>
              <Ionicons name="analytics" size={22} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{language === 'so' ? 'Isticmaalka & Credits-ka' : 'Usage & Credits'}</Text>
              <Text style={styles.cardDesc}>{language === 'so' ? 'Eeg inta kugu hartay iyo xadkaaga' : 'View credit details and remaining usage'}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.neutral} />
          </TouchableOpacity>

          {/* Clear Cache Card */}
          <TouchableOpacity 
            style={styles.settingCard} 
            onPress={handleClearCache}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#F59E0B' }]}>
              <Ionicons name="trash-outline" size={22} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{language === 'so' ? 'Nadiifi Khasnadda (Cache)' : 'Clear App Cache'}</Text>
              <Text style={styles.cardDesc}>{language === 'so' ? `Xogta kumeel-gaarka ah: ${cacheSize}` : `Free up space: ${cacheSize}`}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.neutral} />
          </TouchableOpacity>

          {/* Help & Support Card */}
          <TouchableOpacity 
            style={styles.settingCard} 
            onPress={() => {
              Alert.alert(
                language === 'so' ? 'Caawinaad & Taageero' : 'Help & Support',
                language === 'so' 
                  ? 'U dir fariin WhatsApp ah ama Email taageerada app-ka wixii su\'aalo ah.'
                  : 'Contact support team via WhatsApp or Email for any assistance.',
                [
                  {
                    text: 'WhatsApp Support',
                    onPress: () => Linking.openURL('https://wa.me/252659119779')
                  },
                  {
                    text: 'Email Support',
                    onPress: () => Linking.openURL('mailto:support@darkpen.com')
                  },
                  {
                    text: language === 'so' ? 'Jooji' : 'Cancel',
                    style: 'cancel'
                  }
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: '#06B6D4' }]}>
              <Feather name="help-circle" size={22} color="white" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{language === 'so' ? 'Caawinaad & Taageero' : 'Help & Support'}</Text>
              <Text style={styles.cardDesc}>{language === 'so' ? 'Nagala soo xiriir WhatsApp/Email' : 'Reach us via WhatsApp/Email'}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.neutral} />
          </TouchableOpacity>

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

          {/* 9. Delete Account */}
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
  },

  // ── Modals Styling ──────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: isDark ? '#161B22' : '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 40,
    elevation: 20,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
  },
  modalIconWrapper: {
    marginBottom: 20,
  },
  modalIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#FECACA',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: isDark ? '#F9FAFB' : '#111827',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  modalMessage: {
    fontSize: 14,
    color: isDark ? '#9CA3AF' : '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    fontWeight: '500',
  },
  modalDivider: {
    width: '100%',
    height: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F3F4F6',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE',
  },
  modalCancelText: {
    color: '#3B82F6',
    fontWeight: '700',
    fontSize: 15,
  },
  modalDeleteBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  modalDeleteText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  modalOptionsContainer: {
    width: '100%',
    marginTop: 8,
    marginBottom: 16,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F3F4F6',
  },
  optionInfo: {
    flex: 1,
    paddingRight: 12,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: isDark ? '#F3F4F6' : '#1F2937',
    marginBottom: 2,
  },
  optionSubLabel: {
    fontSize: 11,
    color: isDark ? '#9CA3AF' : '#6B7280',
    lineHeight: 14,
  },
  toggleSwitchMini: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchMiniActive: {
    backgroundColor: '#3B82F6',
  },
  toggleKnobMini: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'white',
  },
  toggleKnobMiniActive: {
    transform: [{ translateX: 18 }],
  },
  modalActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 4,
  },
  modalActionLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3B82F6',
  },
  modalCloseBtn: {
    width: '100%',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
  },
  modalCloseText: {
    color: isDark ? '#F3F4F6' : '#1F2937',
    fontWeight: '700',
    fontSize: 15,
  },
});
