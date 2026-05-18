import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Animated, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

export default function VoiceCallScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const [timer, setTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
      ])
    ).start();

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Background Image (Blurred) */}
      <Image 
        source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1000&auto=format&fit=crop' }} 
        style={StyleSheet.absoluteFill}
        blurRadius={Platform.OS === 'ios' ? 50 : 20}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.minimizeBtn}>
            <Ionicons name="chevron-down" size={28} color="white" />
          </TouchableOpacity>
          <View style={styles.encryptionRow}>
            <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.6)" />
            <Text style={styles.encryptionText}>End-to-end encrypted</Text>
          </View>
        </View>

        <View style={styles.profileSection}>
          <Animated.View style={[styles.avatarGlow, { transform: [{ scale: pulseAnim }] }]} />
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop' }} 
              style={styles.avatar}
            />
          </View>
          <Text style={styles.name}>Shukaansi AI</Text>
          <Text style={styles.time}>{formatTime(timer)}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.controlsRow}>
            <TouchableOpacity 
              style={[styles.controlBtn, isMuted && styles.controlBtnActive]} 
              onPress={() => setIsMuted(!isMuted)}
            >
              <Ionicons name={isMuted ? "mic-off" : "mic"} size={26} color={isMuted ? "black" : "white"} />
              <Text style={styles.controlLabel}>{isMuted ? "Unmute" : "Mute"}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.controlBtn, isSpeaker && styles.controlBtnActive]} 
              onPress={() => setIsSpeaker(!isSpeaker)}
            >
              <Ionicons name={isSpeaker ? "volume-high" : "volume-medium"} size={26} color={isSpeaker ? "black" : "white"} />
              <Text style={styles.controlLabel}>Speaker</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlBtn}>
              <MaterialCommunityIcons name="dots-horizontal" size={26} color="white" />
              <Text style={styles.controlLabel}>More</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.endCallBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="phone-hangup" size={32} color="white" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}



const getStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 60,
  },
  minimizeBtn: { position: 'absolute', left: 20 },
  encryptionRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  encryptionText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  profileSection: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  avatar: { flex: 1, borderRadius: 75 },
  avatarGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  name: { fontSize: 32, fontWeight: '700', color: 'white', marginTop: 30 },
  time: { fontSize: 18, color: 'rgba(255,255,255,0.7)', marginTop: 10, letterSpacing: 1 },
  footer: { paddingBottom: 40, alignItems: 'center' },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: width * 0.8,
    marginBottom: 40,
  },
  controlBtn: { alignItems: 'center', gap: 8 },
  controlBtnActive: { backgroundColor: colors.card, padding: 12, borderRadius: 30 },
  controlLabel: { color: 'white', fontSize: 12, fontWeight: '600' },
  endCallBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  }
});
