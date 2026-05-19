import { useTheme } from '../../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Platform, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../../constants/Config';

// Mock Data
// Categories
// Categories
const CATEGORIES = [
  'All', 'Biology', 'History', 'Physics', 'Chemistry', 'Geography',
  'Mathematics', 'Maths', 'Science', 'Social', 'English', 'English (sec)',
  'Somali', 'Suugaan', 'Arabic', 'Arabic (sec)', 'Islamic', 'Islamic (sec)', 'General'
];

import { useFocusEffect, useRouter } from 'expo-router';

export default function ExamsScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors, isDark);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeYear, setActiveYear] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExams = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Try to load from cache first
      const cached = await AsyncStorage.getItem('exams_list');
      if (cached) {
        setExams(JSON.parse(cached));
        setLoading(false); // Stop loading if we have cached data
      }

      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/user/exams`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (response.ok) {
        if (Array.isArray(data)) {
          setExams(data);
          // 2. Save to cache
          await AsyncStorage.setItem('exams_list', JSON.stringify(data));
        } else {
          setError('API didn\'t return an array');
        }
      } else {
        // If API fails but we have cache, don't show error
        if (!cached) setError(data.message || 'Server error');
      }
    } catch (err: any) {
      // If Network fails but we have cache, don't show error
      const cached = await AsyncStorage.getItem('exams_list');
      if (!cached) setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchExams();
    }, [])
  );

  const filteredExams = Array.isArray(exams) ? exams.filter(exam => {
    const matchesCategory = activeCategory === 'All' || (exam.category && exam.category === activeCategory);
    const matchesYear = activeYear === 'All' || (exam.year && exam.year === activeYear);
    const examTitle = exam.title || '';
    const matchesSearch = examTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesYear && matchesSearch;
  }) : [];

  // Get available years for the current category
  const availableYears = React.useMemo(() => {
    const years = new Set<string>();
    years.add('All');
    exams.forEach(exam => {
      if (activeCategory === 'All' || exam.category === activeCategory) {
        if (exam.year) years.add(exam.year);
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a)); // Newest years first
  }, [exams, activeCategory]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER SECTION (Original Design) */}
        <View style={[styles.headerSection, { paddingTop: Math.max(insets.top, 20) }]}>
          <View style={styles.headerTitles}>
            <Text style={styles.mainTitle}>EXAM'S</Text>
            <Text style={styles.subTitle}>Access your past papers and answer keys.</Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color={colors.primary} />
            <TextInput
              style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              placeholder="Search for an exam..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* FILTER TABS (Categories) */}
        <View style={styles.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.filterPill, activeCategory === cat && styles.filterPillActive]}
                onPress={() => {
                  setActiveCategory(cat);
                  setActiveYear('All'); // Reset year when category changes
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, activeCategory === cat && styles.filterTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* YEAR FILTER (Dynamic) */}
        {availableYears.length > 1 && (
          <View style={styles.yearFilterWrapper}>
            <Text style={styles.yearLabel}>year's</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearScroll}>
              {availableYears.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[styles.yearPill, activeYear === year && styles.yearPillActive]}
                  onPress={() => setActiveYear(year)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.yearText, activeYear === year && styles.yearTextActive]}>
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* EXAM LIST (Custom Card Layout) */}
        <View style={styles.examsGrid}>
          {loading ? (
            <Text style={{ textAlign: 'center', marginTop: 20 }}>loading...</Text>
          ) : filteredExams.length > 0 ? (
            filteredExams.map((exam) => (
              <TouchableOpacity
                key={exam.id}
                style={styles.examCard}
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
                    alert('Faylkan malaha PDF');
                  }
                }}
              >
                <View style={[styles.accentBar, { backgroundColor: colors.primary }]} />
                <View style={styles.cardContent}>
                  <Image
                    source={{ uri: exam.image_url ? `${Config.API_URL}${exam.image_url}` : 'https://images.unsplash.com/photo-1546410531-df4cb71576bd?w=400&q=80' }}
                    style={styles.examImage}
                  />
                  <View style={styles.cardInfo}>
                    <Text style={styles.examTitle} numberOfLines={1}>{exam.title}</Text>
                    <Text style={styles.examCategory}>{exam.category || 'General'} • {exam.year || '2025'}</Text>
                  </View>
                  <View style={styles.readBtn}>
                    <Text style={styles.readBtnText}>Read</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={{ textAlign: 'center', marginTop: 20 }}>Wax imtixaan ah lama helin.</Text>
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  headerSection: {
    paddingHorizontal: 24,
    backgroundColor: colors.background,
    paddingBottom: 16,
  },
  headerTitles: {
    marginBottom: 24,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: isDark ? '#FFFFFF' : '#3B82F6',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subTitle: {
    fontSize: 14,
    color: colors.neutral,
    fontWeight: '400',
  },



  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: isDark ? (colors.border || '#333') : '#3B82F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: colors.secondary,
    height: '100%',
  },

  filterWrapper: {
    marginBottom: 10,
  },
  filterScroll: {
    paddingHorizontal: 24,
    gap: 8,
    paddingBottom: 10,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: isDark ? colors.background : '#ffff',
    borderWidth: 1,
    borderColor: isDark ? '#333' : '#3882f6',
  },
  filterPillActive: {
    backgroundColor: isDark ? colors.secondary : '#3B82F6',
    borderColor: isDark ? colors.secondary : '#3B82F6',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: isDark ? colors.textLight : '#2563EB',
  },
  filterTextActive: {
    color: isDark ? colors.card : '#FFFFFF',
  },

  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 0,
  },
  examsGrid: {
    paddingHorizontal: 24,
    gap: 16,
  },
  examCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  accentBar: {
    width: 4,
    height: '100%',
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  examImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 16,
    backgroundColor: '#F1F5F9',
  },
  cardInfo: {
    flex: 1,
    marginRight: 12,
  },
  examTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.secondary,
    marginBottom: 4,
  },
  examCategory: {
    fontSize: 13,
    color: colors.textLight,
    fontWeight: '500',
  },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  readBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  // Year Filter Styles
  yearFilterWrapper: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  yearLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  yearScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  yearPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: isDark ? '#1E293B' : '#ffff',
    borderWidth: 1,
    borderColor: isDark ? '#333' : '#3882f6',
  },
  yearPillActive: {
    backgroundColor: isDark ? colors.primary : '#3B82F6',
    borderColor: isDark ? colors.primary : '#3B82F6',
  },
  yearText: {
    fontSize: 12,
    fontWeight: '600',
    color: isDark ? colors.textLight : '#2563EB',
  },
  yearTextActive: {
    color: isDark ? colors.card : '#FFFFFF',
  }
});
