import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

export default function VoiceCallScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [timer, setTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const ControlBtn = ({ icon, label, active, onPress, isEndCall = false, hideLabel = false }: any) => {
    // Premium iOS style colors with proper Dark/Light mode contrast
    const btnBg = isEndCall 
      ? '#FF3B30' 
      : (active ? '#007AFF' : (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)')); 
      
    // Fix visibility: Icons must be white in dark mode when inactive!
    const iconColor = isEndCall 
      ? '#fff' 
      : (active ? '#fff' : (isDark ? '#ffffff' : '#1C1C1E')); 

    const labelColor = isDark ? 'rgba(255,255,255,0.95)' : '#1C1C1E'; 

    return (
      <View style={styles.controlItem}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.btnWrapper, isEndCall && styles.endBtnWrapper]}>
          <View style={[styles.controlBtn, { backgroundColor: btnBg }]}>
            {icon === 'phone-hangup' ? (
              <MaterialCommunityIcons name={icon} size={isEndCall ? 38 : 32} color={iconColor} />
            ) : (
              <Ionicons name={icon} size={26} color={iconColor} />
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
        source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1200&auto=format&fit=crop' }} 
        style={StyleSheet.absoluteFill}
      />
      

      <SafeAreaView style={styles.safeArea}>
        
        {/* Top Caller ID Section */}
        <View style={styles.topSection}>
          <Text style={styles.callerName}>MyLove</Text>
          <Text style={styles.callStatus}>{formatTime(timer)}</Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* Bottom Unique Floating Layout */}
        <View style={styles.bottomSection}>
          
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
            <ControlBtn icon="volume-high" hideLabel={true} active={isSpeaker} onPress={() => setIsSpeaker(!isSpeaker)} />
            <ControlBtn icon="videocam" hideLabel={true} active={false} onPress={() => {}} />
            <ControlBtn icon="chatbubbles-outline" hideLabel={true} active={false} onPress={() => {}} />
          </BlurView>

          {/* Isolated End Call Button in a Matching Glass Circle */}
          <View style={styles.endCallContainer}>
            <BlurView 
              intensity={Platform.OS === 'ios' ? 30 : 50} 
              tint={isDark ? "dark" : "light"} 
              style={[
                styles.floatingEndPill, 
                !isDark && { backgroundColor: 'rgba(255, 255, 255, 0.15)' }, 
                isDark && { backgroundColor: 'rgba(0, 0, 0, 0.15)' }
              ]}
            >
              <ControlBtn icon="phone-hangup" hideLabel={true} isEndCall={true} onPress={() => router.back()} />
            </BlurView>
            <Text style={[styles.endCallLabel, { color: isDark ? 'rgba(255,255,255,0.95)' : '#1C1C1E' }]}></Text>
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
    marginTop: height * 0.05,
  },
  callerName: {
    fontSize: 42,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  callStatus: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomSection: {
    paddingBottom: Platform.OS === 'ios' ? 30 : 50,
    alignItems: 'center',
    gap: 35,
  },
  floatingPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 45,
    width: width * 0.85,
    overflow: 'hidden',
  },
  floatingEndPill: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  endCallContainer: {
    alignItems: 'center',
  },
  endCallLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    letterSpacing: 0.5,
  },
  controlItem: {
    alignItems: 'center',
  },
  btnWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  endBtnWrapper: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  controlBtn: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    letterSpacing: 0.5,
  }
});
