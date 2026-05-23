import { useTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, Dimensions, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Config from '../constants/Config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

const SUBJECTS = [
  'Biology', 'History', 'Physics', 'Chemistry', 'Geography',
  'Mathematics', 'English', 'Somali', 'Islamic'
];

const GRADES = ['Form 1', 'Form 2', 'Form 3', 'Form 4'];

const QUESTION_COUNTS = [5, 10, 15, 20];

export default function ExamGeneratorScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const router = useRouter();

  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [grade, setGrade] = useState(GRADES[3]); // Default Form 4
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');

  const handleGenerateExam = async () => {
    if (!topic.trim()) {
      Alert.alert('Fadlan buuxi', 'Fadlan qor casharka ama mawduuca aad rabto in laga sameeyo imtixaanka.');
      return;
    }

    setLoading(true);
    setLoadingStep('AI is researching curriculum...');
    
    // Simulate natural thinking steps for rich premium UX
    const steps = [
      'AI is researching Somalian national curriculum books...',
      'Extracting textbook reference context...',
      'Generating high-quality Somali questions (multiple choice & structured)...',
      'Creating teacher and student answer keys...',
      'Compiling professional print-ready PDF exam paper...'
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setLoadingStep(steps[stepIdx]);
        stepIdx++;
      }
    }, 3000);

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
          questionCount
        })
      });

      clearInterval(interval);
      const data = await response.json();

      if (response.ok && data.pdfUrl) {
        Alert.alert(
          'Si Guul Leh Ayuu U Dhacay!',
          'Imtixaankaagii PDF-ka ahaa si guul leh ayaa loo diyaariyey. Hadda ma rabaa inaan kuu furo?',
          [
            {
              text: 'Hada Furo',
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
            {
              text: 'OK',
              onPress: () => router.back()
            }
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI EXAM GENERATOR</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.greetingBox}>
          <Ionicons name="sparkles" size={32} color="#3B82F6" style={styles.greetingIcon} />
          <Text style={styles.pageTitle}>Imtixaan-Sameeye</Text>
          <Text style={styles.pageSubtitle}>
            U samee imtixaan PDF ah oo professional ah dhowr ilbiriqsi gudahood macalimiinta iyo waalidiinta.
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

        {/* Generate Button */}
        <TouchableOpacity
          style={[styles.generateButton, loading && styles.generateButtonDisabled]}
          onPress={handleGenerateExam}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text-outline" size={22} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.generateButtonText}>CREATE EXAM PDF</Text>
        </TouchableOpacity>
      </ScrollView>

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
    fontSize: 16,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 60,
  },
  greetingBox: {
    alignItems: 'center',
    marginBottom: 30,
  },
  greetingIcon: {
    marginBottom: 10,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.secondary,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.neutral,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 15,
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  pillButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border || '#333',
  },
  pillButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  pillText: {
    fontSize: 13,
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
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  textInput: {
    fontSize: 15,
    color: colors.secondary,
  },
  generateButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 15,
    marginTop: 30,
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
    fontSize: 16,
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
    fontSize: 14,
    color: colors.neutral,
    textAlign: 'center',
    lineHeight: 20,
  }
});
