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
const FONTS = ['Times New Roman', 'Arial / Helvetica', 'Georgia', 'Courier New'];
const PAGES = ['Auto', '1', '2', '3', '4', '5+'];
const SPACINGS = ['Standard', 'Double Spacing', 'Bulleted / List Style'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

// Cleaned old duplicate declaration block

export default function ExamGeneratorScreen() {
  const { colors, isDark } = useTheme();
  const styles: any = getStyles(colors, isDark);
  const router = useRouter();

  // Navigation Tabs: 'create' | 'history'
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Form State
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState('');
  const [examLanguage, setExamLanguage] = useState('');
  const [duration, setDuration] = useState('');
  const [totalMarks, setTotalMarks] = useState('');
  
  // Advanced features & new accessibility options
  const [instructions, setInstructions] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [fontStyle, setFontStyle] = useState('');
  const [pageCount, setPageCount] = useState('');
  const [paragraphStyle, setParagraphStyle] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);

  // Illustrations / Images State
  const [imageMode, setImageMode] = useState<'none' | 'upload' | 'ai'>('none');
  const [imagePrompt, setImagePrompt] = useState('');
  const [examIllustration, setExamIllustration] = useState<string | null>(null);
  const [examIllustrationBase64, setExamIllustrationBase64] = useState<string | null>(null);

  // Status & History Data
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [historyExams, setHistoryExams] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [generatingExams, setGeneratingExams] = useState<{[key: string]: string}>({});

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
      if (res.ok && data && data.user) {
        setWalletBalance(data.user.balance !== undefined ? data.user.balance : 0);
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

  const calculateEstimatedCost = () => {
    const baseCost = 5;
    const perQuestionCost = 1.5;
    const pageCost = 2;
    const answerKeyCost = 4;
    const formattingCost = 3;
    const aiImageCost = 20;

    let cost = baseCost;
    cost += (parseInt(String(questionCount)) || 0) * perQuestionCost;

    const targetPages = parseInt(pageCount) || 0;
    cost += targetPages * pageCost;

    if (includeAnswerKey) {
      cost += answerKeyCost;
    }

    if (fontStyle !== 'Times New Roman' || paragraphStyle !== 'Standard') {
      cost += formattingCost;
    }

    if (imageMode === 'ai' && imagePrompt.trim()) {
      cost += aiImageCost;
    }

    return Math.ceil(cost);
  };

  const pickIllustration = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Ogolaansho', 'Waxaan u baahanahay ogolaanshaha sawirada si aad u soo geliso sawirka/shaxanka.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setExamIllustration(asset.uri);
        setExamIllustrationBase64(`data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`);
      }
    } catch (err) {
      console.error('Pick Illustration Error:', err);
    }
  };

  const handleGenerateExam = async () => {
    if (!topic.trim()) {
      Alert.alert('Fadlan buuxi', 'Fadlan qor casharka ama mawduuca aad rabto in laga sameeyo imtixaanka.');
      return;
    }

    if (imageMode === 'ai' && !imagePrompt.trim()) {
      Alert.alert('Fadlan buuxi', 'Fadlan qor waxa aad rabto in sawirka AI lagu soo saaro.');
      return;
    }

    if (imageMode === 'upload' && !examIllustration) {
      Alert.alert('Fadlan buuxi', 'Fadlan soo dooro sawirka/shaxanka aad rabto in imtixaanka lagu daro.');
      return;
    }

    // Check if there is already an active pending generation
    const isAlreadyGenerating = historyExams.some(e => e.status === 'pending');
    if (isAlreadyGenerating) {
      Alert.alert('Fadlan sug', 'Waxaa hadda socda abuurista imtixaan kale. Fadlan sug inta uu ka dhamaanayo.');
      return;
    }

    // 1. Verify user balance and subscription status before generating
    let latestBalance = walletBalance;
    let latestSubscription = null;

    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${Config.API_URL}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data && data.user) {
        latestBalance = data.user.balance !== undefined ? data.user.balance : 0;
        latestSubscription = data.user.subscription_type || null;
        setWalletBalance(latestBalance);
      }
    } catch (e) {
      console.warn("Error verifying balance before generation:", e);
    }

    const hasActiveSub = latestSubscription !== null;
    const cost = calculateEstimatedCost();

    if (!hasActiveSub && (latestBalance === null || latestBalance < cost)) {
      Alert.alert(
        'Balance Kuma Filna',
        latestBalance === 0 
          ? 'Balance mahaysatid ee ku shubo lacag.' 
          : `Credit kugu filan mahaysatid. Imtixaankan wuxuu u baahan yahay ${cost} Credits, laakiin waxaad haysataa ${latestBalance} Credits.`,
        [
          { text: 'Ku Shubo Lacag', onPress: () => router.push('/billing') },
          { text: 'Xidh', style: 'cancel' }
        ]
      );
      return;
    }

    // 2. Generate a temp pending ID and push it to the history tab immediately
    const tempId = `pending-${Date.now()}`;
    const pendingExam = {
      id: tempId,
      title: topic.trim() || `${subject} - ${topic}`,
      subject: subject,
      grade: grade,
      topic: topic.trim(),
      pdf_url: '',
      word_url: '',
      created_at: new Date().toISOString(),
      status: 'pending'
    };

    // Update history list and redirect user
    setHistoryExams(prev => [pendingExam, ...prev]);
    setActiveTab('history');

    const steps = [
      'AI is researching curriculum...',
      'Applying custom instructions & advanced formatting...',
      'Generating high-quality exam questions with marking guides...',
      'Creating/attaching illustrations & school logo...',
      'Compiling professional PDF and Word (.docx) formats...'
    ];

    setGeneratingExams(prev => ({
      ...prev,
      [tempId]: 'AI is researching curriculum...'
    }));

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setGeneratingExams(prev => ({
          ...prev,
          [tempId]: steps[stepIdx]
        }));
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
          questionCount: parseInt(String(questionCount)) || 10,
          logo: logoBase64,
          instructions: instructions.trim(),
          language: examLanguage,
          duration,
          totalMarks,
          fontStyle,
          pageCount,
          paragraphStyle,
          difficulty,
          includeAnswerKey,
          examIllustration: imageMode === 'upload' ? examIllustrationBase64 : null,
          imagePrompt: imageMode === 'ai' ? imagePrompt.trim() : null
        })
      });

      clearInterval(interval);
      // Remove temp id from active steps
      setGeneratingExams(prev => {
        const copy = { ...prev };
        delete copy[tempId];
        return copy;
      });

      const data = await response.json();

      if (response.ok && data.pdfUrl) {
        // Success: reload history and balance to replace the pending card
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
        // Failed on backend: remove pending card from state
        setHistoryExams(prev => prev.filter(e => e.id !== tempId));
        Alert.alert('Cilad', data.message || 'Waan ka xunnahay, imtixaankii lama soo saari karo hadda.');
      }
    } catch (err) {
      clearInterval(interval);
      setGeneratingExams(prev => {
        const copy = { ...prev };
        delete copy[tempId];
        return copy;
      });
      // Remove pending card
      setHistoryExams(prev => prev.filter(e => e.id !== tempId));
      console.error(err);
      Alert.alert('Cilad Internet-ka ah', 'Fadlan hubi xiriirka internet-kaaga.');
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
          {/* Header Cost Notice */}
          <View style={styles.priceBanner}>
            <View style={styles.priceHeader}>
              <Ionicons name="sparkles" size={22} color="#F59E0B" />
              <Text style={styles.priceTitle}>Darkpen AI Imtixaan-Sameeye</Text>
            </View>
            <Text style={styles.priceDesc}>
              Hadda waxaad u samayn kartaa imtixaan si gaar ah loo naqshadeeyey. Qiimaha credits-ka la goosanayo wuxuu isku beddelayaa si DYNAMIC ah oo waafaqsan xulashooyinkaaga hoose.
            </Text>
            <View style={styles.priceCostBadgeContainer}>
              <Text style={styles.priceCostText}>Qiimaha Qiyaasta: </Text>
              <Text style={styles.priceCostVal}>{calculateEstimatedCost()} Credits</Text>
            </View>
          </View>

          {/* CARD 1: EXAM INFORMATION */}
          <View style={styles.formCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="book-outline" size={20} color="#3B82F6" />
              <Text style={styles.cardTitle}>1. Xogta Maaddada (Exam Subject & Grade)</Text>
            </View>

            <Text style={styles.subSectionLabel}>Maaddada (Subject)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                placeholder="Tusaale: Biology, History, Mathematics..."
                placeholderTextColor="#9CA3AF"
                value={subject}
                onChangeText={setSubject}
              />
            </View>
            <View style={[styles.optionsGrid, { marginTop: 10 }]}>
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

            <Text style={styles.subSectionLabel}>Fasalka (Grade)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                placeholder="Tusaale: Form 1, Grade 8, University Year 1..."
                placeholderTextColor="#9CA3AF"
                value={grade}
                onChangeText={setGrade}
              />
            </View>
            <View style={[styles.optionsGrid, { marginTop: 10 }]}>
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

            <Text style={styles.subSectionLabel}>Qor Cutubka ama Casharka (Topic)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                placeholder="Tusaale: Cell Division, Photosynthesis, Dagaalkii 2aad..."
                placeholderTextColor="#9CA3AF"
                value={topic}
                onChangeText={setTopic}
              />
            </View>
          </View>

          {/* CARD 2: QUESTIONS & CONFIGURATION */}
          <View style={styles.formCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="list-circle-outline" size={20} color="#3B82F6" />
              <Text style={styles.cardTitle}>2. Qaabka Su'aalaha (Questions & Format)</Text>
            </View>

            <Text style={styles.subSectionLabel}>Tirada Su'aalaha (Questions)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                placeholder="Tusaale: 10, 20, 50..."
                placeholderTextColor="#9CA3AF"
                value={String(questionCount)}
                onChangeText={(text) => setQuestionCount(text.replace(/[^0-9]/g, '') as any)}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.optionsGrid, { marginTop: 10 }]}>
              {QUESTION_COUNTS.map((count) => {
                const isSelected = String(questionCount) === String(count);
                return (
                  <TouchableOpacity
                    key={count}
                    style={[styles.pillButton, isSelected && styles.pillButtonActive]}
                    onPress={() => setQuestionCount(String(count))}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>{count} Su'aalood</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.subSectionLabel}>Heerka Imtixaanka (Difficulty)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                placeholder="Tusaale: Fudud (Easy), Dhexdhexaad (Medium), Adag (Hard)..."
                placeholderTextColor="#9CA3AF"
                value={difficulty}
                onChangeText={setDifficulty}
              />
            </View>
            <View style={[styles.optionsGrid, { marginTop: 10 }]}>
              {DIFFICULTIES.map((diff) => {
                const isSelected = difficulty === diff;
                return (
                  <TouchableOpacity
                    key={diff}
                    style={[styles.pillButton, isSelected && styles.pillButtonActive]}
                    onPress={() => setDifficulty(diff)}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>{diff === 'Easy' ? 'Fudud' : diff === 'Medium' ? 'Dhexdhexaad' : 'Adag'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.subSectionLabel}>Luuqadda Imtixaanka</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                placeholder="Tusaale: Somali, English, Arabic..."
                placeholderTextColor="#9CA3AF"
                value={examLanguage}
                onChangeText={setExamLanguage}
              />
            </View>
            <View style={[styles.optionsGrid, { marginTop: 10 }]}>
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
          </View>

          {/* CARD 3: DESIGN & ADVANCED LAYOUT */}
          <View style={styles.formCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="color-palette-outline" size={20} color="#3B82F6" />
              <Text style={styles.cardTitle}>3. Naqshadda Qoraalka (Advanced Formatting)</Text>
            </View>

            <Text style={styles.subSectionLabel}>Nooca Farta (Font Style)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                placeholder="Tusaale: Times New Roman, Arial..."
                placeholderTextColor="#9CA3AF"
                value={fontStyle}
                onChangeText={setFontStyle}
              />
            </View>
            <View style={[styles.optionsGrid, { marginTop: 10 }]}>
              {FONTS.map((font) => {
                const isSelected = fontStyle === font;
                return (
                  <TouchableOpacity
                    key={font}
                    style={[styles.pillButton, isSelected && styles.pillButtonActive]}
                    onPress={() => setFontStyle(font)}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>{font}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.subSectionLabel}>Inta Bog ee Ugu Talo Galay (Page Count)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                placeholder="Tusaale: Auto, 2, 5..."
                placeholderTextColor="#9CA3AF"
                value={pageCount}
                onChangeText={setPageCount}
              />
            </View>
            <View style={[styles.optionsGrid, { marginTop: 10 }]}>
              {PAGES.map((p) => {
                const isSelected = pageCount === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.pillButton, isSelected && styles.pillButtonActive]}
                    onPress={() => setPageCount(p)}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>{p === 'Auto' ? 'AI Decides (Auto)' : `${p} Pages`}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.subSectionLabel}>Qaabka Paragraphs (Spacing Style)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                placeholder="Tusaale: Standard, Double Spacing..."
                placeholderTextColor="#9CA3AF"
                value={paragraphStyle}
                onChangeText={setParagraphStyle}
              />
            </View>
            <View style={[styles.optionsGrid, { marginTop: 10 }]}>
              {SPACINGS.map((sp) => {
                const isSelected = paragraphStyle === sp;
                return (
                  <TouchableOpacity
                    key={sp}
                    style={[styles.pillButton, isSelected && styles.pillButtonActive]}
                    onPress={() => setParagraphStyle(sp)}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>{sp}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Ku dar Furaha Jawaabaha (Answer Key)</Text>
              <TouchableOpacity 
                style={[styles.toggleBtn, includeAnswerKey ? styles.toggleBtnActive : styles.toggleBtnInactive]}
                onPress={() => setIncludeAnswerKey(!includeAnswerKey)}
              >
                <Text style={[styles.toggleText, includeAnswerKey ? styles.toggleTextActive : styles.toggleTextInactive]}>
                  {includeAnswerKey ? 'HAA (Yes)' : 'MAYA (No)'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.subSectionLabel}>Astaamaha gaarka ah oo AI-ga raacayo (Optional)</Text>
            <View style={styles.textAreaContainer}>
              <TextInput
                style={[styles.textAreaInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                placeholder="Tusaale: Ku dar qaybta DNA, ka dhig su'aalaha kuwa si qoto dheer u cabiraya fahamka..."
                placeholderTextColor="#9CA3AF"
                value={instructions}
                onChangeText={setInstructions}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* CARD 4: BRANDING & ILLUSTRATIONS */}
          <View style={styles.formCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="image-outline" size={20} color="#3B82F6" />
              <Text style={styles.cardTitle}>4. Sawirro & Astaamo (Imagery & Branding)</Text>
            </View>

            <Text style={styles.subSectionLabel}>Logo-ga Iskuulka/Astaanta (Optional)</Text>
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

            <Text style={styles.subSectionLabel}>Ku dar Shaxan/Illustration imtixaanka</Text>
            <View style={styles.optionsGrid}>
              {[
                { id: 'none', label: 'Bilaa Sawir' },
                { id: 'upload', label: 'Soo Geli Sawir (Upload)' },
                { id: 'ai', label: 'AI Image Generator' }
              ].map((mode) => {
                const isSelected = imageMode === mode.id;
                return (
                  <TouchableOpacity
                    key={mode.id}
                    style={[styles.pillButton, isSelected && styles.pillButtonActive]}
                    onPress={() => setImageMode(mode.id as any)}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>{mode.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {imageMode === 'upload' && (
              <View style={{ marginTop: 12 }}>
                {examIllustration ? (
                  <View style={styles.logoPreviewContainer}>
                    <Image source={{ uri: examIllustration }} style={styles.logoPreview} />
                    <TouchableOpacity style={styles.logoRemoveBtn} onPress={() => { setExamIllustration(null); setExamIllustrationBase64(null); }}>
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.logoPickerBtn} onPress={pickIllustration}>
                    <Ionicons name="cloud-upload-outline" size={24} color="#3B82F6" />
                    <Text style={styles.logoPickerText}>Soo xulo Shaxanka/Sawirka</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {imageMode === 'ai' && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.subSectionLabel}>AI Prompt (e.g. Draw a labelled human respiratory system...)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    placeholder="Tusaale: Diagram of photosynthesis showing leaf cell, water, and sunlight..."
                    placeholderTextColor="#9CA3AF"
                    value={imagePrompt}
                    onChangeText={setImagePrompt}
                  />
                </View>
                <Text style={{ fontSize: 11, color: '#D97706', marginTop: 4 }}>
                  * Abuurista sawirka AI ee imtixaanka waxay goosanaysaa 20 credits oo dheeraad ah.
                </Text>
              </View>
            )}
          </View>

          {/* Generate Button */}
          <TouchableOpacity
            style={[styles.generateButton, loading && styles.generateButtonDisabled]}
            onPress={handleGenerateExam}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={22} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.generateButtonText}>
              DIYAARI IMTIXAANKA ({calculateEstimatedCost()} Credits)
            </Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {loadingHistory ? (
            <View style={styles.centeredContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Loading...</Text>
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
                  
                  {exam.status === 'pending' ? (
                    <View style={styles.pendingContainer}>
                      <ActivityIndicator size="small" color="#3B82F6" style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pendingText}>Diyaarinta AI...</Text>
                        <Text style={styles.pendingStepText}>
                          {generatingExams[exam.id] || 'AI is researching curriculum...'}
                        </Text>
                      </View>
                    </View>
                  ) : (
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
                  )}
                </View>
              ))}
            </ScrollView>
          )}
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
    fontWeight: '700',
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
    fontWeight: '700',
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
  },
  pendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
    borderColor: isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 10,
  },
  pendingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3B82F6',
  },
  pendingStepText: {
    fontSize: 11,
    color: colors.neutral,
    marginTop: 2,
  },
  priceBanner: {
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7',
    borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FCD34D',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  priceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: isDark ? '#F59E0B' : '#D97706',
  },
  priceDesc: {
    fontSize: 12,
    color: isDark ? '#D1D5DB' : '#4B5563',
    lineHeight: 18,
    marginBottom: 10,
  },
  priceCostBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priceCostText: {
    fontSize: 12,
    fontWeight: '600',
    color: isDark ? '#F59E0B' : '#D97706',
  },
  priceCostVal: {
    fontSize: 13,
    fontWeight: '800',
    color: isDark ? '#F59E0B' : '#D97706',
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border || '#333',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#333',
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.secondary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border || '#333',
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.secondary,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3B82F6',
  },
  toggleBtnInactive: {
    backgroundColor: colors.card,
    borderColor: colors.border || '#333',
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '800',
  },
  toggleTextActive: {
    color: '#3B82F6',
  },
  toggleTextInactive: {
    color: colors.neutral,
  }
});
