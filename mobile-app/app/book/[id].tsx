import { AzureTheme } from '../../constants/AzureTheme';
import { useTheme } from '../../context/ThemeContext';
import React, { useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Dimensions, Animated, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');
const HEADER_MAX_HEIGHT = 350;
const HEADER_MIN_HEIGHT = Platform.OS === 'ios' ? 100 : 80;
const SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

const mockBooks: Record<string, any> = {
  '1': { title: 'Xisaab', grade: 'Form 4', chapters: 12, pages: 245, size: '12 MB', year: '2016', image: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=400&auto=format&fit=crop', desc: 'Buuggan Xisaabta ee fasalka 4-aad wuxuu ka kooban yahay cutubyo la xiriira Aljebra, Joometeri, iyo Xisaabta Tirsiimo. Waa buug si gaar ah loogu talagalay manhajka qaranka Somaliland . ' },
  '2': { title: 'Saynis', grade: 'Form 4', chapters: 10, pages: 180, size: '15 MB', year: '2016', image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=400&auto=format&fit=crop', desc: 'Buuggan Sayniska waxa uu xooga  saarayaa Kimistariga Buuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa KimistarigaBuuggan Sayniska waxa uu xooga  saarayaa Kimistariga, Fiisigiska, iyo Bayoolajiga aasaasiga ah.' },
  'default': { title: 'Buugga Manhajka', grade: 'Form 4', chapters: 8, pages: 150, size: '10 MB', year: '2016', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=400&auto=format&fit=crop', desc: 'Buug ka mid ah buugaagta manhajka dugsiyada sare ee Somaliland.' }
};

export default function BookDetailScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const book = mockBooks[id as string] || mockBooks['default'];

  // Image fade out interpolation
  const imageOpacity = scrollY.interpolate({
    inputRange: [0, SCROLL_DISTANCE / 2, SCROLL_DISTANCE],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  // Small Header fade in interpolation
  const headerOpacity = scrollY.interpolate({
    inputRange: [SCROLL_DISTANCE * 0.7, SCROLL_DISTANCE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>

      {/* Absolute Compact Header that fades in */}
      <Animated.View style={[styles.compactHeader, { opacity: headerOpacity, paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.compactIconButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.secondary} />
        </TouchableOpacity>

        <Text style={styles.compactTitle} numberOfLines={1}>{book.title}</Text>

        <View style={styles.compactActions}>
          <TouchableOpacity style={styles.compactIconButton}>
            <Ionicons name="cloud-download-outline" size={24} color={colors.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.compactIconButton}>
            <Ionicons name="bookmark-outline" size={24} color={colors.secondary} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >

        {/* Large Fading Header & Image */}
        <Animated.View style={[styles.imageContainer, { opacity: imageOpacity }]}>
          <SafeAreaView style={styles.floatingHeaderActions} edges={['top']}>
            <TouchableOpacity style={styles.floatingButton} onPress={() => router.back()}>
              <Feather name="arrow-left" size={20} color={colors.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.floatingButton}>
              <Feather name="bookmark" size={20} color={colors.secondary} />
            </TouchableOpacity>
          </SafeAreaView>
          <Image source={{ uri: book.image }} style={styles.coverImage} />
          <View style={styles.imageGradient} />
        </Animated.View>

        {/* Book Details */}
        <View style={styles.detailsContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.bookTitle}>{book.title}</Text>
            <View style={styles.gradeBadge}>
              <Text style={styles.gradeText}>{book.grade}</Text>
            </View>
          </View>

          <Text style={styles.authorText}>Wasaaradda Waxbarashada, Somaliland</Text>

          {/* New Blurred Stats Row (4 items) */}
          <View style={styles.statsWrapper}>
            <BlurView intensity={60} tint="light" style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="document-text-outline" size={22} color={colors.primary} />
                <Text style={styles.statLabel}>Boggag</Text>
                <Text style={styles.statValue}>{book.pages}</Text>
              </View>
              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Ionicons name="layers-outline" size={22} color={colors.primary} />
                <Text style={styles.statLabel}>Cutubyo</Text>
                <Text style={styles.statValue}>{book.chapters}</Text>
              </View>
              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Ionicons name="save-outline" size={22} color={colors.primary} />
                <Text style={styles.statLabel}>Cabbirka</Text>
                <Text style={styles.statValue}>{book.size}</Text>
              </View>
              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Ionicons name="calendar-outline" size={22} color={colors.primary} />
                <Text style={styles.statLabel}>Sanadka</Text>
                <Text style={styles.statValue}>{book.year}</Text>
              </View>
            </BlurView>
          </View>

          {/* Description */}
          <Text style={styles.sectionTitle}>Faahfaahin</Text>
          <Text style={styles.descriptionText}>{book.desc}</Text>

          {/* Restriction Notice */}
          <View style={styles.noticeBox}>
            <Ionicons name="lock-closed" size={24} color="#F59E0B" style={styles.noticeIcon} />
            <Text style={styles.noticeText}>
              Wali buugan dadka looma ogolaan in ay si toos ah app-ka uga akhristaan.
            </Text>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Floating Action Bar */}
      <BlurView intensity={90} tint="light" style={styles.bottomBar}>
        <TouchableOpacity style={styles.downloadButton} activeOpacity={0.8}>
          <Ionicons name="cloud-download-outline" size={22} color="white" />
          <Text style={styles.downloadButtonText}>Download (PDF)</Text>
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },

  // Compact Header that appears on scroll
  compactHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_MIN_HEIGHT,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AzureTheme.spacing.l,
    paddingBottom: 10,
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  compactTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.secondary,
    flex: 1,
    textAlign: 'center',
  },
  compactActions: {
    flexDirection: 'row',
  },
  compactIconButton: {
    padding: 8,
    marginLeft: 4,
  },

  scrollContent: {
    paddingBottom: 120, // Space for bottom bar
  },

  // Large Image Header
  imageContainer: {
    width: width,
    height: HEADER_MAX_HEIGHT,
    backgroundColor: colors.background,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  floatingHeaderActions: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: AzureTheme.spacing.xl,
    paddingTop: AzureTheme.spacing.m,
    zIndex: 10,
  },
  floatingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },

  // Details
  detailsContainer: {
    padding: AzureTheme.spacing.xl,
    paddingTop: AzureTheme.spacing.l,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bookTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.secondary,
    flex: 1,
    marginRight: 16,
  },
  gradeBadge: {
    backgroundColor: '#E7F5FF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  gradeText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  authorText: {
    fontSize: 14,
    color: colors.neutral,
    marginBottom: AzureTheme.spacing.xl,
    fontWeight: '600',
  },

  // Stats Row (Blurred)
  statsWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: AzureTheme.spacing.xxl ,
    borderWidth: 1,
    borderColor: colors.background,
    backgroundColor: '#FAFAFA', // Fallback
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingVertical: 20,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: colors.neutral,
    marginTop: 8,
    marginBottom: 2,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 14,
    color: colors.secondary,
    fontWeight: '800',
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#E5E7EB',
  },

  // Description
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 26,
    color: '#4B5563',
    marginBottom: AzureTheme.spacing.xxl,
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 16 ,
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
  },
  noticeIcon: {
    marginRight: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: '#B45309',
    fontWeight: '600',
  },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: AzureTheme.spacing.xl,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
  },
  downloadButton: {
    backgroundColor: colors.card,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: AzureTheme.borderRadius.pill,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: colors.border || '#333',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  downloadButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
  }
});
