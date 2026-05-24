import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, Dimensions, Alert, Image, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Config from '../constants/Config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

const SUBJECTS = [
  'Biology', 'History', 'Physics', 'Chemistry', 'Geography',
  'Mathematics', 'English', 'Somali', 'Islamic'
];

const GRADES = ['Form 1', 'Form 2', 'Form 3', 'Form 4'];
const QUESTION_COUNTS = [5, 10, 15, 20];
const LANGUAGES = ['Somali', 'English', 'Bilingual (English/Somali)', 'Arabic'];

export default function ExamGeneratorScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const router = useRouter();

  // Navigation Tabs: 'create' | 'history'
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Form State
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [grade, setGrade] = useState(GRADES[3]);
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [examLanguage, setExamLanguage] = useState(LANGUAGES[0]);
  const [duration, setDuration] = useState('1 saac (1 Hour)');
  const [totalMarks, setTotalMarks] = useState('100 dhibcood (100 Marks)');
  
  // Advanced features
  const [instructions, setInstructions] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // Status & History Data
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [historyExams, setHistoryExams] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    fetchHistory();
    fetchWalletBalance();
  }, []);

  const fetchWalletBalance = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${Config.API_URL}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data) {
        setWalletBalance(data.balance !== undefined ? data.balance : 0);
      }
    } catch (e) {
      console.warn("Error fetching balance:", e);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${Config.API_URL}/api/chat/quiz/my-exams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setHistoryExams(data);
      }
    } catch (e) {
      console.error("Error fetching exams history:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const pickLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Ogolaansho', 'Waxaan u baahanahay ogolaanshaha sawirada si aad u soo geliso logo-ga.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setLogo(asset.uri);
        setLogoBase64(`data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`);
      }
    } catch (err) {
      console.error('Pick Logo Error:', err);
    }
  };

  const handleGenerateExam = async () => {
    if (!topic.trim()) {
      Alert.alert('Fadlan buuxi', 'Fadlan qor casharka ama mawduuca aad rabto in laga sameeyo imtixaanka.');
      return;
    }

    setLoading(true);
    setLoadingStep('AI is researching curriculum...');
    
    const steps = [
      'AI is researching Somalian national curriculum textbooks...',
      'Extracting textbook reference and course objectives...',
      'Applying custom AI instructions and teaching objectives...',
      'Overlaying school/institution branding logo...',
      'Generating high-quality exam questions with marking guides...',
      'Compiling professional PDF and Word (.docx) formats...'
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setLoadingStep(steps[stepIdx]);
        stepIdx++;
      }
    }, 2800);

    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/chat/quiz/generate-exam-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject,
          grade,
          topic: topic.trim(),
          questionCount,
          logo: logoBase64,
          instructions: instructions.trim(),
          language: examLanguage,
          duration,
          totalMarks
        })
      });

      clearInterval(interval);
      const data = await response.json();

      if (response.ok && data.pdfUrl) {
        // Auto switch to history to show the new exam
        setActiveTab('history');
        fetchHistory();
        fetchWalletBalance();

        Alert.alert(
          '✅ Imtixaankii Waa Diyaar!',
          `"${data.title || topic}" si guul leh ayaa loo diyaariyey. PDF iyo Word labadaba waa diyaar.`,
          [
            {
              text: 'Furo PDF',
              onPress: () => {
                router.push({
                  pathname: '/readerexam',
                  params: {
                    pdfUrl: `${Config.API_URL}${data.pdfUrl}`,
                    title: data.title || topic
                  }
                });
              }
            },
            { text: 'Xidh', style: 'cancel' }
          ]
        );

      } else {
        Alert.alert('Cilad', data.message || 'Waan ka xunnahay, imtixaankii lama soo saari karo hadda.');
      }
    } catch (err) {
      clearInterval(interval);
      console.error(err);
      Alert.alert('Cilad Internet-ka ah', 'Fadlan hubi xiriirka internet-kaaga.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const downloadFile = (fileUrl: string) => {
    const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${Config.API_URL}${fileUrl}`;
    Linking.openURL(fullUrl).catch(err => {
      console.error("Open link error:", err);
      Alert.alert("Cilad", "Lama soo dejin karo faylkan.");
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI EXAM GENERATOR</Text>
        {walletBalance !== null ? (
          <View style={styles.headerBalance}>
            <Ionicons name="wallet" size={14} color="#3B82F6" />
            <Text style={styles.balanceText}>{walletBalance} Credits</Text>
          </View>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'create' && styles.tabButtonActive]}
          onPress={() => setActiveTab('create')}
        >
          <Ionicons name="create-outline" size={18} color={activeTab === 'create' ? '#3B82F6' : colors.neutral} />
          <Text style={[styles.tabText, activeTab === 'create' && styles.tabTextActive]}>Diyaari Imtixaan</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'history' && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('history');
            fetchHistory();
          }}
        >
          <Ionicons name="folder-open-outline" size={18} color={activeTab === 'history' ? '#3B82F6' : colors.neutral} />
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>Imtixaanadaadii</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'create' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.greetingBox}>
            <Ionicons name="sparkles" size={32} color="#3B82F6" style={styles.greetingIcon} />
            <Text style={styles.pageTitle}>AI Imtixaan-Sameeye</Text>
            <Text style={styles.pageSubtitle}>
              U samee imtixaan PDF iyo Word (.docx) ah dhowr ilbiriqsi gudahood. Generate-kasta wuxuu jarayaa 25 credits.
            </Text>
          </View>

          {/* 1. Subject Select */}
          <Text style={styles.sectionLabel}>Dooro Maaddada (Subject)</Text>
          <View style={styles.optionsGrid}>
            {SUBJECTS.map((sub) => {
              const isSelected = subject === sub;
              return (
                <TouchableOpacity
                  key={sub}
                  style={[styles.pillButton, isSelected && styles.pillButtonActive]}
                  onPress={() => setSubject(sub)}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>{sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 2. Grade Select */}
          <Text style={styles.sectionLabel}>Dooro Fasalka (Grade)</Text>
          <View style={styles.optionsGrid}>
            {GRADES.map((gr) => {
              const isSelected = grade === gr;
              return (
                <TouchableOpacity
                  key={gr}
                  style={[styles.pillButton, isSelected && styles.pillButtonActive]}
                  onPress={() => setGrade(gr)}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>{gr}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 3. Topic Input */}
          <Text style={styles.sectionLabel}>Qor Cutubka ama Casharka (Topic)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              placeholder="Tusaale: Cell Division, Photosynthesis, Dagaalkii 2aad..."
              placeholderTextColor="#9CA3AF"
              value={topic}
              onChangeText={setTopic}
            />
          </View>

          {/* 4. Question Count Select */}
          <Text style={styles.sectionLabel}>Tirada Su'aalaha (Questions)</Text>
          <View style={styles.optionsGrid}>
            {QUESTION_COUNTS.map((count) => {
              const isSelected = questionCount === count;
              return (
                <TouchableOpacity
                  key={count}
                  style={[styles.pillButton, isSelected && styles.pillButtonActive]}
                  onPress={() => setQuestionCount(count)}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>{count} Su'aalood</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 5. Logo Picker (Optional) */}
          <Text style={styles.sectionLabel}>Logo-ga Iskuulka/Astaanta (Optional)</Text>
          <View style={styles.logoPickerRow}>
            {logo ? (
              <View style={styles.logoPreviewContainer}>
                <Image source={{ uri: logo }} style={styles.logoPreview} />
                <TouchableOpacity style={styles.logoRemoveBtn} onPress={() => { setLogo(null); setLogoBase64(null); }}>
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.logoPickerBtn} onPress={pickLogo}>
                <Ionicons name="image-outline" size={24} color="#3B82F6" />
                <Text style={styles.logoPickerText}>Soo xulo Astaanta</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 6. AI Instructions (Optional) */}
          <Text style={styles.sectionLabel}>Talaabooyin gaar ah oo AI-ga raacayo (Optional)</Text>
          <View style={styles.textAreaContainer}>
            <TextInput
              style={[styles.textAreaInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              placeholder="Tusaale: Imtixaanka ku dar qaybta DNA, ka dhig su'aalaha kuwa dhexdhexaad ah..."
              placeholderTextColor="#9CA3AF"
              value={instructions}
              onChangeText={setInstructions}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* 7. Additional Tools & Configurations */}
          <Text style={styles.sectionLabel}>Habaynta Kale ee Imtixaanka</Text>
          
          <Text style={styles.subSectionLabel}>Luuqadda Imtixaanka</Text>
          <View style={styles.optionsGrid}>
            {LANGUAGES.map((lang) => {
              const isSelected = examLanguage === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  style={[styles.pillButton, isSelected && styles.pillButtonActive]}
                  onPress={() => setExamLanguage(lang)}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>{lang}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.subSectionLabel}>Waqtiga Loo Qondeeyey (Duration)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              placeholder="Tusaale: 1 saac, 2 saac iyo bar..."
              placeholderTextColor="#9CA3AF"
              value={duration}
              onChangeText={setDuration}
            />
          </View>

          <Text style={styles.subSectionLabel}>Dhibcaha Guud (Total Marks)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              placeholder="Tusaale: 100 dhibcood, 50 dhibcood..."
              placeholderTextColor="#9CA3AF"
              value={totalMarks}
              onChangeText={setTotalMarks}
            />
          </View>

          {/* Generate Button */}
          <TouchableOpacity
            style={[styles.generateButton, loading && styles.generateButtonDisabled]}
            onPress={handleGenerateExam}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={22} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.generateButtonText}>DIYAARI IMTIXAANKA</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {loadingHistory ? (
            <View style={styles.centeredContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Soo akhrinaya imtixaanadii aad diyaarisay...</Text>
            </View>
          ) : historyExams.length === 0 ? (
            <View style={styles.centeredContainer}>
              <Ionicons name="folder-open-outline" size={64} color={colors.neutral} style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>Ma jiraan imtixaan la diyaariyey</Text>
              <Text style={styles.emptySubtitle}>Imtixaan kasta oo aad diyaarisid waxaad ka heli doontaa halkaan si aad mar kasta u soo dejisato.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.historyList} showsVerticalScrollIndicator={false}>
              {historyExams.map((exam) => (
                <View key={exam.id} style={styles.examCard}>
                  <View style={styles.examCardHeader}>
                    <View style={styles.examBadge}>
                      <Text style={styles.examBadgeText}>{exam.subject}</Text>
                    </View>
                    <Text style={styles.examDate}>
                      {new Date(exam.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  <Text style={styles.examCardTitle}>{exam.title}</Text>
                  <Text style={styles.examCardDesc}>Fasalka: {exam.grade}  |  Mawduuca: {exam.topic}</Text>
                  
                  <View style={styles.downloadRow}>
                    <TouchableOpacity style={styles.downloadBtnPdf} onPress={() => downloadFile(exam.pdf_url)}>
                      <Ionicons name="document-outline" size={16} color="white" style={{ marginRight: 4 }} />
                      <Text style={styles.downloadText}>PDF</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.downloadBtnWord} onPress={() => downloadFile(exam.word_url)}>
                      <Ionicons name="logo-wordpress" size={16} color="white" style={{ marginRight: 4 }} />
                      <Text style={styles.downloadText}>WORD</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Beautiful Loading Overlay */}
      {loading && (
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={isDark ? 50 : 80} tint={isDark ? "dark" : "light"} style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingTitle}>DARKPEN AI WRITER</Text>
            <Text style={styles.loadingStep}>{loadingStep}</Text>
          </BlurView>
        </View>
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#333',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: 1,
  },
  headerBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  balanceText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#333',
    backgroundColor: colors.card,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral,
  },
  tabTextActive: {
    color: '#3B82F6',
    fontWeight: '750',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  greetingBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  greetingIcon: {
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.secondary,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 13,
    color: colors.neutral,
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
  },
  subSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral,
    marginTop: 10,
    marginBottom: 6,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  pillButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border || '#333',
  },
  pillButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
  },
  pillTextActive: {
    color: 'white',
  },
  inputContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border || '#333',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  textInput: {
    fontSize: 14,
    color: colors.secondary,
  },
  textAreaContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border || '#333',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  textAreaInput: {
    fontSize: 14,
    color: colors.secondary,
    height: 80,
    textAlignVertical: 'top',
  },
  logoPickerRow: {
    marginBottom: 8,
  },
  logoPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    gap: 8,
  },
  logoPickerText: {
    color: '#3B82F6',
    fontWeight: '700',
    fontSize: 14,
  },
  logoPreviewContainer: {
    position: 'relative',
    alignSelf: 'center',
  },
  logoPreview: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border || '#333',
  },
  logoRemoveBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  generateButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 24,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  generateButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  generateButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 8,
  },
  loadingStep: {
    fontSize: 13,
    color: colors.neutral,
    textAlign: 'center',
    lineHeight: 18,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: colors.neutral,
    marginTop: 12,
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.secondary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.neutral,
    textAlign: 'center',
    lineHeight: 18,
  },
  historyList: {
    padding: 16,
    gap: 12,
  },
  examCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border || '#333',
  },
  examCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  examBadge: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  examBadgeText: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '750',
  },
  examDate: {
    color: colors.neutral,
    fontSize: 11,
  },
  examCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.secondary,
    marginBottom: 6,
  },
  examCardDesc: {
    fontSize: 13,
    color: colors.neutral,
    marginBottom: 14,
  },
  downloadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  downloadBtnPdf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    borderRadius: 8,
  },
  downloadBtnWord: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E3A8A',
    paddingVertical: 10,
    borderRadius: 8,
  },
  downloadText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  }
});
