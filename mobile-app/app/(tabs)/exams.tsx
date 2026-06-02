import { useTheme } from '../../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Platform, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CustomBlurView as BlurView } from '../../components/CustomBlurView';
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
  const [activeGrade, setActiveGrade] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);

  // Load user data for empty state message
  React.useEffect(() => {
    AsyncStorage.getItem('userData').then(raw => {
      if (raw) setUserData(JSON.parse(raw));
    });
  }, []);

  const fetchExams = async () => {
    setError(null);
    try {
      // 1. Try to load from cache first
      const cached = await AsyncStorage.getItem('exams_list');
      if (cached) {
        setExams(JSON.parse(cached));
        setLoading(false); // We have cached data, bypass full-screen loading spinner
      } else {
        setLoading(true); // Only show spinner if there is NO cache at all
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
    const matchesGrade = activeGrade === 'All' || (exam.grade && (
      exam.grade.toLowerCase() === activeGrade.toLowerCase() || 
      (activeGrade === 'Class 8' && (exam.grade.toLowerCase().includes('8') || exam.grade.toLowerCase().includes('eight'))) ||
      (activeGrade === 'Form 4' && (exam.grade.toLowerCase().includes('form 4') || exam.grade.toLowerCase().includes('form4') || exam.grade.toLowerCase().includes('four')))
    ));
    const examTitle = exam.title || '';
    const matchesSearch = examTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesYear && matchesGrade && matchesSearch;
  }) : [];

  // Get available years for the current category and grade
  const availableYears = React.useMemo(() => {
    const years = new Set<string>();
    years.add('All');
    exams.forEach(exam => {
      const matchesCategory = activeCategory === 'All' || exam.category === activeCategory;
      const matchesGrade = activeGrade === 'All' || (exam.grade && (
        exam.grade.toLowerCase() === activeGrade.toLowerCase() || 
        (activeGrade === 'Class 8' && (exam.grade.toLowerCase().includes('8') || exam.grade.toLowerCase().includes('eight'))) ||
        (activeGrade === 'Form 4' && (exam.grade.toLowerCase().includes('form 4') || exam.grade.toLowerCase().includes('form4') || exam.grade.toLowerCase().includes('four')))
      ));
      if (matchesCategory && matchesGrade) {
        if (exam.year) years.add(exam.year);
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a)); // Newest years first
  }, [exams, activeCategory, activeGrade]);

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

          {/* AI Generator Banner */}
          <TouchableOpacity
            style={styles.aiBanner}
            onPress={() => router.push('/exam-generator')}
            activeOpacity={0.85}
          >
            <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={styles.aiBannerBlur}>
              <View style={styles.aiBannerLeft}>
                <Ionicons name="sparkles" size={22} color="#3B82F6" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiBannerTitle}>AI Exam Generator</Text>
                  <Text style={styles.aiBannerSub} numberOfLines={1}>Create print-ready PDF exam papers automatically.</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#3B82F6" />
            </BlurView>
          </TouchableOpacity>

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

        {/* CLASS/GRADE FILTER TABS */}
        <View style={styles.gradeFilterWrapper}>
          {['All', 'Class 8', 'Form 4'].map((gradeOpt) => (
            <TouchableOpacity
              key={gradeOpt}
              style={[styles.gradeTab, activeGrade === gradeOpt && styles.gradeTabActive]}
              onPress={() => {
                setActiveGrade(gradeOpt);
                setActiveYear('All'); // Reset year when grade changes
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.gradeTabText, activeGrade === gradeOpt && styles.gradeTabTextActive]}>
                {gradeOpt === 'All' ? 'All Classes' : gradeOpt}
              </Text>
            </TouchableOpacity>
          ))}
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
                        title: exam.title,
                        type: 'exam' // Explicitly pass 'exam' type
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
            <View style={styles.emptyStateCard}>
              <Ionicons name="time-outline" size={48} color="#3B82F6" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyStateTitle}>
                {userData?.country === 'Somalia' && userData?.region_state
                  ? `${userData.region_state}`
                  : userData?.country || 'Gobolkaaga'}
              </Text>
              <Text style={styles.emptyStateMessage}>
                Imtixaanadii aad u baahan tahay wali kuma jiraan nidaamka. Dhawr casho ka bacdi ayaa lasoo dari doonaa — raac oo dib u soo eeg!
              </Text>
              <View style={styles.emptyStateBadge}>
                <Ionicons name="notifications-outline" size={14} color="#3B82F6" />
                <Text style={styles.emptyStateBadgeText}>Dhawaan ayay soo geli doonaan</Text>
              </View>
            </View>
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
  },
  aiBanner: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#BFDBFE',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  aiBannerBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(59, 130, 246, 0.08)',
  },
  aiBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  aiBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.secondary,
  },
  aiBannerSub: {
    fontSize: 11,
    color: colors.neutral,
    marginTop: 2,
  },
  emptyStateCard: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
    marginTop: 8,
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
  gradeFilterWrapper: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
    padding: 4,
    borderRadius: 14,
    marginBottom: 16,
    marginHorizontal: 24,
  },
  gradeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  gradeTabActive: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  gradeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  gradeTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
