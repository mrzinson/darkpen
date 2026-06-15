import { useTheme } from '../context/ThemeContext';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppLogo } from '../components/AppLogo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../constants/Config';

export default function SplashScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(30)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.85)).current;
  const barWidth = React.useRef(new Animated.Value(0)).current;
  const glowAnim = React.useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(barWidth, {
      toValue: 1,
      duration: 1400,
      delay: 200,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();

    Animated.timing(glowAnim, {
      toValue: 2,
      duration: 1400,
      delay: 200,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    let navigated = false;
    let redirectTarget: string | null = null;

    const doNavigate = () => {
      if (navigated || !redirectTarget) return;
      navigated = true;
      router.replace(redirectTarget as any);
    };

    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) {
          redirectTarget = '/login';
          doNavigate();
          return;
        }

        const response = await fetch(`${Config.API_URL}/api/user/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          await AsyncStorage.removeItem('userToken');
          await AsyncStorage.removeItem('userData');
          redirectTarget = '/login';
          doNavigate();
          return;
        }

        const data = await response.json();
        if (data.user) {
          await AsyncStorage.setItem('userData', JSON.stringify(data.user));

          if (!data.user.terms_accepted_at) {
            redirectTarget = '/terms';
          } else if (!data.user.country || !data.user.gender) {
            redirectTarget = '/onboarding';
          } else {
            redirectTarget = '/(tabs)';
          }
        } else {
          redirectTarget = '/login';
        }
      } catch (err) {
        try {
          const token = await AsyncStorage.getItem('userToken');
          if (!token) { redirectTarget = '/login'; doNavigate(); return; }
          const cached = await AsyncStorage.getItem('userData');
          if (cached) {
            const user = JSON.parse(cached);
            if (!user.terms_accepted_at) {
              redirectTarget = '/terms';
            } else if (!user.country || !user.gender) {
              redirectTarget = '/onboarding';
            } else {
              redirectTarget = '/(tabs)';
            }
          } else {
            redirectTarget = '/(tabs)';
          }
        } catch {
          redirectTarget = '/login';
        }
      }
      doNavigate();
    };

    // Start auth check immediately in parallel with the splash animation.
    // Also enforce a MINIMUM display time of 1400ms so the splash does not
    // flash away too fast on fast devices / cached auth.
    checkAuth();
    const minTimer = setTimeout(doNavigate, 1400);

    return () => clearTimeout(minTimer);
  }, []);

  const barInterpolated = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const glowTranslate = glowAnim.interpolate({
    inputRange: [-1, 2],
    outputRange: [-80, 260],
  });

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY }, { scale: scaleAnim }],
          },
        ]}
      >
        <AppLogo size={120} variant={isDark ? 'white' : 'blue'} />
        <Text style={styles.title}>Darkpen</Text>
      </Animated.View>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: barInterpolated }]}>
          <Animated.View
            style={[styles.shimmerGlow, { transform: [{ translateX: glowTranslate }] }]}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 44,
    textTransform: 'uppercase',
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0,
    marginTop: 12,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 48,
    width: 200,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  shimmerGlow: {
    position: 'absolute',
    top: 0,
    width: 60,
    height: '100%',
    backgroundColor: colors.primary,
    opacity: 0.8,
  }
});
