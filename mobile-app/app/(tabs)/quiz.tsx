import { useTheme } from '../../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { AuthGuard } from '../../components/AuthGuard';

const { width } = Dimensions.get('window');

import Config from '../../constants/Config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function QuizScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const [activeTab, setActiveTab] = useState<'ai' | 'others'>('ai');

  // Quiz State
  const [quizState, setQuizState] = useState<'idle' | 'generating' | 'active' | 'finished'>('idle');
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds

  useEffect(() => {
    let timer: any;
    if (quizState === 'active' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && quizState === 'active') {
      setQuizState('finished');
    }
    return () => clearInterval(timer);
  }, [quizState, timeLeft]);

  // Actions
  const handleStartQuiz = async () => {
    setQuizState('generating');
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/chat/quiz/generate`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setScore(0);
        setCurrentQuestionIndex(0);
        setTimeLeft(300);
        setQuizState('active');
      } else {
        alert("Waan ka xunnahay, xog ku filan oo su'aalo laga sameeyo lama helin.");
        setQuizState('idle');
      }
    } catch (error) {
      console.error(error);
      alert("Cilad ayaa dhacday soo saarista su'aalaha.");
      setQuizState('idle');
    }
  };

  const handleAnswer = (selectedIndex: number) => {
    const isCorrect = selectedIndex === questions[currentQuestionIndex].answer;
    if (isCorrect) setScore(prev => prev + 1);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setQuizState('finished');
    }
  };

  const resetQuiz = () => {
    setQuizState('idle');
    setQuestions([]);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <AuthGuard>
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* TikTok Style Header */}
      <View style={styles.header}>
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => setActiveTab('ai')}
          >
            <Text style={[styles.tabText, activeTab === 'ai' && styles.activeTabText]}>
              AI Challenge
            </Text>
            {activeTab === 'ai' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => setActiveTab('others')}
          >
            <Text style={[styles.tabText, activeTab === 'others' && styles.activeTabText]}>
              Challenge Others
            </Text>
            {activeTab === 'others' && <View style={styles.activeTabIndicator} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>

        {/* --- AI CHALLENGE TAB --- */}
        {activeTab === 'ai' && (
          <View style={styles.tabContent}>

            {quizState === 'idle' && (
              <View style={styles.centerBox}>
                <Ionicons name="hardware-chip-outline" size={60} color={colors.primary} style={{ marginBottom: 20 }} />
                <Text style={styles.idleTitle}>Darkpen AI Quiz</Text>
                <Text style={styles.idleSubtitle}>
                  Hel 10 su'aalood oo random ah. Waxaad haysataa 5 daqiiqo. Wax xog ah lama xafidayo!
                </Text>
                <TouchableOpacity style={styles.startButton} onPress={handleStartQuiz} activeOpacity={0.8}>
                  <Text style={styles.startButtonText}>Start Quiz</Text>
                  <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </View>
            )}

            {quizState === 'generating' && (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.generatingText}>Generating 10 questions...</Text>
              </View>
            )}

            {quizState === 'active' && (
              <View style={styles.quizActiveContainer}>
                {/* Quiz Header */}
                <View style={styles.quizHeaderRow}>
                  <View style={styles.timerBadge}>
                    <Ionicons name="time-outline" size={18} color="#FF4757" />
                    <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                  </View>
                  <View style={styles.progressBadge}>
                    <Text style={styles.progressText}>{currentQuestionIndex + 1} / 10</Text>
                  </View>
                </View>

                {/* Question */}
                <View style={styles.questionCard}>
                  <Text style={styles.questionText}>
                    {questions[currentQuestionIndex].question}
                  </Text>
                </View>

                {/* Options */}
                <ScrollView style={styles.optionsScroll}>
                  {questions[currentQuestionIndex].options.map((opt: any, idx: number) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.optionButton}
                      onPress={() => handleAnswer(idx)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionLetterBox}>
                        <Text style={styles.optionLetter}>{String.fromCharCode(65 + idx)}</Text>
                      </View>
                      <Text style={styles.optionText}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                  <View style={{ height: 100 }} />
                </ScrollView>
              </View>
            )}

            {quizState === 'finished' && (
              <View style={styles.centerBox}>
                <Ionicons
                  name={score >= 5 ? "trophy" : "sad-outline"}
                  size={80}
                  color={score >= 5 ? "#F59E0B" : "#FF4757"}
                  style={{ marginBottom: 20 }}
                />
                <Text style={styles.idleTitle}>Natiijadaada</Text>
                <Text style={styles.scoreText}>{score} / 10</Text>
                <Text style={styles.idleSubtitle}>
                  {score >= 5 ? "Hambalyo! Aad baad u fiican tahay." : "Nasiib wacan markale, wax badan soo akhri!"}
                </Text>

                <TouchableOpacity style={styles.startButton} onPress={resetQuiz} activeOpacity={0.8}>
                  <Ionicons name="refresh" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.startButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

          </View>
        )}

        {/* --- CHALLENGE OTHERS TAB --- */}
        {activeTab === 'others' && (
          <View style={styles.tabContent}>
            <View style={styles.othersBackground}>
              <View style={styles.fakeListItem} />
              <View style={styles.fakeListItem} />
              <View style={styles.fakeListItem} />
            </View>

            <View style={StyleSheet.absoluteFill}>
              <BlurView intensity={70} tint="light" style={styles.lockedBlur}>
                <View style={styles.lockedContent}>
                  <Ionicons name="construct-outline" size={50} color={colors.secondary} style={styles.lockIcon} />
                  <Text style={styles.lockedTitle}>Qaybtan waa la diyaarinayaa</Text>
                  <Text style={styles.lockedSubtitle}>
                    Wali lama furin qaybta aad ardayda kale la tartamayso. Update-ka dambe filo challenges aad u xiiso badan!
                  </Text>
                </View>
              </BlurView>
            </View>
          </View>
        )}

      </View>
    </SafeAreaView>
    </AuthGuard>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // TikTok Style Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    position: 'relative',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral,
  },
  activeTabText: {
    color: colors.secondary,
    fontWeight: '800',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 30,
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },

  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },

  // Centered Boxes for Idle/Loading/Finished
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    paddingBottom: 100, // accommodate bottom tab
  },
  idleTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.secondary,
    marginBottom: 10,
  },
  idleSubtitle: {
    fontSize: 15,
    color: colors.neutral,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  startButton: {
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: colors.border || '#333',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  generatingText: {
    marginTop: 20,
    fontSize: 15,
    color: colors.neutral,
    fontWeight: '500',
  },
  scoreText: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.primary,
    marginBottom: 10,
  },

  // Active Quiz Layout
  quizActiveContainer: {
    flex: 1,
    padding: 20,
  },
  quizHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  timerText: {
    color: '#FF4757',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
  progressBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  progressText: {
    color: colors.secondary,
    fontWeight: '700',
    fontSize: 14,
  },
  questionCard: {
    backgroundColor: colors.card,
    padding: 24,
    borderRadius: 20 ,
    borderWidth: 1,
    borderColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    marginBottom: 30,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.secondary,
    lineHeight: 30,
  },
  optionsScroll: {
    flex: 1,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card ,
    borderWidth: 1,
    borderColor: colors.border || '#333',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  optionLetterBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: colors.secondary,
    fontWeight: '600',
  },

  // Locked Others Tab
  othersBackground: {
    padding: 20,
  },
  fakeListItem: {
    height: 80,
    backgroundColor: colors.background,
    borderRadius: 16,
    marginBottom: 16,
  },
  lockedBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  lockedContent: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 30,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  lockIcon: {
    marginBottom: 16,
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.secondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  lockedSubtitle: {
    fontSize: 15,
    color: colors.neutral,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
  }
});
