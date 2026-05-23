import { useTheme } from '../../context/ThemeContext';
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Dimensions, ActivityIndicator, Image, AppState, Alert, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { AuthGuard } from '../../components/AuthGuard';

const { width, height } = Dimensions.get('window');

import Config from '../../constants/Config';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Question = {
  subject: string;
  type: 'multiple-choice' | 'structured';
  question: string;
  options?: string[];
  answer: string | number;
};

type QuizReviewItem = {
  question: string;
  subject: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
};

export default function QuizScreen() {
  const { colors, isDark, language } = useTheme();
  const styles = getStyles(colors, isDark);

  const [activeTab, setActiveTab] = useState<'ai' | 'others'>('ai');

  // Opt-In State
  const [optedIn, setOptedIn] = useState<boolean | null>(null);
  const [optInLoading, setOptInLoading] = useState(false);

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

  // 1. Fetch user enrollment & wallet stats
  const fetchStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      
      // Fetch profile to get credits
      const resProfile = await fetch(`${Config.API_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataProfile = await resProfile.json();
      if (resProfile.ok && dataProfile.user) {
        setUserCredits(dataProfile.user.balance || 0);
      }

      // Check opt-in & limit status by attempting a soft status query on generate endpoint
      const resGenerate = await fetch(`${Config.API_URL}/api/chat/quiz/generate`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataGenerate = await resGenerate.json();

      if (resGenerate.ok) {
        setOptedIn(!!dataGenerate.opted_in);
        setFreeAttemptsUsed(dataGenerate.free_attempts_used || 0);
        setLockoutSeconds(0);
      } else if (resGenerate.status === 400 && dataGenerate.status === 'locked') {
        setLockoutSeconds(dataGenerate.seconds_remaining);
        // Soft set optedIn since they are locked out, they must have opted in
        setOptedIn(true);
      } else if (resGenerate.status === 403) {
        // Suspended
        Alert.alert('Xannibaad', dataGenerate.message);
        setOptedIn(true);
      } else {
        setOptedIn(false);
      }
    } catch (err) {
      console.error("Status fetch error:", err);
      // Fallback
      setOptedIn(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [quizState]);

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

  // Start Quiz (Deducts credits if attempts >= 5)
  const handleStartQuiz = async () => {
    setQuizState('generating');
    setXpEarned(null);
    setNewTotalXp(null);
    setUserAnswers([]);
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

  // Submit Answer
  const handleAnswerSubmit = (selected: string, isMath = false) => {
    const currentQ = questions[currentQuestionIndex];
    let isCorrect = false;
    let correctAnswerStr = '';

    if (currentQ.type === 'multiple-choice' && currentQ.options) {
      const correctIdx = Number(currentQ.answer);
      correctAnswerStr = currentQ.options[correctIdx] || '';
      isCorrect = selected === correctAnswerStr;
    } else {
      // Structured numeric/short answer matching
      correctAnswerStr = String(currentQ.answer).trim().toLowerCase();
      isCorrect = selected.trim().toLowerCase() === correctAnswerStr;
    }

    // Record review details
    const reviewItem: QuizReviewItem = {
      question: currentQ.question,
      subject: currentQ.subject,
      selectedAnswer: selected,
      correctAnswer: correctAnswerStr,
      isCorrect: isCorrect
    };

    setUserAnswers(prev => [...prev, reviewItem]);

    const nextScore = isCorrect ? score + 1 : score;
    if (isCorrect) setScore(prev => prev + 1);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setMathAnswer('');
    } else {
      showAdAndFinish(nextScore);
    }
  };

  // Ads monetization block before results
  const showAdAndFinish = (finalScore: number) => {
    setQuizState('showing_ad');
    setTimeout(() => {
      finishQuiz(finalScore);
    }, 5000); // 5 seconds ad display
  };

  const finishQuiz = async (finalScore = score, cheatDetected = false) => {
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
        body: JSON.stringify({ score: cheatDetected ? 0 : finalScore })
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
                {leaderboard.map((player, idx) => {
                  const isTop3 = idx < 3;
                  const trophyColor = idx === 0 ? "#F59E0B" : idx === 1 ? "#94A3B8" : "#B45309";
                  
                  return (
                    <View key={player.id || idx} style={styles.leaderboardItem}>
                      <View style={styles.leaderLeft}>
                        {isTop3 ? (
                          <Ionicons name="trophy" size={24} color={trophyColor} style={styles.rankTrophy} />
                        ) : (
                          <Text style={styles.rankNumber}>{idx + 1}</Text>
                        )}
                        
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
                            <BlurView intensity={10} style={{ paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={[styles.playerName, { color: '#6B7280' }]}>Contestant</Text>
                              <Text style={styles.playerUsername}>@hidden</Text>
                            </BlurView>
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

        {/* --- AI CHALLENGE TAB --- */}
        {activeTab === 'ai' && (
          <View style={styles.tabContent}>

            {/* --- NOT OPTED IN YET PANEL --- */}
            {!optedIn && quizState === 'idle' && (
              <ScrollView contentContainerStyle={styles.optInScrollContainer}>
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
              </ScrollView>
            )}

            {/* --- WELCOME & RULES PANEL (OPTED IN) --- */}
            {optedIn && quizState === 'idle' && (
              <ScrollView contentContainerStyle={styles.welcomeScroll}>
                <View style={styles.centerBoxWelcome}>
                  <Ionicons name="trophy" size={60} color="#F59E0B" style={{ marginBottom: 15 }} />
                  <Text style={styles.idleTitle}>Curriculum Quiz Tournament</Text>
                  <Text style={styles.walletBalanceText}>Your Balance: {userCredits} Credits</Text>

                  {/* 24h Lockout Warning */}
                  {lockoutSeconds > 0 ? (
                    <View style={styles.lockoutCard}>
                      <Ionicons name="lock-closed" size={32} color="#EF4444" style={{ marginBottom: 10 }} />
                      <Text style={styles.lockoutTitle}>Waa laguu xiray maanta!</Text>
                      <Text style={styles.lockoutSubtitle}>
                        Waxaad geli kartaa maalinkii hal mar kaliya si loo ilaaliyo cadaaladda. Waxaa kuu dhiman saacadaha hoos ku qoran:
                      </Text>
                      <Text style={styles.lockoutCountdown}>{formatLockoutTime(lockoutSeconds)}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.startButton, userCredits < 30 && freeAttemptsUsed >= 5 && styles.startButtonDisabled]}
                      onPress={handleStartQuiz}
                      activeOpacity={0.8}
                      disabled={userCredits < 30 && freeAttemptsUsed >= 5}
                    >
                      <Text style={styles.startButtonText}>Start Quiz Challenge</Text>
                      <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                  )}

                  {/* Comprehensive Rules Cards */}
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
                        <Text style={styles.ruleDesc}>Shanta casho ee hore waa free, laakiin maalmaha ka dambeeya waxaa lagaa jarayaa 30 credits halkii isku-day.</Text>
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
                  <Text style={styles.adTitle}>Dugsiga Caalamiga ah ee ZinsonAI</Text>
                  <Text style={styles.adDescription}>Hada is-diiwaangeli oo hel waxbarasho digital ah oo bilaash ah!</Text>
                  <TouchableOpacity style={styles.adButton}>
                    <Text style={styles.adButtonText}>Baro Dheeraad</Text>
                  </TouchableOpacity>
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
                  <Text style={styles.adTitle}>Darkpen Premium Wallet</Text>
                  <Text style={styles.adDescription}>Ku shubo 100 Credits oo dheeraad ah kaliya $1 si aad u kordhiso isku-dayadaada!</Text>
                  <TouchableOpacity style={[styles.adButton, { backgroundColor: '#F59E0B' }]}>
                    <Text style={styles.adButtonText}>Hada Iibso</Text>
                  </TouchableOpacity>
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
  walletBalanceText: {
    fontSize: 14,
    color: '#D97706',
    fontWeight: '700',
    marginBottom: 25,
  },
  lockoutCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#EF4444',
    padding: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 30,
  },
  lockoutTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#EF4444',
    marginBottom: 8,
  },
  lockoutSubtitle: {
    fontSize: 13,
    color: colors.neutral,
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
  }
});
