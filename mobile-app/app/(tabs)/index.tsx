import { AzureTheme } from '../../constants/AzureTheme';
import { useTheme } from '../../context/ThemeContext';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Modal, Dimensions, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Image } from 'react-native';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import Config from '../../constants/Config';
import { blue } from 'react-native-reanimated/lib/typescript/Colors';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [userData, setUserData] = useState<any>(null);

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
    }, [])
  );

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

  const menuItems = [
    { id: 'profile', icon: 'person-outline', label: 'Profile', route: '/profile' },
    { id: 'settings', icon: 'settings-outline', label: 'Settings', route: '/settings' },
    { id: 'terms', icon: 'document-text-outline', label: 'Terms & Conditions', route: '/terms-content' },
    { id: 'privacy', icon: 'shield-checkmark-outline', label: 'Privacy Policy', route: '/privacy' },
    { id: 'about', icon: 'information-circle-outline', label: 'About Darkpen', route: '/about' },
  ];

  const notifications = [
    { id: '1', title: 'Natiijadii Imtixaanka', message: 'Fadlan eeg natiijadaadii ugu dambeysay ee xisaabta.', time: '10 min ago' },
    { id: '2', title: 'Cashar Cusub', message: 'Cutubka 4-aad ee Sayniska ayaa lasoo geliyay.', time: '2 hours ago' },
    { id: '3', title: 'Soo dhawaaw', message: 'Ku soo dhawaaw appka Darkpen, waxaan kuu rajaynaynaa waxbarasho wacan.', time: '1 day ago' },
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

        <Text style={styles.appName}>Darkpen</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setNotificationVisible(true)}>
            <Ionicons name="notifications-outline" size={24} color={colors.secondary} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.helpProfile} onPress={() => setHelpVisible(true)}>
            <Ionicons name="headset-outline" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greetingTitle}>Kuso dhawaaw Darkpen </Text>
        <Text style={styles.subtitle}>waa madal ka caawinaysa ardayda qaybaha kala duwan ee waxbarshada</Text>

        {/* promo cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScroll}
          contentContainerStyle={{ paddingRight: 16 }}
        >
          {/* Card 1 */}
          <ImageBackground
            source={require('../../assets/card/ai assentance.jpg')}
            style={styles.promoCard}
            imageStyle={{ borderRadius: 20 }}
            resizeMode="cover"
          >
            <View style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />



            <TouchableOpacity style={styles.promoCardBtn} onPress={() => router.push('/manhajka' as any)} activeOpacity={0.85}>
              <Text style={[styles.promoCardBtnText, { color: '#3B82F6' }]}>Get Started</Text>
            </TouchableOpacity>
          </ImageBackground>

          {/* Card 2 */}
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?q=80&w=400&auto=format&fit=crop' }}
            style={styles.promoCard}
            imageStyle={{ borderRadius: 20 }}
            resizeMode="cover"
          >
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(139,92,246,0.55)', borderRadius: 20 }]} />
            <Text style={styles.promoCardIcon}>✏️</Text>
            <Text style={styles.promoCardTitle}>Imtixaanada</Text>
            <Text style={styles.promoCardDesc}>Tababar nafta oo ku diyaargarow imtixaanka</Text>
            <TouchableOpacity style={styles.promoCardBtn} onPress={() => router.push('/exams' as any)} activeOpacity={0.85}>
              <Text style={[styles.promoCardBtnText, { color: '#8B5CF6' }]}>Bilow Imtixaan</Text>
            </TouchableOpacity>
          </ImageBackground>


          {/* Card 3 - with image background from internet */}
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?q=80&w=400&auto=format&fit=crop' }}
            style={styles.promoCard}
            imageStyle={{ borderRadius: 20 }}
            resizeMode="cover"
          >
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20 }]} />
            <Text style={styles.promoCardIcon}>🤖</Text>
            <Text style={styles.promoCardTitle}>Caawimaada AI</Text>
            <Text style={styles.promoCardDesc}>Weydii su'aashaada hel jawaab degdeg ah</Text>
            <TouchableOpacity style={styles.promoCardBtn} onPress={() => router.push('/(tabs)/chat' as any)} activeOpacity={0.85}>
              <Text style={[styles.promoCardBtnText, { color: '#10B981' }]}>Hada Bilow</Text>
            </TouchableOpacity>
          </ImageBackground>
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
                        pdfUrl: `${Config.API_URL}${book.pdf_url}`,
                        title: book.title
                      }
                    });
                  } else {
                    alert('Buuggan malaha PDF');
                  }
                }}
              >
                <ImageBackground
                  source={{ uri: book.image_url ? `${Config.API_URL}${book.image_url}` : 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=200&auto=format&fit=crop' }}
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
            <View style={{ padding: 20 }}><Text>Wax buug ah lama helin.</Text></View>
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
                        pdfUrl: `${Config.API_URL}${exam.pdf_url}`,
                        title: exam.title
                      }
                    });
                  } else {
                    alert('Imtixaankan malaha PDF');
                  }
                }}
              >
                <ImageBackground
                  source={{ uri: exam.image_url ? `${Config.API_URL}${exam.image_url}` : 'https://images.unsplash.com/photo-1546410531-df4cb71576bd?w=200&auto=format&fit=crop' }}
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
            <View style={{ padding: 20 }}><Text>Wax imtixaan ah lama helin.</Text></View>
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
                      <Image source={{ uri: userData.profile_picture }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                    ) : (
                      <Ionicons name="person" size={30} color="white" />
                    )}
                  </View>
                  <View>
                    <Text style={styles.drawerName}>{userData?.username ? `@${userData.username}` : (userData?.name || 'Darkpen Guest')}</Text>
                    <Text style={styles.drawerEmail}>{userData ? userData.email : 'Welcome to Darkpen'}</Text>
                    {userData && (
                      <View style={styles.walletBadge}>
                        <Ionicons name="wallet" size={14} color="white" />
                        <Text style={styles.walletBalance}>{userData.balance || 0} Credits</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <ScrollView style={styles.drawerMenu}>
                {menuItems.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.drawerMenuItem} onPress={() => handleMenuPress(item.route)}>
                    <Ionicons name={item.icon as any} size={22} color={colors.secondary} style={styles.drawerMenuIcon} />
                    <Text style={styles.drawerMenuLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
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
                {notifications.map((notif) => (
                  <TouchableOpacity key={notif.id} style={styles.notificationItem}>
                    <View style={styles.notifIconWrapper}>
                      <Ionicons name="notifications" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.notifContent}>
                      <Text style={styles.notifTitle}>{notif.title}</Text>
                      <Text style={styles.notifMessage} numberOfLines={2}>{notif.message}</Text>
                      <Text style={styles.notifTime}>{notif.time}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
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

            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
              <Text style={styles.socialText}>WhatsApp Support</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="mail" size={24} color="#EA4335" />
              <Text style={styles.socialText}>Email Us</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.socialButton}>
              <Ionicons name="logo-facebook" size={24} color="#1877F2" />
              <Text style={styles.socialText}>Facebook Page</Text>
            </TouchableOpacity>

            <SafeAreaView edges={['bottom']} />
          </View>
        </View>
      </Modal>
    </SafeAreaView >
  );
}

const getStyles = (colors: any) => StyleSheet.create({
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
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { padding: AzureTheme.spacing.l },
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    width: 400,
    height: 200,
    borderRadius: 20,
    marginRight: 16,
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
    flex: 1,
  },
  promoCardBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 30,
    fontWeight: 'bold',
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    marginTop: 120,
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
  }
});
