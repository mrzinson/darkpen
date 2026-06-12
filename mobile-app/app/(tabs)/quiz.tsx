import { useTheme } from '../../context/ThemeContext';
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Dimensions, ActivityIndicator, Image, AppState, Alert, TextInput,
  Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { CustomBlurView as BlurView } from '../../components/CustomBlurView';
import { AuthGuard } from '../../components/AuthGuard';

const { width, height } = Dimensions.get('window');

import Config from '../../constants/Config';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Question = {
  subject: string;
  type: 'multiple-choice' | 'structured';
  question: string;
  options?: string[];
  // NOTE: 'answer' is NOT included — server sends questions without answers (security fix)
};

type QuizReviewItem = {
  question: string;
  subject: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
};

export default function QuizScreen() {
  const router = useRouter();
  const { colors, isDark, language } = useTheme();
  const styles = getStyles(colors, isDark);

  const [activeTab, setActiveTab] = useState<'ai' | 'others'>('ai');

  // Ad Settings State
  const [adSettings, setAdSettings] = useState({
    gen_ad_title: 'Dugsiga Caalamiga ah ee ZinsonAI',
    gen_ad_desc: 'Hada is-diiwaangeli oo hel waxbarasho digital ah oo bilaash ah!',
    gen_ad_btn_text: 'Baro Dheeraad',
    gen_ad_btn_route: '/manhajka',
    result_ad_title: 'Darkpen Premium Wallet',
    result_ad_desc: 'Ku shubo 100 Credits oo dheeraad ah kaliya $1 si aad u kordhiso isku-dayadaada!',
    result_ad_btn_text: 'Hada Iibso',
    result_ad_btn_route: '/billing'
  });

  // Opt-In State
  const [optedIn, setOptedIn] = useState<boolean | null>(null);
  const [optInLoading, setOptInLoading] = useState(false);
  const [tournamentActive, setTournamentActive] = useState(false);

  // Quiz Play States
  const [quizState, setQuizState] = useState<'idle' | 'generating' | 'active' | 'showing_ad' | 'finished'>('idle');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes (300 seconds)

  // Question Inputs
  const [mathAnswer, setMathAnswer] = useState('');
  const [scratchpadText, setScratchpadText] = useState('');
  const [showScratchpad, setShowScratchpad] = useState(false);

  // Security & Billing States
  const [freeAttemptsUsed, setFreeAttemptsUsed] = useState(0);
  const [userCredits, setUserCredits] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [quizCost, setQuizCost] = useState(20); // Default; updated per plan from server
  const [userPlan, setUserPlan] = useState('credits'); // 'credits' | 'monthly_3' | 'monthly_11'

  // Server-side scoring state
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [rawSubmittedAnswers, setRawSubmittedAnswers] = useState<(string | null)[]>([]);

  // Review & XP States
  const [userAnswers, setUserAnswers] = useState<QuizReviewItem[]>([]);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [xpEarned, setXpEarned] = useState<number | null>(null);
  const [newTotalXp, setNewTotalXp] = useState<number | null>(null);

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<any>('--');
  const [userXp, setUserXp] = useState<number | null>(null);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const appState = useRef(AppState.currentState);

  const renderPodiumCard = (player: any, rank: number) => {
    const isBlurred = player.is_blurred;
    
    // Choose styles based on rank
    let cardStyle = styles.podiumCard2;
    let iconName = 'star';
    let iconColor = '#E2E8F0';
    let glowStyle = {};

    if (rank === 1) {
      cardStyle = styles.podiumCard1;
      iconName = 'flame';
      iconColor = '#FFD700'; // Gold
      glowStyle = {
        shadowColor: '#FF3700',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 15,
        elevation: 10,
        borderColor: '#FFD700',
        borderWidth: 2,
        backgroundColor: '#FF3700', // Crimson/Red olol
      };
    } else if (rank === 2) {
      cardStyle = styles.podiumCard2;
      iconName = 'snow';
      iconColor = '#E2E8F0';
      glowStyle = {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
        borderColor: '#E2E8F0',
        borderWidth: 1.5,
        backgroundColor: '#3B82F6', // Blue ice
      };
    } else if (rank === 3) {
      cardStyle = styles.podiumCard3;
      iconName = 'medal';
      iconColor = '#F59E0B';
      glowStyle = {
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
        borderColor: '#34D399',
        borderWidth: 1.5,
        backgroundColor: '#059669', // Emerald green
      };
    }

    return (
      <View style={[styles.podiumCard, cardStyle, glowStyle]}>
        {/* Crown/Icon at top */}
        <View style={styles.podiumIconContainer}>
          <Ionicons name={iconName as any} size={rank === 1 ? 26 : 20} color={iconColor} />
        </View>

        {/* Avatar */}
        <View style={[styles.podiumAvatarContainer, rank === 1 && { width: 64, height: 64, borderRadius: 32 }]}>
          {player.profile_picture && !isBlurred ? (
            <Image source={{ uri: player.profile_picture }} style={styles.podiumAvatar} />
          ) : (
            <View style={styles.podiumPlaceholderAvatar}>
              <Ionicons name={isBlurred ? "lock-closed" : "person"} size={rank === 1 ? 24 : 18} color="white" />
            </View>
          )}
        </View>

        {/* Name / Handle */}
        <View style={styles.podiumTextContainer}>
          <Text style={styles.podiumName} numberOfLines={1}>
            {player.name}
          </Text>
          <Text style={styles.podiumUsername} numberOfLines={1}>
            {isBlurred ? '@hidden' : `@${player.username}`}
          </Text>
        </View>

        {/* XP Points */}
        <View style={[styles.podiumXpBadge, rank === 1 && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
          <Ionicons name="flash" size={12} color="#FFD700" />
          <Text style={styles.podiumXpText}>
            {isBlurred ? '••••' : player.xp} XP
          </Text>
        </View>

        {/* Rank Badge */}
        <View style={[styles.podiumRankBadge, rank === 1 && { backgroundColor: '#FFD700' }]}>
          <Text style={[styles.podiumRankText, rank === 1 && { color: '#000', fontWeight: '900' }]}>
            {rank}
          </Text>
        </View>
      </View>
    );
  };

  // 1. Fetch user enrollment & wallet stats
  const fetchStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      
      const resStatus = await fetch(`${Config.API_URL}/api/chat/quiz/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resStatus.json();

      if (resStatus.ok) {
        setOptedIn(!!data.opted_in);
        setFreeAttemptsUsed(data.free_attempts_used || 0);
        setUserCredits(data.user_credits || 0);
        setLockoutSeconds(data.lockout_seconds || 0);
        setTournamentActive(!!data.tournament_active);
        // Update plan-based quiz cost (fair pricing per plan)
        if (data.quiz_cost) setQuizCost(data.quiz_cost);
        if (data.user_plan) setUserPlan(data.user_plan);

        // Cache these status values to bypass blocking loading screens
        await AsyncStorage.setItem('quiz_opted_in', String(!!data.opted_in));
        await AsyncStorage.setItem('quiz_tournament_active', String(!!data.tournament_active));
        
        // Sync dynamic ad settings if they exist
        setAdSettings({
          gen_ad_title: data.gen_ad_title || 'Dugsiga Caalamiga ah ee ZinsonAI',
          gen_ad_desc: data.gen_ad_desc || 'Hada is-diiwaangeli oo hel waxbarasho digital ah oo bilaash ah!',
          gen_ad_btn_text: data.gen_ad_btn_text || 'Baro Dheeraad',
          gen_ad_btn_route: data.gen_ad_btn_route || '/manhajka',
          result_ad_title: data.result_ad_title || 'Darkpen Premium Wallet',
          result_ad_desc: data.result_ad_desc || 'Ku shubo 100 Credits oo dheeraad ah kaliya $1 si aad u kordhiso isku-dayadaada!',
          result_ad_btn_text: data.result_ad_btn_text || 'Hada Iibso',
          result_ad_btn_route: data.result_ad_btn_route || '/billing'
        });
      } else {
        setOptedIn(false);
      }
    } catch (err) {
      console.error("Status fetch error:", err);
      setOptedIn(false);
    }
  };

  // Fetch status on mount and on quiz state change
  useEffect(() => {
    fetchStatus();
  }, [quizState]);

  const renderPrizeBreakdown = () => (
    <View style={styles.prizeCard}>
      <View style={styles.prizeHeaderRow}>
        <Ionicons name="gift-outline" size={20} color="#FFD700" />
        <Text style={styles.prizeHeaderTitle}>ABAAL-MARINADA TARTANKA ($2,800 Pool)</Text>
      </View>
      <Text style={styles.prizeSubtitle}>
        Ka qayb gal tartanka 100-ka casho soconaya. Abaal-marinaha waxay u kala baxayaan 10-ka arday ee ugu dhibcaha (XP) badan dalka sida tan:
      </Text>
      
      <View style={styles.prizeRow}>
        <Text style={styles.prizeLabel}>🥇 Kaalinta 1-aad:</Text>
        <Text style={styles.prizeValue}>$1,000</Text>
      </View>
      <View style={styles.prizeRow}>
        <Text style={styles.prizeLabel}>🥈 Kaalinta 2-aad:</Text>
        <Text style={styles.prizeValue}>$800</Text>
      </View>
      <View style={styles.prizeRow}>
        <Text style={styles.prizeLabel}>🥉 Kaalinta 3-aad:</Text>
        <Text style={styles.prizeValue}>$500</Text>
      </View>
      <View style={styles.prizeRow}>
        <Text style={styles.prizeLabel}>🏅 Kaalinta 4-aad - 6-aad:</Text>
        <Text style={styles.prizeValue}>$100 (midkiiba)</Text>
      </View>
      <View style={styles.prizeRow}>
        <Text style={styles.prizeLabel}>🎗️ Kaalinta 7-aad - 10-aad:</Text>
        <Text style={styles.prizeValue}>$50 (midkiiba)</Text>
      </View>
      
      <View style={styles.prizeFooter}>
        <Ionicons name="information-circle-outline" size={14} color="#3B82F6" style={{ marginRight: 6 }} />
        <Text style={styles.prizeFooterText}>Tartanku wuxuu soconayaa muddo 100 maalmood ah.</Text>
      </View>
    </View>
  );

  // 2. Lockout Countdown Timer
  useEffect(() => {
    let interval: any;
    if (lockoutSeconds > 0) {
      interval = setInterval(() => {
        setLockoutSeconds(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // 3. Quiz Game Timer
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

  // 4. Leaderboard Sync
  useEffect(() => {
    if (activeTab === 'others') {
      fetchLeaderboard();
    }
  }, [activeTab]);

  // 5. Anti-Cheat: App State minimizing penalty listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/active/) &&
        nextAppState.match(/inactive|background/) &&
        quizState === 'active'
      ) {
        console.log('User minimized the app! Triggering exit penalty of 0 score.');
        triggerExitPenalty();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [quizState]);

  const triggerExitPenalty = () => {
    setQuestions([]);
    finishQuiz(0, true);
    Alert.alert(
      'Fiiro Gaar Ah (Anti-Cheat)',
      'Waan ka xunnahay! Sababtoo ah waxaad ka baxday app-ka inta uu imtixaanku socday, natiijadaada maanta waxaa loo xisaabiyey 0 XP.'
    );
  };

  // Opt-In Trigger
  const handleOptIn = async () => {
    setOptInLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/chat/quiz/opt-in`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setOptedIn(true);
        Alert.alert('Si Guul Leh', 'Waxaad si guul leh ugu biirtay Tartanka Qaran ee Billaha ah!');
      } else {
        Alert.alert('Cilad', 'Ma suurtagelin in lagu biiriyo tartanka hadda.');
      }
    } catch (err) {
      Alert.alert('Cilad Network', 'Fadlan hubi xiriirka internet-kaaga.');
    } finally {
      setOptInLoading(false);
    }
  };

  // Start Quiz (Deducts plan-based credits if attempts >= 5)
  const handleStartQuiz = async () => {
    setQuizState('generating');
    setXpEarned(null);
    setNewTotalXp(null);
    setUserAnswers([]);
    setRawSubmittedAnswers([]);
    setSessionToken(null);
    setMathAnswer('');
    setScratchpadText('');
    setShowScratchpad(false);

    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/chat/quiz/generate`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await response.json();

      if (response.ok && data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setSessionToken(data.session_token); // Store session token for server-side scoring
        setScore(0);
        setCurrentQuestionIndex(0);
        setTimeLeft(300);
        setQuizState('active');
      } else if (response.status === 402) {
        Alert.alert('Credits Ku Filan Ma Haysatid', data.message);
        setQuizState('idle');
      } else if (response.status === 400 && data.status === 'locked') {
        setLockoutSeconds(data.seconds_remaining);
        setQuizState('idle');
      } else {
        Alert.alert('Cilad', data.message || "Xog ku filan oo su'aalo laga sameeyo lama helin.");
        setQuizState('idle');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Cilad', "Cilad ayaa dhacday soo saarista su'aalaha.");
      setQuizState('idle');
    }
  };

  const finishQuiz = async (finalScore = score, cheatDetected = false) => {
    setQuizState('finished');
    setSubmittingScore(true);
    try {
      const token = await AsyncStorage.getItem('userToken');

      // SECURITY FIX: Send session_token + raw answers to server.
      // Server verifies answers against stored quiz and calculates score.
      // If cheat detected (app minimized), send all nulls so server scores 0.
      const answersToSubmit = cheatDetected
        ? new Array(questions.length).fill(null)
        : rawSubmittedAnswers;

      const response = await fetch(`${Config.API_URL}/api/chat/quiz/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          session_token: sessionToken,
          answers: answersToSubmit
        })
      });
      const data = await response.json();
      if (response.ok) {
        setScore(data.score); // Use server-verified score
        setXpEarned(data.xp_earned);
        setNewTotalXp(data.new_total_xp);
      }
    } catch (err) {
      console.error("Error submitting score:", err);
    } finally {
      setSubmittingScore(false);
    }
  };

  // Ads monetization block before results
  const showAdAndFinish = (finalScore: number) => {
    setQuizState('showing_ad');
    setTimeout(() => {
      finishQuiz(finalScore);
    }, 5000); // 5 seconds ad display
  };

  // Submit Answer
  // NOTE: We no longer check correctness client-side (answers not sent by server).
  // We store the raw selected answer and send all answers to server on finish.
  const handleAnswerSubmit = (selected: string, isMath = false) => {
    const currentQ = questions[currentQuestionIndex];

    // Store the raw answer for server scoring
    setRawSubmittedAnswers(prev => {
      const updated = [...prev];
      updated[currentQuestionIndex] = selected;
      return updated;
    });

    // Record for local review display (without correct answer — server returns that after submit)
    const reviewItem: QuizReviewItem = {
      question: currentQ.question,
      subject: currentQ.subject,
      selectedAnswer: selected,
      correctAnswer: '...', // Will not know until server responds
      isCorrect: false      // Placeholder; server determines correctness
    };

    setUserAnswers(prev => [...prev, reviewItem]);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setMathAnswer('');
    } else {
      showAdAndFinish(score);
    }
  };

  const resetQuiz = () => {
    setQuizState('idle');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setScore(0);
    setXpEarned(null);
    setNewTotalXp(null);
    setUserAnswers([]);
  };

  const handleAdPress = (route: string) => {
    if (!route) return;
    try {
      if (route.startsWith('http')) {
        Linking.openURL(route).catch(err => console.error("Failed to open URL:", err));
      } else {
        router.push(route as any);
      }
    } catch (err) {
      console.error("Ad press error:", err);
    }
  };

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/chat/quiz/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` }
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatLockoutTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${hours} saac, ${minutes} daqiiqo iyo ${seconds} ilbiriqsi`;
  };

  if (optedIn === null) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.generatingText}>Checking tournament status...</Text>
      </View>
    );
  }

  return (
    <AuthGuard>
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* HEADER SECTION (Matching app's design system) */}
      <View style={styles.headerSection}>
        <View style={styles.headerTitles}>
          <Text style={styles.mainTitle}>QUIZ CHALLENGE</Text>
          <Text style={styles.subTitle}>Waa meel aad kula tartamayso ardayda kale.</Text>
        </View>

        {/* Segmented Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'ai' && styles.tabButtonActive]}
            onPress={() => setActiveTab('ai')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'ai' && styles.activeTabText]}>
              AI Challenge
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'others' && styles.tabButtonActive]}
            onPress={() => setActiveTab('others')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'others' && styles.activeTabText]}>
              Leaderboard
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>

        {/* --- LEADERBOARD TAB --- */}
        {activeTab === 'others' && (
          <View style={styles.tabContent}>
            
            {/* Header User Card (My Rank) */}
            <View style={styles.myRankCard}>
              <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={styles.myRankBlur}>
                <View style={styles.myRankRow}>
                  <View style={styles.rankInfo}>
                    <Text style={styles.myRankTitle}>Your Rank</Text>
                    <Text style={styles.myRankValue}>#{userRank}</Text>
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
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.generatingText}>Loading leaderboard...</Text>
              </View>
            ) : (
              <ScrollView style={styles.leaderboardScroll} showsVerticalScrollIndicator={false}>
                {leaderboard.length > 0 && (
                  <View style={styles.podiumContainer}>
                    {/* 2nd Place */}
                    {leaderboard[1] ? renderPodiumCard(leaderboard[1], 2) : <View style={styles.podiumCardEmpty} />}
                    
                    {/* 1st Place */}
                    {leaderboard[0] ? renderPodiumCard(leaderboard[0], 1) : <View style={styles.podiumCardEmpty} />}
                    
                    {/* 3rd Place */}
                    {leaderboard[2] ? renderPodiumCard(leaderboard[2], 3) : <View style={styles.podiumCardEmpty} />}
                  </View>
                )}

                {/* Remaining Contestants */}
                {leaderboard.slice(3).map((player, idx) => {
                  const actualRank = idx + 4;
                  return (
                    <View key={player.id || idx} style={styles.leaderboardItem}>
                      <View style={styles.leaderLeft}>
                        <Text style={styles.rankNumber}>{actualRank}</Text>
                        
                        <View style={styles.avatarContainer}>
                          {player.profile_picture && !player.is_blurred ? (
                            <Image source={{ uri: player.profile_picture }} style={styles.playerAvatar} />
                          ) : (
                            <View style={[styles.placeholderAvatar, player.is_blurred && { backgroundColor: '#9CA3AF' }]}>
                              <Ionicons name={player.is_blurred ? "lock-closed" : "person"} size={18} color="white" />
                            </View>
                          )}
                        </View>

                        <View style={styles.playerInfo}>
                          {player.is_blurred ? (
                            <View style={{ paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={[styles.playerName, { color: colors.neutral }]}>Contestant {actualRank}</Text>
                              <Text style={styles.playerUsername}>@hidden</Text>
                            </View>
                          ) : (
                            <>
                              <Text style={styles.playerName}>{player.name}</Text>
                              <Text style={styles.playerUsername}>@{player.username}</Text>
                            </>
                          )}
                        </View>
                      </View>

                      <View style={styles.leaderRight}>
                        <Ionicons name="flash" size={16} color="#F59E0B" style={{ marginRight: 2 }} />
                        <Text style={styles.playerXp}>
                          {player.is_blurred ? '••••' : player.xp} XP
                        </Text>
                      </View>
                    </View>
                  );
                })}
                <View style={{ height: 40 }} />
              </ScrollView>
            )}

          </View>
        )}

        {/* --- AI CHALLENGE TAB --- */}
        {activeTab === 'ai' && (
          <View style={styles.tabContent}>

            {/* --- CASE 1: TOURNAMENT NOT STARTED YET --- */}
            {!tournamentActive && quizState === 'idle' && (
              <ScrollView contentContainerStyle={styles.welcomeScroll}>
                <View style={styles.centerBoxWelcome}>
                  <Ionicons name="time-outline" size={80} color="#F59E0B" style={{ marginBottom: 20 }} />
                  <Text style={styles.idleTitle}>TARTANKA BILAHA AH</Text>
                  
                  {!optedIn ? (
                    <>
                      <Text style={styles.registrationText}>
                        Wali tartanku si rasmi ah uma bilaabman. Fadlan isa sii diwaangeli hadda si aad ula tartanto kumanaan arday marka uu tartanku si toos ah u bilowdo!
                      </Text>
                      <TouchableOpacity style={[styles.optInButton, { width: '90%', alignSelf: 'center', marginBottom: 30 }]} onPress={handleOptIn} disabled={optInLoading}>
                        {optInLoading ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <>
                            <Ionicons name="person-add-outline" size={20} color="white" style={{ marginRight: 8 }} />
                            <Text style={styles.optInButtonText}>ISA SII DIWAANGELI (REGISTER)</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={styles.registeredCard}>
                      <Ionicons name="checkmark-circle-outline" size={36} color="#10B981" style={{ marginBottom: 10 }} />
                      <Text style={styles.registeredTitle}>Waad is-diwaangelisay!</Text>
                      <Text style={styles.registeredSubtitle}>
                        Sug inta uu tartanku si rasmi ah uga bilaabmayo. Admin-ka ayaa dhowaan bilaabi doona tartanka marka ay arday badani is-diiwaangeliyaan.
                      </Text>
                    </View>
                  )}

                  {renderPrizeBreakdown()}

                  {/* Rules list */}
                  <View style={styles.rulesList}>
                    <Text style={styles.rulesHeader}>QAYBAHA AMNIGA & XEERARKA TARTANKA</Text>

                    <View style={styles.ruleItem}>
                      <Ionicons name="alarm-outline" size={20} color="#3B82F6" style={styles.ruleIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ruleTitle}>1 isku-day maalinkii</Text>
                        <Text style={styles.ruleDesc}>Maalintii hal mar oo kaliya ayaad tartami kartaa 24-kii saacba mar.</Text>
                      </View>
                    </View>

                    <View style={styles.ruleItem}>
                      <Ionicons name="eye-off-outline" size={20} color="#EF4444" style={styles.ruleIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ruleTitle}>Exit Penalty (Digniin Adag)</Text>
                        <Text style={styles.ruleDesc}>Haddii aad ka baxdo app-ka, minimayso, ama screen-ka xirato adoo ku dhex jira imtixaanka, score-kaagu wuxuu noqonayaa 0 XP isla markiiba!</Text>
                      </View>
                    </View>

                    <View style={styles.ruleItem}>
                      <Ionicons name="shield-checkmark-outline" size={20} color="#10B981" style={styles.ruleIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ruleTitle}>10 Subjects (Maadooyinka Manhajka)</Text>
                        <Text style={styles.ruleDesc}>Imtixaanku wuxuu ka kooban yahay 10 maado oo luuqadaha saxda ah lagu dhigto (e.g. Tarbiya & Arabic: Arabic; Science & Maths: English).</Text>
                      </View>
                    </View>

                    <View style={styles.ruleItem}>
                      <Ionicons name="card-outline" size={20} color="#F59E0B" style={styles.ruleIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ruleTitle}>Tijaabo (5 Days Free Trial)</Text>
                        <Text style={styles.ruleDesc}>Shanta isku-day ee hore waa free. Ka dib, waxaa lagaa jarayaa {quizCost} credits halkii isku-day (~$0.10 — isku-faa'ido dhammaan qorshayaasha).</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* --- CASE 2: TOURNAMENT IS ACTIVE BUT USER NOT OPTED IN --- */}
            {tournamentActive && !optedIn && quizState === 'idle' && (
              <ScrollView contentContainerStyle={styles.welcomeScroll}>
                <View style={styles.centerBoxWelcome}>
                  <Ionicons name="trophy" size={80} color="#F59E0B" style={{ marginBottom: 20 }} />
                  <Text style={styles.optInTitle}>TARTANKA BILAHA AH</Text>
                  <Text style={styles.optInText}>
                    Qofkii muddo 30days ugu sareeyaa 3da kaalmood ee sare wuxuu heli doonaa abaal marin fiican.
                  </Text>

                  <TouchableOpacity style={styles.optInButton} onPress={handleOptIn} disabled={optInLoading}>
                    {optInLoading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Ionicons name="trophy-outline" size={20} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.optInButtonText}>JOIN TOURNAMENT (KU BIIR)</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.optInLaterButton} onPress={() => setOptedIn(true)}>
                    <Text style={styles.optInLaterText}>Practice Only (Kaliya Tababar)</Text>
                  </TouchableOpacity>

                  {renderPrizeBreakdown()}
                </View>
              </ScrollView>
            )}

            {/* --- CASE 3: TOURNAMENT ACTIVE & USER OPTED IN (PLAY SCREEN) --- */}
            {tournamentActive && optedIn && quizState === 'idle' && (
              <ScrollView contentContainerStyle={styles.welcomeScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.centerBoxWelcome}>
                  
                  {/* Premium Hero Card */}
                  <View style={[styles.tournamentHeroCard, { backgroundColor: isDark ? '#1E293B' : '#3B82F6' }]}>
                    <View style={styles.tournamentHeroHeader}>
                      <Text style={styles.tournamentHeroTitle}>TARTANKA QARAN</Text>
                      <View style={styles.tournamentHeroBadge}>
                        <Text style={styles.tournamentHeroBadgeText}>LIVE 🏆</Text>
                      </View>
                    </View>
                    
                    <Text style={styles.tournamentHeroDesc}>
                      U tartan maadooyinka manhajka dugsiga sare maalin kasta si aad u kasbato dhibcaha (XP) oo aad u gasho kaalmaha hore ee dalka!
                    </Text>

                    <View style={styles.tournamentBalanceRow}>
                      <Ionicons name="card" size={16} color="#FFD700" />
                      <Text style={styles.tournamentBalanceText}>Wallet: {userCredits} Credits</Text>
                    </View>
                  </View>

                  {/* 24h Lockout Warning or Start Button */}
                  {lockoutSeconds > 0 ? (
                    <View style={styles.lockoutCard}>
                      <Ionicons name="lock-closed" size={32} color="#EF4444" style={{ marginBottom: 10 }} />
                      <Text style={styles.lockoutTitle}>Waa laguu xiray maanta!</Text>
                      <Text style={styles.lockoutSubtitle}>
                        Si loo ilaaliyo caddaaladda tartanka, waxaa kuu bannaan hal isku-day oo keliya 24-kii saacba mar. Waxaa kuu dhiman:
                      </Text>
                      <Text style={styles.lockoutCountdown}>{formatLockoutTime(lockoutSeconds)}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.startButton, userCredits < quizCost && freeAttemptsUsed >= 5 && styles.startButtonDisabled]}
                      onPress={handleStartQuiz}
                      activeOpacity={0.8}
                      disabled={userCredits < quizCost && freeAttemptsUsed >= 5}
                    >
                      <Text style={styles.startButtonText}>Start Quiz Challenge</Text>
                      <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                  )}

                  {renderPrizeBreakdown()}

                  {/* Rules list */}
                  <View style={styles.rulesList}>
                    <Text style={styles.rulesHeader}>QAYBAHA AMNIGA & XEERARKA TARTANKA</Text>

                    <View style={styles.ruleItem}>
                      <Ionicons name="alarm-outline" size={20} color="#3B82F6" style={styles.ruleIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ruleTitle}>1 isku-day maalinkii</Text>
                        <Text style={styles.ruleDesc}>Maalintii hal mar oo kaliya ayaad tartami kartaa 24-kii saacba mar.</Text>
                      </View>
                    </View>

                    <View style={styles.ruleItem}>
                      <Ionicons name="eye-off-outline" size={20} color="#EF4444" style={styles.ruleIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ruleTitle}>Exit Penalty (Digniin Adag)</Text>
                        <Text style={styles.ruleDesc}>Haddii aad ka baxdo app-ka, minimayso, ama screen-ka xirato adoo ku dhex jira imtixaanka, score-kaagu wuxuu noqonayaa 0 XP isla markiiba!</Text>
                      </View>
                    </View>

                    <View style={styles.ruleItem}>
                      <Ionicons name="shield-checkmark-outline" size={20} color="#10B981" style={styles.ruleIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ruleTitle}>10 Subjects (Maadooyinka Manhajka)</Text>
                        <Text style={styles.ruleDesc}>Imtixaanku wuxuu ka kooban yahay 10 maado oo luuqadaha saxda ah lagu dhigto (e.g. Tarbiya & Arabic: Arabic; Science & Maths: English).</Text>
                      </View>
                    </View>

                    <View style={styles.ruleItem}>
                      <Ionicons name="card-outline" size={20} color="#F59E0B" style={styles.ruleIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ruleTitle}>Tijaabo (5 Days Free Trial)</Text>
                        <Text style={styles.ruleDesc}>Shanta isku-day ee hore waa free. Ka dib, waxaa lagaa jarayaa {quizCost} credits halkii isku-day (qorshahaagu ahaanshaha {userPlan === 'monthly_11' ? 'Premium' : userPlan === 'monthly_3' ? 'Basic' : 'Pay as you go'} — dhammaan users-ka isku-faa'ido ayay bixiyaan ~$0.10 halkii isku-day).</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* --- QUESTIONS INGESTION LOADING (AD BANNER MOCKUP) --- */}
            {quizState === 'generating' && (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.generatingText}>Generating curriculum questions...</Text>
                
                {/* Premium Ad Banner Mockup */}
                <View style={styles.adBannerCard}>
                  <View style={styles.adBadgeRow}>
                    <Text style={styles.adBadge}>AD BY GOOGLE AD SENSE</Text>
                  </View>
                  <Ionicons name="school" size={42} color="#3B82F6" style={{ marginVertical: 10 }} />
                  <Text style={styles.adTitle}>{adSettings.gen_ad_title}</Text>
                  <Text style={styles.adDescription}>{adSettings.gen_ad_desc}</Text>
                  {adSettings.gen_ad_btn_text ? (
                    <TouchableOpacity 
                      style={styles.adButton} 
                      onPress={() => handleAdPress(adSettings.gen_ad_btn_route)}
                    >
                      <Text style={styles.adButtonText}>{adSettings.gen_ad_btn_text}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )}

            {/* --- AD BANNER TRANSITION BEFORE FINISHING --- */}
            {quizState === 'showing_ad' && (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.generatingText}>Evaluating your answers & calculating XP...</Text>
                
                {/* Premium Results Ad Banner Mockup */}
                <View style={styles.adBannerCard}>
                  <View style={styles.adBadgeRow}>
                    <Text style={styles.adBadge}>MONETIZED TOURNAMENT SPONSOR</Text>
                  </View>
                  <Ionicons name="flash" size={42} color="#F59E0B" style={{ marginVertical: 10 }} />
                  <Text style={styles.adTitle}>{adSettings.result_ad_title}</Text>
                  <Text style={styles.adDescription}>{adSettings.result_ad_desc}</Text>
                  {adSettings.result_ad_btn_text ? (
                    <TouchableOpacity 
                      style={[styles.adButton, { backgroundColor: '#F59E0B' }]}
                      onPress={() => handleAdPress(adSettings.result_ad_btn_route)}
                    >
                      <Text style={styles.adButtonText}>{adSettings.result_ad_btn_text}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )}

            {/* --- ACTIVE QUIZ PLAY SCREEN --- */}
            {quizState === 'active' && questions.length > 0 && (
              <View style={styles.quizActiveContainer}>
                {/* Quiz Header Info */}
                <View style={styles.quizHeaderRow}>
                  <View style={styles.timerBadge}>
                    <Ionicons name="time-outline" size={18} color="#FF4757" />
                    <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                  </View>
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectText}>{questions[currentQuestionIndex]?.subject.toUpperCase()}</Text>
                  </View>
                  <View style={styles.progressBadge}>
                    <Text style={styles.progressText}>{currentQuestionIndex + 1} / 10</Text>
                  </View>
                </View>

                {/* Question Text */}
                <View style={styles.questionCard}>
                  <Text style={styles.questionText}>
                    {questions[currentQuestionIndex]?.question}
                  </Text>
                </View>

                {/* Structured Math Input or Multiple Choice Option list */}
                {questions[currentQuestionIndex]?.type === 'structured' ? (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mathInputLabel}>Qor jawaabtaada xisaabeed (structured answer):</Text>
                    <View style={styles.mathInputWrapper}>
                      <TextInput
                        style={styles.mathTextInput}
                        placeholder="Qor tiro ama jawaab kooban..."
                        placeholderTextColor="#9CA3AF"
                        value={mathAnswer}
                        onChangeText={setMathAnswer}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity 
                        style={styles.mathSubmitBtn}
                        onPress={() => handleAnswerSubmit(mathAnswer, true)}
                      >
                        <Text style={styles.mathSubmitBtnText}>Gudbi</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Math scratchpad / calculation area */}
                    <TouchableOpacity
                      style={styles.scratchpadToggle}
                      onPress={() => setShowScratchpad(!showScratchpad)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="create-outline" size={18} color="#3B82F6" style={{ marginRight: 6 }} />
                      <Text style={styles.scratchpadToggleText}>
                        {showScratchpad ? 'Qari meesha lagaga shaqeynayo' : 'Fur meesha lagaga shaqeynayo (Scratchpad)'}
                      </Text>
                    </TouchableOpacity>

                    {showScratchpad && (
                      <View style={styles.scratchpadCard}>
                        <Text style={styles.scratchpadTitle}>Calculation Area / Meesha lagaga shaqeynayo:</Text>
                        <TextInput
                          style={styles.scratchpadInput}
                          placeholder="Ku qor workings-kaaga ama xisaabintaada halkan..."
                          placeholderTextColor="#9CA3AF"
                          multiline={true}
                          value={scratchpadText}
                          onChangeText={setScratchpadText}
                        />
                        <TouchableOpacity style={styles.scratchpadClear} onPress={() => setScratchpadText('')}>
                          <Text style={styles.scratchpadClearText}>Nadiifi</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : (
                  <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
                    {questions[currentQuestionIndex]?.options?.map((opt: string, idx: number) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.optionButton}
                        onPress={() => handleAnswerSubmit(opt)}
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
                )}
              </View>
            )}

            {/* --- DETAILED QUESTION REVIEW FINISHED SCREEN --- */}
            {quizState === 'finished' && (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                <View style={styles.centerBoxFinished}>
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
                      <ActivityIndicator size="small" color="#3B82F6" />
                      <Text style={styles.submittingText}>Adding XP to your account...</Text>
                    </View>
                  ) : (
                    <View style={styles.rewardContainer}>
                      {xpEarned !== null && xpEarned > 0 ? (
                        <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={styles.xpBadge}>
                          <Ionicons name="flash" size={16} color="#F59E0B" style={{ marginRight: 4 }} />
                          <Text style={styles.xpText}>+{xpEarned} XP Earned!</Text>
                        </BlurView>
                      ) : (
                        <Text style={styles.totalXpLabel}>Practice complete. No XP rewarded.</Text>
                      )}
                      {newTotalXp !== null && (
                        <Text style={styles.totalXpLabel}>Total Balance: {newTotalXp} XP</Text>
                      )}
                    </View>
                  )}

                  {/* Detailed review segment */}
                  <Text style={styles.reviewHeader}>DIB-U-EEGISTA SU'AALAHA (REVIEW)</Text>
                  
                  <View style={styles.reviewList}>
                    {userAnswers.map((ans, idx) => (
                      <View key={idx} style={styles.reviewItemCard}>
                        <View style={styles.reviewItemHeader}>
                          <Text style={styles.reviewSubject}>{ans.subject.toUpperCase()}</Text>
                          <Ionicons 
                            name={ans.isCorrect ? "checkmark-circle" : "close-circle"} 
                            size={20} 
                            color={ans.isCorrect ? "#10B981" : "#EF4444"} 
                          />
                        </View>
                        <Text style={styles.reviewQuestionText}>{idx + 1}. {ans.question}</Text>
                        
                        <View style={styles.reviewAnswersBox}>
                          <Text style={[styles.reviewAnswerLabel, ans.isCorrect ? { color: '#10B981' } : { color: '#EF4444' }]}>
                            Jawaabtaada: {ans.selectedAnswer || '(Eber)'}
                          </Text>
                          {!ans.isCorrect && (
                            <Text style={[styles.reviewAnswerLabel, { color: '#3B82F6', marginTop: 4 }]}>
                              Jawaabta Saxda ah: {ans.correctAnswer}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity style={styles.startButton} onPress={resetQuiz} activeOpacity={0.8}>
                    <Ionicons name="refresh" size={20} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.startButtonText}>Try Again</Text>
                  </TouchableOpacity>
                  <View style={{ height: 40 }} />
                </View>
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
  headerSection: {
    paddingHorizontal: 24,
    backgroundColor: colors.background,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitles: {
    marginBottom: 20,
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#161B22' : 'rgba(59, 130, 246, 0.08)',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1.5,
    borderColor: isDark ? '#1E293B' : '#BFDBFE',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: isDark ? '#1E293B' : '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: isDark ? '#A0AEC0' : '#2563EB',
  },
  activeTabText: {
    color: isDark ? '#FFFFFF' : '#FFFFFF',
    fontWeight: '800',
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
  centerBoxFinished: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  centerBoxWelcome: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  optInScrollContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  flagRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  flag: {
    fontSize: 48,
  },
  optInTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#D97706',
    textAlign: 'center',
    marginBottom: 15,
    letterSpacing: 1.5,
  },
  optInText: {
    fontSize: 15,
    color: colors.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    fontWeight: '500',
  },
  optInButton: {
    backgroundColor: '#D97706',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 30,
    width: '100%',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  optInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  optInLaterButton: {
    marginTop: 20,
    padding: 10,
  },
  optInLaterText: {
    fontSize: 14,
    color: colors.neutral,
    fontWeight: '600',
  },

  welcomeScroll: {
    flexGrow: 1,
  },
  idleTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 6,
  },
  registrationText: {
    fontSize: 14,
    color: colors.neutral,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 15,
  },
  registeredCard: {
    width: '90%',
    backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
    borderWidth: 1,
    borderColor: isDark ? '#374151' : '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  registeredTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: isDark ? '#10B981' : '#059669',
    marginBottom: 4,
  },
  registeredSubtitle: {
    fontSize: 13,
    color: colors.neutral,
    textAlign: 'center',
    lineHeight: 18,
  },
  walletBalanceText: {
    fontSize: 14,
    color: '#D97706',
    fontWeight: '700',
    marginBottom: 25,
  },
  lockoutCard: {
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#FCA5A5',
    padding: 20,
    alignItems: 'center',
    width: '100%',
    marginBottom: 25,
  },
  lockoutTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#EF4444',
    marginBottom: 6,
  },
  lockoutSubtitle: {
    fontSize: 13,
    color: isDark ? '#CBD5E1' : '#7F1D1D',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  lockoutCountdown: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.secondary,
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
    marginBottom: 30,
  },
  startButtonDisabled: {
    backgroundColor: '#9CA3AF',
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
    fontWeight: '600',
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
  subjectBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  subjectText: {
    color: '#3B82F6',
    fontWeight: '800',
    fontSize: 13,
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

  // Math structured layout
  mathInputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral,
    marginBottom: 10,
  },
  mathInputWrapper: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  mathTextInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border || '#333',
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.secondary,
    height: 52,
  },
  mathSubmitBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    height: 52,
  },
  mathSubmitBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  scratchpadToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 10,
  },
  scratchpadToggleText: {
    color: '#3B82F6',
    fontWeight: '700',
    fontSize: 14,
  },
  scratchpadCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border || '#333',
    padding: 16,
  },
  scratchpadTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral,
    marginBottom: 10,
  },
  scratchpadInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: colors.secondary,
    height: 120,
    textAlignVertical: 'top',
  },
  scratchpadClear: {
    alignSelf: 'flex-end',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  },
  scratchpadClearText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },

  // Rules list
  rulesList: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border || '#333',
    padding: 20,
  },
  rulesHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: 0.5,
    marginBottom: 15,
    textAlign: 'center',
  },
  ruleItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  ruleIcon: {
    marginTop: 2,
  },
  ruleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.secondary,
    marginBottom: 2,
  },
  ruleDesc: {
    fontSize: 12,
    color: colors.neutral,
    lineHeight: 16,
  },

  // Ad banner card
  adBannerCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border || '#d4dce9',
    padding: 20,
    alignItems: 'center',
    marginTop: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  adBadgeRow: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 10,
  },
  adBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4B5563',
  },
  adTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.secondary,
    marginBottom: 4,
  },
  adDescription: {
    fontSize: 12,
    color: colors.neutral,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 15,
  },
  adButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  adButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
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

  // Review List Styles
  reviewHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 15,
  },
  reviewList: {
    width: '100%',
    gap: 12,
    marginBottom: 30,
  },
  reviewItemCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border || '#333',
    padding: 16,
  },
  reviewItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewSubject: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3B82F6',
  },
  reviewQuestionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  reviewAnswersBox: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 10,
  },
  reviewAnswerLabel: {
    fontSize: 12,
    fontWeight: '600',
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
  },
  // Podium styles for Top 3
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 20,
    marginBottom: 25,
  },
  podiumCard: {
    flex: 1,
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    position: 'relative',
    marginHorizontal: 4,
  },
  podiumCard1: {
    height: 200,
    zIndex: 5,
  },
  podiumCard2: {
    height: 175,
  },
  podiumCard3: {
    height: 160,
  },
  podiumCardEmpty: {
    flex: 1,
    marginHorizontal: 4,
  },
  podiumIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  podiumAvatarContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  podiumAvatar: {
    width: '100%',
    height: '100%',
  },
  podiumPlaceholderAvatar: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  podiumTextContainer: {
    alignItems: 'center',
    marginBottom: 6,
    width: '100%',
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '800',
    color: 'white',
    textAlign: 'center',
  },
  podiumUsername: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 1,
  },
  podiumXpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  podiumXpText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '800',
  },
  podiumRankBadge: {
    position: 'absolute',
    bottom: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  podiumRankText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
  },
  // Redesigned Hero card
  tournamentHeroCard: {
    width: '100%',
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 6,
  },
  tournamentHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tournamentHeroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 0.5,
  },
  tournamentHeroBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tournamentHeroBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '800',
  },
  tournamentHeroDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
    marginBottom: 16,
  },
  tournamentBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  tournamentBalanceText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
  },
  prizeCard: {
    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1.5,
    borderColor: isDark ? '#334155' : '#E5E7EB',
    width: '90%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  prizeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  prizeHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.primary,
    marginLeft: 8,
    letterSpacing: -0.2,
  },
  prizeSubtitle: {
    fontSize: 12,
    color: colors.neutral,
    lineHeight: 18,
    marginBottom: 12,
  },
  prizeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#2D3748' : '#F3F4F6',
  },
  prizeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondary,
  },
  prizeValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
  },
  prizeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: isDark ? '#172554' : '#EFF6FF',
    padding: 8,
    borderRadius: 8,
  },
  prizeFooterText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '600',
  }
});
