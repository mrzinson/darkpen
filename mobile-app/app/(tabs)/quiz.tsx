import { useTheme } from '../../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { AuthGuard } from '../../components/AuthGuard';

const { width } = Dimensions.get('window');

import Config from '../../constants/Config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function QuizScreen() {
  const { colors, isDark, setTheme, theme, language } = useTheme();
  const styles = getStyles(colors, isDark);

  const [activeTab, setActiveTab] = useState<'ai' | 'others'>('ai');

  // Quiz State
  const [quizState, setQuizState] = useState<'idle' | 'generating' | 'active' | 'finished'>('idle');
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds

  // XP & Leaderboard State
  const [submittingScore, setSubmittingScore] = useState(false);
  const [xpEarned, setXpEarned] = useState<number | null>(null);
  const [newTotalXp, setNewTotalXp] = useState<number | null>(null);

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userXp, setUserXp] = useState<number | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  useEffect(() => {
    let timer: any;
    if (quizState === 'active' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && quizState === 'active') {
      finishQuiz();
    }
    return () => clearInterval(timer);
  }, [quizState, timeLeft]);

  useEffect(() => {
    if (activeTab === 'others') {
      fetchLeaderboard();
    }
  }, [activeTab]);

  // Actions
  const handleStartQuiz = async () => {
    setQuizState('generating');
    setXpEarned(null);
    setNewTotalXp(null);
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
    const nextScore = isCorrect ? score + 1 : score;
    if (isCorrect) setScore(prev => prev + 1);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      finishQuiz(nextScore);
    }
  };

  const finishQuiz = async (finalScore = score) => {
    setQuizState('finished');
    setSubmittingScore(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/chat/quiz/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ score: finalScore })
      });
      const data = await response.json();
      if (response.ok) {
        setXpEarned(data.xp_earned);
        setNewTotalXp(data.new_total_xp);
      }
    } catch (err) {
      console.error("Error submitting score:", err);
    } finally {
      setSubmittingScore(false);
    }
  };

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/chat/quiz/leaderboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setLeaderboard(data.leaderboard || []);
        setUserRank(data.user.rank);
        setUserXp(data.user.xp);
      }
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
    } finally {
      setLoadingLeaderboard(false);
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

      {/* Header Tabs */}
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
              Leaderboard
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
                <Ionicons name="hardware-chip-outline" size={70} color={colors.primary} style={{ marginBottom: 20 }} />
                <Text style={styles.idleTitle}>Somalia Curriculum Quiz</Text>
                <Text style={styles.idleSubtitle}>
                  Baro oo ku tartam manhajka dugsiyada sare ee Soomaaliya. Ka jawaab 10 su'aalood oo random ah si aad u kasbato dhibco (XP)!
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
                <Text style={styles.generatingText}>Generating 10 custom questions from Somali textbooks...</Text>
              </View>
            )}

            {quizState === 'active' && questions.length > 0 && (
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
                    {questions[currentQuestionIndex]?.question}
                  </Text>
                </View>

                {/* Options */}
                <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
                  {questions[currentQuestionIndex]?.options.map((opt: any, idx: number) => (
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
                  style={{ marginBottom: 15 }}
                />
                <Text style={styles.idleTitle}>Natiijadaada</Text>
                <Text style={styles.scoreText}>{score} / 10</Text>

                {submittingScore ? (
                  <View style={styles.submittingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.submittingText}>Adding XP to your account...</Text>
                  </View>
                ) : (
                  <View style={styles.rewardContainer}>
                    {xpEarned !== null && (
                      <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={styles.xpBadge}>
                        <Ionicons name="flash" size={16} color="#F59E0B" style={{ marginRight: 4 }} />
                        <Text style={styles.xpText}>+{xpEarned} XP Earned!</Text>
                      </BlurView>
                    )}
                    {newTotalXp !== null && (
                      <Text style={styles.totalXpLabel}>Total Balance: {newTotalXp} XP</Text>
                    )}
                  </View>
                )}

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

        {/* --- LEADERBOARD TAB --- */}
        {activeTab === 'others' && (
          <View style={styles.tabContent}>
            
            {/* Header User Card (My Rank) */}
            <View style={styles.myRankCard}>
              <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={styles.myRankBlur}>
                <View style={styles.myRankRow}>
                  <View style={styles.rankInfo}>
                    <Text style={styles.myRankTitle}>Your Rank</Text>
                    <Text style={styles.myRankValue}>#{userRank || '--'}</Text>
                  </View>
                  <View style={styles.rankDivider} />
                  <View style={styles.rankInfo}>
                    <Text style={styles.myRankTitle}>Total Balance</Text>
                    <Text style={styles.myRankValue}>{userXp !== null ? `${userXp} XP` : '-- XP'}</Text>
                  </View>
                </View>
              </BlurView>
            </View>

            {loadingLeaderboard && leaderboard.length === 0 ? (
              <View style={styles.leaderboardCenter}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.generatingText}>Loading leaderboard...</Text>
              </View>
            ) : (
              <ScrollView style={styles.leaderboardScroll} showsVerticalScrollIndicator={false}>
                {leaderboard.map((player, idx) => {
                  const isTop3 = idx < 3;
                  const trophyColor = idx === 0 ? "#F59E0B" : idx === 1 ? "#94A3B8" : "#B45309";
                  
                  return (
                    <View key={player.id} style={styles.leaderboardItem}>
                      <View style={styles.leaderLeft}>
                        {isTop3 ? (
                          <Ionicons name="trophy" size={24} color={trophyColor} style={styles.rankTrophy} />
                        ) : (
                          <Text style={styles.rankNumber}>{idx + 1}</Text>
                        )}
                        
                        <View style={styles.avatarContainer}>
                          {player.profile_picture ? (
                            <Image source={{ uri: player.profile_picture }} style={styles.playerAvatar} />
                          ) : (
                            <View style={styles.placeholderAvatar}>
                              <Ionicons name="person" size={18} color="white" />
                            </View>
                          )}
                        </View>

                        <View style={styles.playerInfo}>
                          <Text style={styles.playerName}>{player.name}</Text>
                          <Text style={styles.playerUsername}>@{player.username}</Text>
                        </View>
                      </View>

                      <View style={styles.leaderRight}>
                        <Ionicons name="flash" size={16} color="#F59E0B" style={{ marginRight: 2 }} />
                        <Text style={styles.playerXp}>{player.xp} XP</Text>
                      </View>
                    </View>
                  );
                })}
                <View style={{ height: 40 }} />
              </ScrollView>
            )}

          </View>
        )}

      </View>
    </SafeAreaView>
    </AuthGuard>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header Tabs
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
    paddingHorizontal: 25,
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

  // Centered Boxes
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    paddingBottom: 80,
  },
  idleTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.secondary,
    textAlign: 'center',
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
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 35,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
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
    textAlign: 'center',
  },
  scoreText: {
    fontSize: 52,
    fontWeight: '900',
    color: '#3B82F6',
    marginBottom: 15,
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
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border || '#333',
  },
  progressText: {
    color: colors.secondary,
    fontWeight: '700',
    fontSize: 14,
  },
  questionCard: {
    backgroundColor: colors.card,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#EFF6FF',
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
    backgroundColor: colors.card,
    borderWidth: 1.5,
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

  // Reward section
  submittingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  submittingText: {
    fontSize: 14,
    color: colors.neutral,
  },
  rewardContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    marginBottom: 10,
  },
  xpText: {
    color: '#D97706',
    fontWeight: '800',
    fontSize: 15,
  },
  totalXpLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral,
  },

  // Leaderboard styles
  myRankCard: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  myRankBlur: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#BFDBFE',
    overflow: 'hidden',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(59, 130, 246, 0.08)',
  },
  myRankRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  rankInfo: {
    alignItems: 'center',
  },
  myRankTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  myRankValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.secondary,
  },
  rankDivider: {
    width: 1,
    height: 35,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#BFDBFE',
  },
  leaderboardCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  leaderboardScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border || '#333',
  },
  leaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.neutral,
    width: 24,
    textAlign: 'center',
    marginRight: 10,
  },
  rankTrophy: {
    width: 24,
    marginRight: 10,
    textAlign: 'center',
  },
  avatarContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    marginRight: 12,
  },
  playerAvatar: {
    width: '100%',
    height: '100%',
  },
  placeholderAvatar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.secondary,
  },
  playerUsername: {
    fontSize: 11,
    color: colors.neutral,
    marginTop: 1,
  },
  leaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerXp: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D97706',
  }
});

