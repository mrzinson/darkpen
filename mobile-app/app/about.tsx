import { useTheme } from '../context/ThemeContext';
import React, { useRef, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Animated, Linking, Dimensions, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { AppLogo } from '../components/AppLogo';

const { width } = Dimensions.get('window');

export default function AboutScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  return (
    <View style={styles.container}>
      {/* Background Decor */}
      <View style={styles.bgBlobTop} />
      <View style={styles.bgBlobBottom} />

      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <BlurView intensity={60} tint="light" style={styles.blurIconBox}>
            <Ionicons name="chevron-back" size={24} color={colors.secondary} />
          </BlurView>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* HERO SECTION */}
        <Animated.View style={[styles.heroSection, { opacity: fadeAnim, transform: [{ scale: logoScale }] }]}>
          <View style={styles.logoContainer}>
            <AppLogo size={86} />
          </View>
          <Text style={styles.appName}>Darkpen (Kuuk)</Text>
          <Text style={styles.versionText}>Version 1.0.0 (BETA)</Text>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          
          {/* MISSION CARD */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="rocket-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Our Mission</Text>
            </View>
            <Text style={styles.cardText}>
              Ujeedada ugu weyn ee Darkpen waa in la helo madal casri ah oo u taagan "Muraajaco" ama xusuusinta ardayda si ay waxbarashadooda u horumariyaan. Waxaan isku xirnaa waxbarasho tayeysan iyo madadaalo maskaxda dejisa.
            </Text>
          </View>

          {/* FOUNDER CARD */}
          <View style={[styles.card, styles.founderCard]}>
            <View style={styles.founderHeader}>
              <View style={styles.founderAvatar}>
                <Ionicons name="person" size={32} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.founderName}>Hamze Mohamuud Ali</Text>
                <Text style={styles.founderTitle}>(Zinson) - Founder & CEO</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.cardText}>
              Maskaxda ka dambaysa mashruucan iyo aasaasaha app-ka. Ujeedkaygu waa inaan isbedel weyn ku sameeyo qaabka ay ardayda Soomaaliyeed wax u bartaan, anigoo u fududaynaya muraajacada iyo helitaanka xog rasmi ah oo la isku halayn karo.
            </Text>
          </View>

          {/* QUICK LINKS */}
          <Text style={styles.sectionHeader}>XIRIIR & SHARCIYO</Text>
          
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/terms')} activeOpacity={0.7}>
            <View style={[styles.iconWrap, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="document-text" size={20} color={colors.primary} />
            </View>
            <Text style={styles.linkText}>Terms & Conditions</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => openLink('https://darkpen-privacy-policy.onrender.com/')} activeOpacity={0.7}>
            <View style={[styles.iconWrap, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#10B981" />
            </View>
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => openLink('https://twitter.com')} activeOpacity={0.7}>
            <View style={[styles.iconWrap, { backgroundColor: '#F3E8FF' }]}>
              <Ionicons name="logo-twitter" size={20} color="#A855F7" />
            </View>
            <Text style={styles.linkText}>Follow us on Twitter</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Ionicons name="heart" size={24} color="#EF4444" style={{ marginBottom: 10 }} />
            <Text style={styles.footerText}>Crafted with passion for education.</Text>
            <Text style={styles.footerSubText}>© 2026 Darkpen Inc. All rights reserved.</Text>
          </View>

        </Animated.View>
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bgBlobTop: {
    position: 'absolute',
    top: -100,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(10, 132, 255, 0.05)',
  },
  bgBlobBottom: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(168, 85, 247, 0.05)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
  },
  blurIconBox: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.7)' ,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.secondary,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  versionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 10,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 26,
    color: '#475569',
  },
  founderCard: {
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.1)',
  },
  founderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  founderAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  founderName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  founderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.5,
    marginTop: 10,
    marginBottom: 16,
    marginLeft: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  linkText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  footer: {
    alignItems: 'center',
    marginTop: 30,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
  },
  footerSubText: {
    fontSize: 12,
    color: '#CBD5E1',
  }
});
