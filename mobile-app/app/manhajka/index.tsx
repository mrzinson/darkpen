import { AzureTheme } from '../../constants/AzureTheme';
import { useTheme } from '../../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ImageBackground, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../../constants/Config';

const { width } = Dimensions.get('window');
const cardWidth = (width - AzureTheme.spacing.xl * 2 - 16) / 2; // 2 columns

const CATEGORIES = [
  'All', 'Biology', 'History', 'Physics', 'Chemistry', 'Geography',
  'Mathematics', 'Maths', 'Science', 'Social', 'English', 'English (sec)',
  'Somali', 'Suugaan', 'Arabic', 'Arabic (sec)', 'Islamic', 'Islamic (sec)', 'General'
];

export default function ManhajkaScreen() {
  const { colors, isDark, setTheme, theme, t } = useTheme();
  const styles = getStyles(colors, isDark);

  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('All');
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);

  // Load user data for empty state message
  React.useEffect(() => {
    AsyncStorage.getItem('userData').then(raw => {
      if (raw) setUserData(JSON.parse(raw));
    });
  }, []);

  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load from cache first
      const cached = await AsyncStorage.getItem('manhajka_books');
      if (cached) {
        setBooks(JSON.parse(cached));
        setLoading(false); // Stop loading if we have cached data
      }

      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/user/books`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        if (Array.isArray(data)) {
          setBooks(data);
          // 2. Save to cache
          await AsyncStorage.setItem('manhajka_books', JSON.stringify(data));
        } else {
          setError('API didn\'t return an array');
        }
      } else {
        // If API fails but we have cache, don't show error
        if (!cached) setError(data.message || 'Server error');
      }
    } catch (err: any) {
      // If Network fails but we have cache, don't show error
      const cached = await AsyncStorage.getItem('manhajka_books');
      if (!cached) setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchBooks();
    }, [])
  );
  const filteredBooks = Array.isArray(books) ? books.filter(book => {
    const matchesCategory = activeCategory === 'All' || (book.category && book.category === activeCategory);
    return matchesCategory;
  }) : [];
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={isDark ? '#FFFFFF' : '#3B82F6'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>BOOKS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>{t('all_books')}</Text>
        <Text style={styles.pageSubtitle}>{t('select_book')}</Text>

        {/* Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterPill, activeCategory === cat && styles.filterPillActive]}
              onPress={() => setActiveCategory(cat)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, activeCategory === cat && styles.filterTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.grid}>
          {loading ? (
            <Text style={{ textAlign: 'center', width: '100%', marginTop: 20 }}>loading...</Text>
          ) : filteredBooks.length > 0 ? (
            filteredBooks.map(book => (
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
                        title: book.title,
                        type: 'book' // Explicitly pass 'book' type
                      }
                    });
                  } else {
                    alert(t('no_pdf_alert'));
                  }
                }}
              >
                <ImageBackground
                  source={{ uri: book.image_url ? `${Config.API_URL}${book.image_url}` : 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?q=80&w=300&auto=format&fit=crop' }}
                  style={styles.bookImage}
                  imageStyle={{ borderRadius: 16 }}
                >
                  <View style={styles.bookInfoContainer}>
                    <BlurView intensity={70} tint="dark" style={styles.bookBlur}>
                      <Ionicons name="book" size={20} color="white" style={styles.bookIconSmall} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bookTitle} numberOfLines={1}>{book.title}</Text>
                        <Text style={styles.bookGrade}>{book.grade || 'Form 4'}</Text>
                      </View>
                    </BlurView>
                  </View>
                </ImageBackground>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyStateCard}>
              <Ionicons name="time-outline" size={48} color="#3B82F6" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyStateTitle}>
                {userData?.country === 'Somalia' && userData?.region_state
                  ? `${userData.region_state}`
                  : userData?.country || 'Gobolkaaga'}
              </Text>
              <Text style={styles.emptyStateMessage}>
                Buugaagta aad u baahan tahay wali kuma jiraan nidaamka. Dhawr casho ka bacdi ayaa lasoo dari doonaa — raac oo dib u soo eeg!
              </Text>
              <View style={styles.emptyStateBadge}>
                <Ionicons name="notifications-outline" size={14} color="#3B82F6" />
                <Text style={styles.emptyStateBadgeText}>Dhawaan ayay soo geli doonaan</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: AzureTheme.spacing.xl,
    paddingTop: AzureTheme.spacing.m,
    paddingBottom: AzureTheme.spacing.m,
  },
  backButton: {
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: isDark ? '#FFFFFF' : '#3B82F6',
  },
  content: {
    padding: AzureTheme.spacing.xl,
    paddingTop: 0,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: isDark ? '#FFFFFF' : '#3B82F6',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.neutral,
    marginBottom: AzureTheme.spacing.xxl,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bookCardWrapper: {
    width: cardWidth,
    height: 220,
    marginBottom: 16,
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
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },

  // Filter Styles
  filterScroll: {
    paddingBottom: 20,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: isDark ? '#1E293B' : '#ffff',
    borderWidth: 1,
    borderColor: isDark ? '#333' : '#3882f6',
  },
  filterPillActive: {
    backgroundColor: isDark ? '#FFFFFF' : '#3B82F6',
    borderColor: isDark ? '#FFFFFF' : '#3B82F6',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: isDark ? '#94A3B8' : '#2563EB',
  },
  filterTextActive: {
    color: isDark ? '#1E293B' : '#FFFFFF',
  },
  emptyStateCard: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
    marginTop: 8,
    width: '100%',
    backgroundColor: isDark ? '#161B22' : '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: isDark ? '#21262D' : '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: 14,
    color: colors.textLight,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyStateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(59,130,246,0.25)' : '#BFDBFE',
  },
  emptyStateBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
});
