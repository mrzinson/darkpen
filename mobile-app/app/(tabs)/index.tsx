import { AzureTheme } from '../../constants/AzureTheme';
import { useTheme } from '../../context/ThemeContext';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Modal, Dimensions, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { CustomBlurView as BlurView } from '../../components/CustomBlurView';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Image, Linking, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import Config from '../../constants/Config';
import { AppLogo } from '../../components/AppLogo';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 48;
const CARD_HEIGHT = 180;
const CARD_SPACING = 16;
const SNAP_INTERVAL = CARD_WIDTH + CARD_SPACING;

export default function HomeScreen() {
  const { colors, isDark, setTheme, theme, t, language, setLanguage } = useTheme();
  const styles = getStyles(colors, isDark);

  const router = useRouter();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  const [activePromoIndex, setActivePromoIndex] = useState(0);
  const promoScrollViewRef = React.useRef<ScrollView>(null);

  const [promoCards, setPromoCards] = useState<any[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [selectedPromo, setSelectedPromo] = useState<any>(null);
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const FALLBACK_PROMO_CARDS = [
    {
      id: 'f1',
      title_en: 'Books',
      title_so: 'Books',
      desc_en: 'Explore and read all educational and curriculum books.',
      desc_so: 'Baro oo akhriso dhammaan buugaagta la heli karo ee waxtarka leh.',
      button_text_en: 'Get Started',
      button_text_so: 'Hada Bilow',
      image_url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=600',
      route: '/manhajka',
      overlay_color_light: 'rgba(29, 78, 216, 0.65)',
      overlay_color_dark: 'rgba(30, 41, 59, 0.75)'
    },
    {
      id: 'f2',
      title_en: 'Exams',
      title_so: 'Imtixaanada',
      desc_en: 'Train yourself and prepare for official national exams.',
      desc_so: 'Tababar naftaada oo ku diyaargarow imtixaanada shahaadiga ah.',
      button_text_en: 'Start Exam',
      button_text_so: 'Bilow Imtixaan',
      image_url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=600',
      route: '/exams',
      overlay_color_light: 'rgba(109, 40, 217, 0.65)',
      overlay_color_dark: 'rgba(46, 16, 101, 0.75)'
    },
    {
      id: 'f3',
      title_en: 'AI Assistance',
      title_so: 'Caawimaada AI',
      desc_en: 'Ask the smart AI assistant any question and get quick answers.',
      desc_so: 'Weydii caawiyaha AI wixii su\'aal ah oo hel jawaab degdeg ah.',
      button_text_en: 'Chat Now',
      button_text_so: 'Hada Bilow',
      image_url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=600',
      route: '/(tabs)/chat',
      overlay_color_light: 'rgba(4, 120, 87, 0.65)',
      overlay_color_dark: 'rgba(6, 78, 59, 0.75)'
    }
  ];

  const displayCards = promoCards.length > 0 ? promoCards : FALLBACK_PROMO_CARDS;

  React.useEffect(() => {
    if (displayCards.length === 0) return;
    const timer = setInterval(() => {
      const nextIndex = (activePromoIndex + 1) % displayCards.length;
      setActivePromoIndex(nextIndex);
      promoScrollViewRef.current?.scrollTo({ x: nextIndex * SNAP_INTERVAL, animated: true });
    }, 10000); // 10 seconds

    return () => clearInterval(timer);
  }, [activePromoIndex, displayCards]);

  const handlePromoScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / SNAP_INTERVAL);
    if (index !== activePromoIndex && index >= 0 && index < displayCards.length) {
      setActivePromoIndex(index);
    }
  };

  const { expoPushToken } = usePushNotifications();

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${Config.API_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.user) {
        setUserData(data.user);
        await AsyncStorage.setItem('userData', JSON.stringify(data.user));

        // Send Push Token to Backend if available
        if (expoPushToken?.data) {
          fetch(`${Config.API_URL}/api/auth/push-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ token: expoPushToken.data })
          }).catch(err => console.log('Push token update failed:', err));
        }
      }
    } catch (err) {
      // Check local cache if api fails
      const cached = await AsyncStorage.getItem('userData');
      if (cached) setUserData(JSON.parse(cached));
    }
  };

  const fetchPromoCards = async () => {
    try {
      // 1. Try to load from cache first
      const cached = await AsyncStorage.getItem('home_promo_cards');
      if (cached) setPromoCards(JSON.parse(cached));

      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/user/promo-cards`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setPromoCards(data);
        // 2. Update cache
        await AsyncStorage.setItem('home_promo_cards', JSON.stringify(data));
      }
    } catch (err) {
      console.log('Error fetching promo cards for home:', err);
    } finally {
      setLoadingPromos(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const cached = await AsyncStorage.getItem('home_notifications');
      if (cached) setNotifications(JSON.parse(cached));

      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const response = await fetch(`${Config.API_URL}/api/user/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setNotifications(data);
        await AsyncStorage.setItem('home_notifications', JSON.stringify(data));
      }
    } catch (err) {
      console.log('Error fetching notifications:', err);
    }
  };

  const [books, setBooks] = useState<any[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [exams, setExams] = useState<any[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);

  const fetchBooks = async () => {
    try {
      // 1. Try to load from cache first
      const cached = await AsyncStorage.getItem('home_books');
      if (cached) setBooks(JSON.parse(cached));

      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/user/books`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        const sliced = data.slice(0, 5);
        setBooks(sliced);
        // 2. Update cache
        await AsyncStorage.setItem('home_books', JSON.stringify(sliced));
      }
    } catch (err) {
      console.log('Error fetching books for home:', err);
    } finally {
      setLoadingBooks(false);
    }
  };

  const fetchExams = async () => {
    try {
      // 1. Try to load from cache first
      const cached = await AsyncStorage.getItem('home_exams');
      if (cached) setExams(JSON.parse(cached));

      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/user/exams`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        const sliced = data.slice(0, 5);
        setExams(sliced);
        // 2. Update cache
        await AsyncStorage.setItem('home_exams', JSON.stringify(sliced));
      }
    } catch (err) {
      console.log('Error fetching exams for home:', err);
    } finally {
      setLoadingExams(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
      fetchBooks();
      fetchExams();
      fetchPromoCards();
      fetchNotifications();
    }, [])
  );

  const handlePromoPress = (card: any) => {
    if (card.promo_type === 'reward') {
      if (card.claim_status === 'approved') {
        if (card.route.startsWith('http')) {
          Linking.openURL(card.route).catch(err => console.log("Failed opening link:", err));
        } else {
          router.push(card.route as any);
        }
      } else if (card.claim_status === 'pending') {
        alert(language === 'so' ? 'Dalabkaaga wuxuu ku jiraa sugitaan (Pending)!' : 'Your claim is pending admin approval.');
      } else {
        setSelectedPromo(card);
        setScreenshotUri(null);
      }
    } else {
      if (card.route.startsWith('http')) {
        Linking.openURL(card.route).catch(err => console.log("Failed opening link:", err));
      } else {
        router.push(card.route as any);
      }
    }
  };

  const handleSelectScreenshot = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert(language === 'so' ? 'Fadlan fasax u sii app-ka inuu sawiradaada galo.' : 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setScreenshotUri(result.assets[0].uri);
    }
  };

  const handleSubmitClaim = async () => {
    if (!screenshotUri) {
      alert(language === 'so' ? 'Fadlan dooro sawirka screenshot-ka marka hore.' : 'Please select a screenshot first.');
      return;
    }

    setSubmittingClaim(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const formData = new FormData();
      const uriParts = screenshotUri.split('.');
      const fileType = uriParts[uriParts.length - 1] || 'jpg';

      if (Platform.OS === 'web') {
        const response = await fetch(screenshotUri);
        const blob = await response.blob();
        formData.append('screenshot', blob, `screenshot.${fileType}`);
      } else {
        formData.append('screenshot', {
          uri: screenshotUri,
          name: `screenshot.${fileType}`,
          type: `image/${fileType === 'png' ? 'png' : 'jpeg'}`
        } as any);
      }

      const res = await fetch(`${Config.API_URL}/api/user/promo-cards/${selectedPromo.id}/claim`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Dalabkaaga si guul leh ayaa loo gudbiyey!');
        setSelectedPromo(null);
        setScreenshotUri(null);
        fetchPromoCards();
      } else {
        alert(data.message || 'Cilad ayaa dhacday');
      }
    } catch (err) {
      console.log('Error submitting claim:', err);
      alert(language === 'so' ? 'Cilad dhinaca internet-ka ah' : 'Network error submitting claim.');
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleLogout = async () => {
    setSidebarVisible(false);
    if (!userData) {
      router.push('/login');
      return;
    }
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userData');
    setUserData(null);
    router.push('/login');
  };

  const menuSections = [
    {
      title: 'Waxbarashada & AI',
      items: [
        { id: 'profile', icon: 'person-outline', label: t('profile'), route: '/profile' },
        { id: 'exam-generator', icon: 'sparkles-outline', label: 'AI Exam Generator', route: '/exam-generator', isNew: true },
        { id: 'books', icon: 'book-outline', label: t('books'), route: '/manhajka' },
        { id: 'groups', icon: 'people-outline', label: t('groups'), route: '/group' },
      ]
    },
    {
      title: 'Akoonka & Settings',
      items: [
        { id: 'billing', icon: 'card-outline', label: t('billing'), route: '/billing' },
        { id: 'usage', icon: 'pie-chart-outline', label: 'Isticmaalka (Usage)', route: '/usage' },
        { id: 'settings', icon: 'settings-outline', label: t('settings'), route: '/settings' },
        { id: 'about', icon: 'information-circle-outline', label: t('about_darkpen'), route: '/about' },
      ]
    }
  ];



  const handleMenuPress = (route: string) => {
    setSidebarVisible(false);
    setTimeout(() => router.push(route as any), 200);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Premium Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={() => setSidebarVisible(true)}>
          <Ionicons name="menu-outline" size={26} color={colors.secondary} />
        </TouchableOpacity>

        <View style={styles.brandTitle}>
          
          <Text style={styles.appName}>DARKPEN</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setNotificationVisible(true)}>
            <Ionicons name="notifications-outline" size={24} color={colors.secondary} />
            {notifications.length > 0 && <View style={styles.notificationDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.helpProfile} onPress={() => setHelpVisible(true)} activeOpacity={0.75}>
            <Ionicons name="logo-whatsapp" size={22} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.greetingBrand}>
          <Text style={styles.greetingTitle}>Kuso dhawaaw Darkpen</Text>
        </View>
        <Text style={styles.subtitle}>waa madal ka caawinaysa ardayda qaybaha kala duwan ee waxbarshada</Text>

        {/* promo cards */}
        <ScrollView
          ref={promoScrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScroll}
          contentContainerStyle={{ paddingRight: 16 }}
          onMomentumScrollEnd={handlePromoScroll}
          snapToInterval={SNAP_INTERVAL}
          decelerationRate="fast"
        >
          {displayCards.map((card: any) => {
            const displayTitle = language === 'so' ? card.title_so : card.title_en;
            const displayDesc = language === 'so' ? card.desc_so : card.desc_en;
            const displayBtnText = language === 'so' ? card.button_text_so : card.button_text_en;
            
            const displayImage = card.image_url.startsWith('http') 
              ? card.image_url 
              : `${Config.API_URL}${card.image_url}`;

            const lightOverlay = card.overlay_color_light || 'rgba(29, 78, 216, 0.65)';
            const darkOverlay = card.overlay_color_dark || 'rgba(30, 41, 59, 0.75)';
            const overlayColor = isDark ? darkOverlay : lightOverlay;

            return (
              <ImageBackground
                key={card.id || card.route}
                source={{ uri: displayImage }}
                style={styles.promoCard}
                imageStyle={{ borderRadius: 20 }}
                resizeMode="cover"
              >
                <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor, borderRadius: 20 }]} />
                
                {card.promo_type === 'reward' && card.reward_credits > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    backgroundColor: card.claim_status === 'approved' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(50, 215, 75, 0.95)',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 10,
                    zIndex: 3,
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2
                  }}>
                    <Ionicons name="gift-outline" size={10} color="#ffffff" style={{ marginRight: 3 }} />
                    <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 10 }}>
                      +{card.reward_credits} {card.reward_type === 'standard' ? 'Standard' : 'Love'}
                    </Text>
                  </View>
                )}

                <View style={{ zIndex: 2 }}>
                  <Text style={styles.promoCardTitle}>{displayTitle}</Text>
                  <Text style={styles.promoCardDesc}>{displayDesc}</Text>
                </View>
                <TouchableOpacity 
                  style={[
                    styles.promoCardBtn, 
                    { 
                      backgroundColor: card.claim_status === 'pending' ? 'rgba(255,255,255,0.4)' : card.claim_status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : '#ffffff', 
                      borderColor: card.claim_status === 'approved' ? '#10B981' : 'transparent',
                      borderWidth: card.claim_status === 'approved' ? 1 : 0,
                      zIndex: 2 
                    }
                  ]} 
                  onPress={() => handlePromoPress(card)} 
                  disabled={card.claim_status === 'pending'}
                  activeOpacity={0.85}
                >
                  <Text style={[
                    styles.promoCardBtnText, 
                    { 
                      color: card.claim_status === 'approved' ? '#10B981' : card.claim_status === 'pending' ? '#ffffff' : (isDark ? '#1E293B' : '#3B82F6') 
                    }
                  ]}>
                    {card.claim_status === 'approved' 
                      ? (language === 'so' ? 'Waa la sheegtay' : 'Claimed')
                      : card.claim_status === 'pending' 
                        ? (language === 'so' ? 'Sugaya...' : 'Pending...') 
                        : displayBtnText
                    }
                  </Text>
                </TouchableOpacity>
              </ImageBackground>
            );
          })}
        </ScrollView>

        {/* Horizontal Books Section with ImageBackground and Blur */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Books</Text>
          <TouchableOpacity onPress={() => router.push('/manhajka')}>
            <Text style={styles.seeAll}>View All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {loadingBooks ? (
            <View style={{ padding: 20 }}><Text>LOADING...</Text></View>
          ) : books.length > 0 ? (
            books.map(book => (
              <TouchableOpacity
                key={book.id}
                style={styles.bookCardWrapper}
                activeOpacity={0.8}
                onPress={() => {
                  if (book.pdf_url) {
                    router.push({
                      pathname: '/readerexam',
                      params: {
                        pdfUrl: Config.getMediaUrl(book.pdf_url) || '',
                        title: book.title,
                        type: 'book' // Explicitly pass 'book' type
                      }
                    });
                  } else {
                    alert('Buuggan malaha PDF');
                  }
                }}
              >
                <ImageBackground
                  source={{ uri: Config.getMediaUrl(book.image_url) || 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=200&auto=format&fit=crop' }}
                  style={styles.bookImage}
                  imageStyle={{ borderRadius: 16 }}
                >
                  {/* Fallback color overlay if image fails or is loading */}
                  <View style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />

                  {/* Bottom blurred info section */}
                  <View style={styles.bookInfoContainer}>
                    <BlurView intensity={60} tint="dark" style={styles.bookBlur}>
                      <Ionicons name="book" size={20} color="white" style={styles.bookIconSmall} />
                      <View>
                        <Text style={styles.bookTitle}>{book.title}</Text>
                        <Text style={styles.bookGrade}>{book.grade}</Text>
                      </View>
                    </BlurView>
                  </View>
                </ImageBackground>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.homeEmptyState}>
              <Ionicons name="time-outline" size={24} color="#3B82F6" style={{ marginBottom: 6 }} />
              <Text style={styles.homeEmptyStateTitle}>
                {userData?.country === 'Somalia' && userData?.region_state
                  ? `${userData.region_state}`
                  : userData?.country || 'Gobolkaaga'}
              </Text>
              <Text style={styles.homeEmptyStateMessage}>
                Buugaagtii manhajka ee aad u baahan tahay wali kuma jiraan nidaamka. Dhawr casho ka bacdi ayaa lasoo dari doonaa.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Exams Section (New) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Exams</Text>
          <TouchableOpacity onPress={() => router.push('/exams')}>
            <Text style={styles.seeAll}>View All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {loadingExams ? (
            <View style={{ padding: 20 }}><Text>LOADING...</Text></View>
          ) : exams.length > 0 ? (
            exams.map(exam => (
              <TouchableOpacity
                key={exam.id}
                style={styles.bookCardWrapper}
                activeOpacity={0.8}
                onPress={() => {
                  if (exam.pdf_url) {
                    router.push({
                      pathname: '/readerexam',
                      params: {
                        pdfUrl: Config.getMediaUrl(exam.pdf_url) || '',
                        title: exam.title,
                        type: 'exam' // Explicitly pass 'exam' type
                      }
                    });
                  } else {
                    alert('Imtixaankan malaha PDF');
                  }
                }}
              >
                <ImageBackground
                  source={{ uri: Config.getMediaUrl(exam.image_url) || 'https://images.unsplash.com/photo-1546410531-df4cb71576bd?w=200&auto=format&fit=crop' }}
                  style={styles.bookImage}
                  imageStyle={{ borderRadius: 16 }}
                >
                  <View style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} />

                  <View style={styles.bookInfoContainer}>
                    <BlurView intensity={60} tint="dark" style={styles.bookBlur}>
                      <Ionicons name="document-text" size={20} color="white" style={styles.bookIconSmall} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bookTitle} numberOfLines={1}>{exam.title}</Text>
                        <Text style={styles.bookGrade}>{exam.category} • {exam.year}</Text>
                      </View>
                    </BlurView>
                  </View>
                </ImageBackground>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.homeEmptyState}>
              <Ionicons name="time-outline" size={24} color="#3B82F6" style={{ marginBottom: 6 }} />
              <Text style={styles.homeEmptyStateTitle}>
                {userData?.country === 'Somalia' && userData?.region_state
                  ? `${userData.region_state}`
                  : userData?.country || 'Gobolkaaga'}
              </Text>
              <Text style={styles.homeEmptyStateMessage}>
                Imtixaanadii aad u baahan tahay wali kuma jiraan nidaamka. Dhawr casho ka bacdi ayaa lasoo dari doonaa.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Extra spacing for tab bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Full-Height Drawer Sidebar Modal */}
      <Modal visible={sidebarVisible} transparent={true} animationType="fade" onRequestClose={() => setSidebarVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackground} activeOpacity={1} onPress={() => setSidebarVisible(false)} />

          <View style={styles.drawerContainer}>
            <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
              <View style={styles.drawerHeader}>
                <View style={styles.drawerProfile}>
                  <View style={styles.drawerAvatar}>
                    {userData?.profile_picture ? (
                      <Image source={{ uri: Config.getMediaUrl(userData.profile_picture) || undefined }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                    ) : (
                      <AppLogo size={48} variant="white" />
                    )}
                  </View>
                  <View>
                    <Text style={styles.drawerName}>{userData?.username ? `@${userData.username}` : (userData?.name || 'Darkpen Guest')}</Text>
                    <Text style={styles.drawerEmail}>{userData ? userData.whatsapp_number : 'Welcome to Darkpen'}</Text>
                    {userData && (
                      <View style={[styles.walletBadge, isDark && { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.4)' }]}>
                        <Ionicons name="wallet" size={14} color={isDark ? '#60A5FA' : 'white'} />
                        <Text style={[styles.walletBalance, isDark && { color: '#60A5FA' }]}>{userData.balance || 0} Credits</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <ScrollView style={styles.drawerMenu} showsVerticalScrollIndicator={false}>
                {menuSections.map((section, sIdx) => (
                  <View key={sIdx} style={styles.drawerSection}>
                    <Text style={styles.drawerSectionTitle}>{section.title}</Text>
                    {section.items.map((item) => (
                      <TouchableOpacity key={item.id} style={styles.drawerMenuItem} onPress={() => handleMenuPress(item.route)}>
                        <Ionicons name={item.icon as any} size={20} color={colors.secondary} style={styles.drawerMenuIcon} />
                        <Text style={styles.drawerMenuLabel}>{item.label}</Text>
                        {item.isNew && (
                          <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>NEW</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}

                {/* Dark Mode Toggle Switch inside Sidebar */}
                <TouchableOpacity 
                  style={[styles.drawerMenuItem, { borderTopWidth: 1, borderTopColor: colors.border || '#333', marginTop: 12, paddingTop: 16 }]} 
                  onPress={() => setTheme(isDark ? 'light' : 'dark')}
                  activeOpacity={0.7}
                >
                  <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={22} color={isDark ? "#FFD200" : colors.secondary} style={styles.drawerMenuIcon} />
                  <Text style={styles.drawerMenuLabel}>{isDark ? "Light Mode" : "Dark Mode"}</Text>
                  <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 16 }}>
                    <Ionicons name={isDark ? "toggle" : "toggle-outline"} size={32} color={isDark ? "#3B82F6" : "#9CA3AF"} />
                  </View>
                </TouchableOpacity>

                {/* Language Toggle Switch inside Sidebar */}
                <TouchableOpacity 
                  style={[styles.drawerMenuItem, { marginTop: 0 }]} 
                  onPress={() => setLanguage(language === 'en' ? 'so' : 'en')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="language-outline" size={22} color={colors.secondary} style={styles.drawerMenuIcon} />
                  <Text style={styles.drawerMenuLabel}>{language === 'en' ? "Somali (SO)" : "English (EN)"}</Text>
                  <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 16 }}>
                    <Ionicons name={language === 'so' ? "toggle" : "toggle-outline"} size={32} color={language === 'so' ? "#10B981" : "#9CA3AF"} />
                  </View>
                </TouchableOpacity>
              </ScrollView>

              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name={userData ? "log-out-outline" : "log-in-outline"} size={22} color={userData ? "#FF4757" : colors.primary} style={styles.drawerMenuIcon} />
                <Text style={[styles.logoutText, userData ? {} : { color: colors.primary }]}>{userData ? "Log Out" : "Log In"}</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      {/* Right Drawer for Notifications */}
      <Modal visible={notificationVisible} transparent={true} animationType="fade" onRequestClose={() => setNotificationVisible(false)}>
        <View style={styles.modalOverlayRight}>
          <TouchableOpacity style={styles.modalBackground} activeOpacity={1} onPress={() => setNotificationVisible(false)} />

          <View style={styles.rightDrawerContainer}>
            <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
              <View style={styles.rightDrawerHeader}>
                <Text style={styles.rightDrawerTitle}>Notifications</Text>
                <TouchableOpacity onPress={() => setNotificationVisible(false)} style={styles.closeIconBtn}>
                  <Ionicons name="close" size={24} color={colors.secondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.notificationList}>
                {notifications.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center', justifyContent: 'center', marginTop: 60 }}>
                    <Ionicons name="notifications-off-outline" size={48} color={colors.secondary} style={{ opacity: 0.4, marginBottom: 12 }} />
                    <Text style={{ color: colors.secondary, opacity: 0.7, fontSize: 14, textAlign: 'center', fontWeight: '500' }}>
                      Wax ogeysiis ah hadda kuuma jiraan.
                    </Text>
                  </View>
                ) : (
                  notifications.map((notif) => (
                    <TouchableOpacity key={notif.id} style={styles.notificationItem}>
                      <View style={styles.notifIconWrapper}>
                        <Ionicons name="notifications" size={18} color={colors.primary} />
                      </View>
                      <View style={styles.notifContent}>
                        <Text style={styles.notifTitle}>{notif.title}</Text>
                        <Text style={styles.notifMessage} numberOfLines={3}>{notif.message}</Text>
                        <Text style={styles.notifTime}>{notif.time}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      {/* Help / Social Bottom Sheet Modal (No Dark Background) */}
      <Modal visible={helpVisible} transparent={true} animationType="slide" onRequestClose={() => setHelpVisible(false)}>
        <View style={styles.bottomSheetOverlayNoBg}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setHelpVisible(false)} />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetTitle}>Nala Soo Xiriir (Help)</Text>

            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => {
                setHelpVisible(false);
                Linking.openURL('https://wa.me/252659119779').catch(() => {
                  Alert.alert('Cilad', 'Ma awoodno inaan furno WhatsApp');
                });
              }}
            >
              <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
              <Text style={styles.socialText}>WhatsApp Support</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.socialButton}
              onPress={() => {
                setHelpVisible(false);
                Linking.openURL('mailto:team.darkpen@gmail.com').catch(() => {
                  Alert.alert('Cilad', 'Ma awoodno inaan furno E-mail-ka');
                });
              }}
            >
              <Ionicons name="mail" size={24} color="#EA4335" />
              <Text style={styles.socialText}>Email Us</Text>
            </TouchableOpacity>

            <SafeAreaView edges={['bottom']} />
          </View>
        </View>
      </Modal>

      {/* Claim Reward Popup Modal */}
      <Modal
        visible={selectedPromo !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPromo(null)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.8)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24
        }}>
          <BlurView intensity={30} style={{
            width: '100%',
            maxWidth: 340,
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.95)',
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 10
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
                {language === 'so' ? 'Sheego Abaalmarinta' : 'Claim Reward'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedPromo(null)} style={{ padding: 4 }}>
                <Ionicons name="close-circle-outline" size={24} color={colors.text} style={{ opacity: 0.7 }} />
              </TouchableOpacity>
            </View>

            {selectedPromo && (
              <View>
                {/* Description & Prize Info */}
                <View style={{ 
                  backgroundColor: 'rgba(50, 215, 75, 0.08)', 
                  borderWidth: 1, 
                  borderColor: 'rgba(50, 215, 75, 0.2)', 
                  borderRadius: 12, 
                  padding: 12, 
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}>
                  <Ionicons name="gift" size={24} color="#10B981" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.text, opacity: 0.8 }}>
                      {language === 'so' ? 'Abaalmarinta la helayo:' : 'You will receive:'}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#10B981' }}>
                      +{selectedPromo.reward_credits} {selectedPromo.reward_type === 'standard' ? 'Standard Credits' : 'Shukaansi Credits'}
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 13, color: colors.text, opacity: 0.8, marginBottom: 16, lineHeight: 18 }}>
                  {language === 'so' 
                    ? 'Fadlan guji badhanka hoose si aad u tagto bogga, raac talaabada lagu weydiistay, ka dibna soo geli sawir screenshot ah si aan u xaqiijino!' 
                    : 'Please click the button below to go to the page, complete the task, then upload a screenshot to verify your claim!'}
                </Text>

                {/* Step 1: Link Button */}
                <TouchableOpacity 
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                    borderRadius: 12,
                    paddingVertical: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    marginBottom: 12
                  }}
                  onPress={() => {
                    if (selectedPromo.route.startsWith('http')) {
                      Linking.openURL(selectedPromo.route).catch(err => console.log('Link opening failed:', err));
                    } else {
                      router.push(selectedPromo.route as any);
                      setSelectedPromo(null);
                    }
                  }}
                >
                  <Ionicons name="logo-facebook" size={16} color={isDark ? '#FFF' : '#000'} style={{ marginRight: 6 }} />
                  <Text style={{ fontWeight: 'bold', color: colors.text, fontSize: 13 }}>
                    {language === 'so' ? 'TALLAABADA 1: Booqo Bogga' : 'STEP 1: Visit Social Page'}
                  </Text>
                  <Ionicons name="open-outline" size={12} color={colors.text} style={{ marginLeft: 6, opacity: 0.6 }} />
                </TouchableOpacity>

                {/* Step 2: Upload Button / Thumbnail preview */}
                <TouchableOpacity 
                  style={{
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: screenshotUri ? '#10B981' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
                    backgroundColor: screenshotUri ? 'rgba(16, 185, 129, 0.03)' : 'transparent',
                    borderRadius: 12,
                    paddingVertical: screenshotUri ? 12 : 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20
                  }}
                  onPress={handleSelectScreenshot}
                >
                  {screenshotUri ? (
                    <View style={{ alignItems: 'center' }}>
                      <Image source={{ uri: screenshotUri }} style={{ width: 80, height: 80, borderRadius: 8, marginBottom: 8 }} />
                      <Text style={{ fontSize: 12, color: '#10B981', fontWeight: 'bold' }}>
                        {language === 'so' ? 'Sawirka waa la doortay (Edit)' : 'Screenshot Selected (Tap to Edit)'}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Ionicons name="image-outline" size={24} color={colors.text} style={{ opacity: 0.6, marginBottom: 6 }} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                        {language === 'so' ? 'TALLAABADA 2: Soo Gali Screenshot' : 'STEP 2: Select Screenshot'}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.text, opacity: 0.5, marginTop: 4 }}>
                        PNG, JPG up to 10MB
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Step 3: Submit Button */}
                <TouchableOpacity 
                  style={{
                    backgroundColor: '#10B981',
                    borderRadius: 12,
                    paddingVertical: 14,
                    alignItems: 'center',
                    opacity: submittingClaim || !screenshotUri ? 0.7 : 1
                  }}
                  onPress={handleSubmitClaim}
                  disabled={submittingClaim || !screenshotUri}
                >
                  <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 14 }}>
                    {submittingClaim 
                      ? (language === 'so' ? 'Waa la dirayaa...' : 'Submitting...') 
                      : (language === 'so' ? 'Gudbi Dalabka' : 'Submit & Claim')}
                  </Text>
                </TouchableOpacity>

              </View>
            )}
          </BlurView>
        </View>
      </Modal>
    </SafeAreaView >
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: AzureTheme.spacing.l,
    paddingTop: AzureTheme.spacing.m,
    paddingBottom: AzureTheme.spacing.s,
  },
  menuButton: {
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border || '#333',
    backgroundColor: colors.card,
  },
  appName: {
    fontSize: 20,
    fontWeight: '500',
    color: isDark ? '#FFFFFF' : '#4686fcff',
    letterSpacing: 0,
  },
  brandTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconButton: {
    padding: 8,
    marginRight: 8,
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4757',
    borderWidth: 1,
    borderColor: 'white',
  },
  helpProfile: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: isDark ? '#25D366' : '#FFFFFF',
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
  },
  content: { padding: AzureTheme.spacing.l },
  greetingBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  greetingTitle: {
    fontSize: 20,
    textTransform: 'capitalize',
    fontWeight: '500',
    color: colors.primary,
    marginBottom: 1,
  },
  subtitle: {
    fontSize: 13,
    color: colors.neutral,
    marginBottom: AzureTheme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AzureTheme.spacing.m,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',

    color: colors.primary,
    marginTop: AzureTheme.spacing.m,
    marginBottom: AzureTheme.spacing.m,
  },
  seeAll: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  horizontalScroll: {
    marginLeft: -AzureTheme.spacing.l,
    paddingLeft: AzureTheme.spacing.l,
    marginBottom: AzureTheme.spacing.xl,
  },

  // Book Card with Image and Blur
  bookCardWrapper: {
    width: 150,
    height: 200,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  bookImage: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bookInfoContainer: {
    width: '100%',
    padding: 8,
  },
  bookBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bookIconSmall: {
    marginRight: 8,
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
    marginBottom: 2,
  },
  bookGrade: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },

  // ── Promo Cards ──
  promoCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    marginRight: CARD_SPACING,
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  promoCardAccent: {
    position: 'absolute',
    height: 120,
    borderRadius: 60,
    top: -30,
    right: -30,
    opacity: 0.4,
  },
  promoCardIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  promoCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  promoCardDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
    marginTop: 4,
  },
  promoCardBtn: {
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    marginTop: 'auto',
  },
  promoCardBtnText: {
    fontSize: 12,
    fontWeight: '700',

  },

  card: {
    backgroundColor: "yellow",
    borderRadius: 16,
    padding: AzureTheme.spacing.l,
    marginBottom: AzureTheme.spacing.m,
    borderWidth: 1,
    borderColor: colors.border || '#333',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  cardText: { fontSize: 13, color: colors.neutral },

  // Drawer Sidebar
  modalOverlay: { flex: 1, flexDirection: 'row' },
  modalBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerContainer: {
    width: width * 0.75,
    height: '100%',
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 10, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  drawerHeader: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
    marginBottom: 20,
  },
  drawerProfile: { flexDirection: 'row', alignItems: 'center' },
  drawerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  drawerName: { fontSize: 18, fontWeight: '700', color: colors.secondary },
  drawerEmail: { fontSize: 13, color: colors.neutral },
  drawerMenu: { flex: 1 },
  drawerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 4,
  },
  drawerMenuIcon: { marginRight: 16 },
  drawerMenuLabel: { fontSize: 16, fontWeight: '600', color: colors.secondary },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#FF4757' },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  walletBalance: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  aiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  aiCard: {
    width: (width - 48) / 3,
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  aiIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.secondary,
    textAlign: 'center',
  },
  aiCardDesc: {
    fontSize: 10,
    color: colors.neutral,
    textAlign: 'center',
  },

  drawerSection: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    paddingBottom: 8,
  },
  drawerSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.neutral,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
    paddingLeft: 4,
    opacity: 0.75,
  },
  newBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  newBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '900',
  },

  // Right Drawer Notifications
  modalOverlayRight: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  rightDrawerContainer: {
    width: width * 0.85,
    height: '100%',
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: -10, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  rightDrawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 10,
  },
  rightDrawerTitle: { fontSize: 22, fontWeight: '800', color: colors.secondary },
  closeIconBtn: {
    padding: 8, backgroundColor: colors.card, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border || '#333'
  },
  notificationList: { flex: 1 },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border || '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  notifIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 15, fontWeight: '700', color: colors.secondary, marginBottom: 4 },
  notifMessage: { fontSize: 13, color: colors.neutral, lineHeight: 18, marginBottom: 6 },
  notifTime: { fontSize: 11, color: colors.textLight, fontWeight: '500' },

  // Bottom Sheet
  bottomSheetOverlayNoBg: { flex: 1, justifyContent: 'flex-end' },
  bottomSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
    borderTopWidth: 1,
    borderColor: colors.border || '#333',
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.secondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border || '#333',
  },
  socialText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.secondary,
    marginLeft: 16,
  },
  homeEmptyState: {
    backgroundColor: isDark ? '#161B22' : '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: isDark ? '#21262D' : '#E2E8F0',
    padding: 18,
    marginHorizontal: 16,
    marginVertical: 4,
    width: width - 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeEmptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.secondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  homeEmptyStateMessage: {
    fontSize: 12,
    color: colors.textLight,
    lineHeight: 18,
    textAlign: 'center',
  }
});
