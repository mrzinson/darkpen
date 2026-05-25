import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, Image, Dimensions, Platform, 
  Vibration, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

import Config from '../constants/Config';

const { width, height } = Dimensions.get('window');

export default function VoiceCallScreen() {
  const router = useRouter();
  const { colors, isDark, t } = useTheme();
  
  const [callerName, setCallerName] = useState('GACALO');
  const [callState, setCallState] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [timer, setTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  
  // Call flow states
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [subtitles, setSubtitles] = useState('Wuu wacayaa...');
  
  const ringSoundRef = useRef<Audio.Sound | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerIntervalRef = useRef<any>(null);


  // Load AI Custom Name & Start Ringing on mount
  useEffect(() => {
    const initCall = async () => {
      // 1. Get Custom AI Name
      const savedName = await AsyncStorage.getItem('shukaansi_ai_name');
      if (savedName) {
        setCallerName(savedName.toUpperCase());
      }

      // 2. Play Ringing Tone
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false, // Ring on loudspeaker
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: 'https://assets.mixkit.co/active_storage/sfx/1359/1359-84.wav' },
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        ringSoundRef.current = sound;
      } catch (err) {
        console.warn('Failed to play ringing tone:', err);
      }

      // 3. Ring for 4 seconds, then connect
      setTimeout(() => {
        connectCall();
      }, 4000);
    };

    initCall();

    return () => {
      cleanupCall();
    };
  }, []);



  // Route Audio output between earpiece and speaker
  const routeAudio = async (mode: 'earpiece' | 'speaker') => {
    try {
      if (mode === 'earpiece') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: true, // switch to earpiece ("sameecada hoose")
        });
        setIsSpeaker(false);
      } else {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false, // loudspeaker
        });
        setIsSpeaker(true);
      }
    } catch (e) {
      console.warn('Audio routing error:', e);
    }
  };

  const deductCallCredit = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${Config.API_URL}/api/chat/shukaansi-call/deduct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === 'insufficient') {
          Alert.alert('Credits la\'aan', 'Wicitaanku wuxuu u baahan yahay ugu yaraan 5 Credits daqiiqaddii. Fadlan ku shubo credits.');
          handleHangup();
          return false;
        }
        console.log('Call credit deducted. Remaining:', data.balance);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Call credit deduction failed:', e);
      return true; // continue call if network transient issue
    }
  };

  // Connect Call & Trigger Greeting
  const connectCall = async () => {
    // 1. Check and deduct first minute
    const ok = await deductCallCredit();
    if (!ok) return;

    // Stop ringing
    if (ringSoundRef.current) {
      try {
        await ringSoundRef.current.stopAsync();
        await ringSoundRef.current.unloadAsync();
      } catch (e) {}
      ringSoundRef.current = null;
    }

    setCallState('connected');
    setSubtitles('Waad ku xidhantahay... 💖');
    Vibration.vibrate([100, 200, 100]);

    // Start Timer
    timerIntervalRef.current = setInterval(() => {
      setTimer(prev => {
        const nextTime = prev + 1;
        if (nextTime > 0 && nextTime % 60 === 0) {
          deductCallCredit();
        }
        return nextTime;
      });
    }, 1000);

    // Initial greeting from Gemini
    triggerAiGreeting();
  };

  // Speak AI text output
  const speakText = (text: string) => {
    try {
      Speech.stop();
      Speech.speak(text, {
        language: 'so', // Somali
        pitch: 1.05,
        rate: 0.95,
        onError: (err) => console.log('Speech error:', err)
      });
    } catch (e) {
      console.warn('Speech synthesis fail:', e);
    }
  };

  // Trigger Gemini Greeting
  const triggerAiGreeting = async () => {
    setIsProcessing(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/chat/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: "Aad ula hadal mudanaha si kaftan iyo kalgacal leh oo diirran oo af Soomaali dabiici ah. Is baro oo weydii magaciisa.",
          chatType: 'shukaansi',
          aiName: callerName
        })
      });

      const data = await response.json();
      if (response.ok && data.message) {
        setSubtitles(data.message);
        speakText(data.message);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Start Mic Voice Recording
  const startRecording = async () => {
    if (isRecording || isProcessing) return;
    try {
      Speech.stop(); // Stop AI speaking when user starts talking
      Vibration.vibrate(50);
      
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        alert('Fadlan oggolow makarafoonka si aad ula hadasho AI-da.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = recording;
      setIsRecording(true);
      setSubtitles('Ku hadal, waan ku dhegeysanayaa... 🎙️');
    } catch (e) {
      console.error('Failed to start call recording:', e);
    }
  };

  // Stop Mic Recording & Process Conversation
  const stopRecording = async () => {
    if (!recordingRef.current || !isRecording) return;
    setIsRecording(false);
    setIsProcessing(true);
    setSubtitles('Waan tarjumayaa... 🔄');

    try {
      const recording = recordingRef.current;
      recordingRef.current = null;
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (uri) {
        const token = await AsyncStorage.getItem('userToken');
        const formData = new FormData();
        
        if (Platform.OS === 'web') {
          const response = await fetch(uri);
          const blob = await response.blob();
          formData.append('audio', blob, 'voice_note.m4a');
        } else {
          const platformUri = Platform.OS === 'ios' ? uri.replace('file://', '') : uri;
          formData.append('audio', {
            uri: platformUri,
            name: 'voice_note.m4a',
            type: 'audio/mp4'
          } as any);
        }
        formData.append('chatType', 'shukaansi');

        // 1. Transcribe Voice using Gemini (backend)
        const transRes = await fetch(`${Config.API_URL}/api/chat/voice`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        const transData = await transRes.json();
        if (transRes.ok && transData.text) {
          const userText = transData.text;
          setSubtitles(`Adiga: "${userText}"`);

          // 2. Ask Gemini for reply
          const askRes = await fetch(`${Config.API_URL}/api/chat/ask`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              message: userText,
              chatType: 'shukaansi',
              aiName: callerName
            })
          });

          const askData = await askRes.json();
          if (askRes.ok && askData.message) {
            setSubtitles(askData.message);
            speakText(askData.message);
          } else {
            setSubtitles('Lama helin jawaab.');
          }
        } else {
          setSubtitles('Lama maqlin codkaaga.');
        }
      }
    } catch (e) {
      console.error(e);
      setSubtitles('Cilad wada xidhiidhka ah ayaa dhacday.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Clean up resources on Hangup
  const cleanupCall = async () => {
    setCallState('ended');
    Speech.stop();

    if (ringSoundRef.current) {
      try {
        await ringSoundRef.current.stopAsync();
        await ringSoundRef.current.unloadAsync();
      } catch (e) {}
      ringSoundRef.current = null;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (e) {}
      recordingRef.current = null;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

  };

  const handleHangup = async () => {
    Vibration.vibrate(100);
    await cleanupCall();
    router.back();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const ControlBtn = ({ icon, label, active, onPress, isEndCall = false, hideLabel = false }: any) => {
    const btnBg = isEndCall 
      ? '#EF4444' 
      : (active ? '#E11D48' : (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)')); 
      
    const iconColor = '#fff';
    const labelColor = isDark ? 'rgba(255,255,255,0.95)' : '#1C1C1E'; 

    return (
      <View style={styles.controlItem}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.btnWrapper, isEndCall && styles.endBtnWrapper]}>
          <View style={[styles.controlBtn, { backgroundColor: btnBg }]}>
            {icon === 'phone-hangup' ? (
              <MaterialCommunityIcons name={icon} size={isEndCall ? 36 : 28} color={iconColor} />
            ) : (
              <Ionicons name={icon} size={24} color={iconColor} />
            )}
          </View>
        </TouchableOpacity>
        {!hideLabel && <Text style={[styles.controlLabel, { color: labelColor }]}>{label}</Text>}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Premium Cinematic Background (Contact Poster) */}
      <Image 
        source={{ uri: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=1200&auto=format&fit=crop' }} 
        style={StyleSheet.absoluteFill}
      />
      <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={styles.safeArea}>
        
        {/* Top Caller ID Section */}
        <View style={styles.topSection}>
          <Text style={styles.callerName}>{callerName}</Text>
          <Text style={styles.callStatus}>
            {callState === 'ringing' ? 'dhawaaq wicitaan...' : formatTime(timer)}
          </Text>
        </View>

        {/* Center Calling Visual Section (No transcripts/subtitles shown) */}
        <View style={styles.subtitleBox}>
          <View style={styles.avatarRingingContainer}>
            <View style={[styles.avatarRingingOuter, isRecording && styles.avatarRingingActive]}>
              <BlurView intensity={20} tint="light" style={styles.avatarRingingInner}>
                <Ionicons name="person" size={70} color="white" />
              </BlurView>
            </View>
            
            {isProcessing && (
              <View style={styles.callProcessingOverlay}>
                <ActivityIndicator size="large" color="#E11D48" />
                <Text style={styles.callProcessingText}>Waa la baaraa...</Text>
              </View>
            )}
            
            {isRecording && (
              <View style={styles.callRecordingOverlay}>
                <Text style={styles.callRecordingText}>🎙️ Hadal, waan ku dhegeysanayaa...</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom Unique Floating Layout */}
        <View style={styles.bottomSection}>
          
          {/* Main Voice Calling Interaction Button */}
          {callState === 'connected' && (
            <TouchableOpacity 
              onPressIn={startRecording}
              onPressOut={stopRecording}
              activeOpacity={0.8}
              style={[styles.mainTalkBtn, isRecording && styles.mainTalkBtnActive]}
            >
              <BlurView intensity={40} tint="light" style={styles.mainTalkBtnBlur}>
                <Ionicons 
                  name={isRecording ? "mic" : "mic-outline"} 
                  size={42} 
                  color="white" 
                />
              </BlurView>
            </TouchableOpacity>
          )}

          {/* Floating Controls Toolbar */}
          <BlurView 
            intensity={Platform.OS === 'ios' ? 30 : 50} 
            tint={isDark ? "dark" : "light"} 
            style={[
              styles.floatingPill, 
              !isDark && { backgroundColor: 'rgba(255, 255, 255, 0.15)' }, 
              isDark && { backgroundColor: 'rgba(0, 0, 0, 0.15)' }
            ]}
          >
            <ControlBtn icon={isMuted ? "mic-off" : "mic"} hideLabel={true} active={isMuted} onPress={() => setIsMuted(!isMuted)} />
            <ControlBtn icon="volume-high" hideLabel={true} active={isSpeaker} onPress={() => routeAudio(isSpeaker ? 'earpiece' : 'speaker')} />
            <ControlBtn icon="videocam-off" hideLabel={true} active={false} onPress={() => {}} />
            <ControlBtn icon="chatbubbles-outline" hideLabel={true} active={false} onPress={() => { router.back(); }} />
          </BlurView>

          {/* Isolated End Call Button in a Matching Glass Circle */}
          <View style={styles.endCallContainer}>
            <BlurView 
              intensity={Platform.OS === 'ios' ? 30 : 50} 
              tint="dark" 
              style={styles.floatingEndPill}
            >
              <ControlBtn icon="phone-hangup" hideLabel={true} isEndCall={true} onPress={handleHangup} />
            </BlurView>
          </View>
          
        </View>
        
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
    marginTop: height * 0.04,
  },
  callerName: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  callStatus: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitleBox: {
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    flex: 1,
  },
  avatarRingingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    height: 250,
  },
  avatarRingingOuter: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  avatarRingingActive: {
    backgroundColor: 'rgba(225, 29, 72, 0.25)',
    borderColor: '#E11D48',
  },
  avatarRingingInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  callProcessingOverlay: {
    position: 'absolute',
    bottom: -10,
    alignItems: 'center',
  },
  callProcessingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  callRecordingOverlay: {
    position: 'absolute',
    bottom: -10,
    alignItems: 'center',
  },
  callRecordingText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bottomSection: {
    paddingBottom: Platform.OS === 'ios' ? 24 : 40,
    alignItems: 'center',
    gap: 25,
  },
  mainTalkBtn: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(225, 29, 72, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  mainTalkBtnActive: {
    borderColor: '#E11D48',
    backgroundColor: '#E11D48',
    transform: [{ scale: 1.1 }],
  },
  mainTalkBtnBlur: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 45,
    width: width * 0.85,
    overflow: 'hidden',
  },
  floatingEndPill: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  endCallContainer: {
    alignItems: 'center',
  },
  controlItem: {
    alignItems: 'center',
  },
  btnWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  endBtnWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  controlBtn: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    letterSpacing: 0.5,
  }
});
