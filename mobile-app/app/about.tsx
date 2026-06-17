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
          <Text style={styles.appName}>Darkpen </Text>
          <Text style={styles.versionText}>Version 1.0.1 </Text>
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

          {/* FEATURES CARD */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="apps-outline" size={24} color={colors.primary} />
              <Text style={styles.cardTitle}>Maxay tahay Darkpen?</Text>
            </View>
            <Text style={styles.cardText}>
              Darkpen waa madal waxbarasho oo dhammaystiran oo loogu talagalay in lagu caawiyo ardayda heerar kasta. App-ku wuxuu bixiyaa adeegyo ay ka mid yihiin:
            </Text>
            <View style={{ marginTop: 12 }}>
              <View style={styles.featureItem}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} style={styles.featureIcon} />
                <Text style={styles.featureText}>
                  <Text style={styles.featureBold}>Kaaliyaha AI:</Text> Su'aalo weydii AI si uu kaaga caawiyo casharradaada iyo laylisyadaada.
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="create-outline" size={20} color={colors.primary} style={styles.featureIcon} />
                <Text style={styles.featureText}>
                  <Text style={styles.featureBold}>Dhaliyaha Imtixaanka:</Text> Sameyso imtixaano muraajaco ah si aad u tijaabiso heerkaaga aqooneed.
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="people-outline" size={20} color={colors.primary} style={styles.featureIcon} />
                <Text style={styles.featureText}>
                  <Text style={styles.featureBold}>Wada-sheekeysiga Kooxaha:</Text> Ku biir kooxaha waxbarashada si aad ula wadaagto casharrada ardayda kale.
                </Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="book-outline" size={20} color={colors.primary} style={styles.featureIcon} />
                <Text style={styles.featureText}>
                  <Text style={styles.featureBold}>Maktabad Buugaag:</Text> Akhriso oo kala soo bax buugaagta manhajka iyo kuwa kale ee waxtarka leh.
                </Text>
              </View>
            </View>
          </View>

          {/* FOUNDER CARD */}
          <View style={[styles.card, styles.founderCard]}>
            <View style={styles.founderHeader}>
              <Image 
                source={require('../assets/images/zinson.jpg')} 
                style={styles.founderImage} 
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.founderName}>Hamze Mohamuud Ali (Zinson)</Text>
                <View style={styles.titleRow}>
                  <View style={[styles.roleBadge, { backgroundColor: 'rgba(10,132,255,0.12)' }]}>
                    <Ionicons name="star" size={11} color="#0A84FF" style={{ marginRight: 4 }} />
                    <Text style={[styles.roleBadgeText, { color: '#0A84FF' }]}>Founder & CEO</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.cardText}>
              Maskaxda ka dambaysa mashruucan iyo aasaasaha app-ka. "Ujeedkaygu waa inaan isbedel weyn ku sameeyo qaabka ay ardayda wax u bartaan, anigoo u fududaynaya muraajacada iyo helitaanka xog rasmi ah oo la isku halayn karo."
            </Text>
            <View style={styles.divider} />
            <TouchableOpacity 
              style={styles.contactBtn} 
              onPress={() => openLink('https://wa.me/252637930329')} 
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.contactBtnText}>La Xiriir CEO (WhatsApp)</Text>
            </TouchableOpacity>
          </View>

          {/* TEAM SECTION */}
          <Text style={styles.sectionHeader}>KOOXDEENNA — OUR TEAM</Text>

          {/* Fadxi - Payments Manager */}
          <View style={[styles.card, styles.teamMemberCard]}>
            <View style={styles.teamMemberInner}>
              <View style={styles.teamImageWrapper}>
                <Image 
                  source={require('../assets/images/fadxi.jpg')} 
                  style={styles.teamMemberImage} 
                />
                <View style={[styles.teamOnlineDot, { backgroundColor: '#10B981' }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.teamMemberName}>Fadxi Ciise Maxamed</Text>
                <View style={styles.titleRow}>
                  <View style={[styles.roleBadge, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                    <Ionicons name="card" size={11} color="#10B981" style={{ marginRight: 4 }} />
                    <Text style={[styles.roleBadgeText, { color: '#10B981' }]}>Payments Manager</Text>
                  </View>
                </View>
                <Text style={styles.teamMemberBio}>Maareeyaha lacag bixinta iyo xisaabaadka dhaqaale ee Darkpen.</Text>
              </View>
            </View>
          </View>

          {/* Shaafici - Marketing Manager */}
          <View style={[styles.card, styles.teamMemberCard]}>
            <View style={styles.teamMemberInner}>
              <View style={styles.teamImageWrapper}>
                <Image 
                  source={require('../assets/images/shaafici.jpg')} 
                  style={styles.teamMemberImage} 
                />
                <View style={[styles.teamOnlineDot, { backgroundColor: '#F59E0B' }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.teamMemberName}>Shaafici Cabdiraxmaan{' '}
                  <Text style={{ fontSize: 13, color: '#F59E0B' }}>✦ Iconic</Text>
                </Text>
                <View style={styles.titleRow}>
                  <View style={[styles.roleBadge, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                    <Ionicons name="megaphone" size={11} color="#F59E0B" style={{ marginRight: 4 }} />
                    <Text style={[styles.roleBadgeText, { color: '#F59E0B' }]}>Marketing Manager</Text>
                  </View>
                </View>
                <Text style={styles.teamMemberBio}>Qofka mas'uulka ka ah xaaladaha suuq-geynta iyo ballaarinta Darkpen.</Text>
              </View>
            </View>
          </View>

          {/* QUICK LINKS */}
          <Text style={styles.sectionHeader}>XEERAR, SHARCIYO & SOCIAL MEDIA</Text>
          
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

          {/* Facebook */}
          <TouchableOpacity style={styles.linkRow} onPress={() => openLink('https://www.facebook.com/share/1YXK1Nffvh/')} activeOpacity={0.7}>
            <View style={[styles.iconWrap, { backgroundColor: '#E7F3FF' }]}>
              <Ionicons name="logo-facebook" size={20} color="#1877F2" />
            </View>
            <Text style={styles.linkText}>Facebook</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          {/* Instagram */}
          <TouchableOpacity style={styles.linkRow} onPress={() => openLink('https://www.instagram.com/darkpenapp?igsh=Znh5MnUwb2p5cmdj')} activeOpacity={0.7}>
            <View style={[styles.iconWrap, { backgroundColor: '#FDF2F8' }]}>
              <Ionicons name="logo-instagram" size={20} color="#E1306C" />
            </View>
            <Text style={styles.linkText}>Instagram</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          {/* TikTok */}
          <TouchableOpacity style={styles.linkRow} onPress={() => openLink('https://www.tiktok.com/@darkpenapp?_r=1&_t=ZS-96s28GW9i6s')} activeOpacity={0.7}>
            <View style={[styles.iconWrap, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
              <Ionicons name="logo-tiktok" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
            </View>
            <Text style={styles.linkText}>TikTok</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          {/* Telegram */}
          <TouchableOpacity style={styles.linkRow} onPress={() => openLink('https://t.me/darkpenapp')} activeOpacity={0.7}>
            <View style={[styles.iconWrap, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="paper-plane" size={20} color="#229ED9" />
            </View>
            <Text style={styles.linkText}>Telegram</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          {/* X */}
          <TouchableOpacity style={styles.linkRow} onPress={() => openLink('https://x.com/Darkpenapp')} activeOpacity={0.7}>
            <View style={[styles.iconWrap, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
              <Ionicons name="logo-twitter" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
            </View>
            <Text style={styles.linkText}>X (Twitter)</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          {/* WhatsApp */}
          <TouchableOpacity style={styles.linkRow} onPress={() => openLink('https://wa.me/252659119779')} activeOpacity={0.7}>
            <View style={[styles.iconWrap, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            </View>
            <Text style={styles.linkText}>WhatsApp</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Ionicons name="heart" size={24} color="#EF4444" style={{ marginBottom: 10 }} />
            <Text style={styles.footerText}>Crafted with passion for education.</Text>
            <Text style={styles.footerSubText}>© 2026 Darkpen Inc. All rights reserved. </Text>
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
    color: colors.text,
    marginLeft: 10,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 26,
    color: colors.textLight,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  teamMemberCard: {
    borderWidth: 1,
    borderColor: 'rgba(100,100,100,0.08)',
  },
  teamMemberInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  teamImageWrapper: {
    position: 'relative',
    marginRight: 16,
  },
  teamMemberImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2.5,
    borderColor: colors.primary,
  },
  teamOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.card,
  },
  teamMemberName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    flexShrink: 1,
  },
  teamMemberBio: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 6,
    lineHeight: 19,
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
    color: colors.text,
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
  },
  founderImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 12,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  contactBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  featureIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: colors.textLight,
    lineHeight: 20,
  },
  featureBold: {
    fontWeight: '700',
    color: colors.text,
  }
});
