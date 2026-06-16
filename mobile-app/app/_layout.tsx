import { Stack, useSegments, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { Ionicons, Feather, FontAwesome, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { Text, TextInput, StyleSheet, Alert, Platform, View, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { showCustomAlert } from '../utils/customAlert';
import { CustomAlert } from '../components/CustomAlert';
import { usePushNotifications } from '../hooks/usePushNotifications';
import Config from '../constants/Config';
import { backgroundDownloader } from '../utils/backgroundDownloader';


// Monkey patch AsyncStorage to securely encrypt JWT token using expo-secure-store
const originalGetItem = AsyncStorage.getItem;
const originalSetItem = AsyncStorage.setItem;
const originalRemoveItem = AsyncStorage.removeItem;

AsyncStorage.getItem = async (key: string, ...args: any[]) => {
  if (key === 'userToken') {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      console.warn('SecureStore.getItemAsync failed, falling back to AsyncStorage:', err);
      return originalGetItem.call(AsyncStorage, key, ...args);
    }
  }
  return originalGetItem.call(AsyncStorage, key, ...args);
};

AsyncStorage.setItem = async (key: string, value: string, ...args: any[]) => {
  if (key === 'userToken') {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch (err) {
      console.warn('SecureStore.setItemAsync failed, falling back to AsyncStorage:', err);
      return originalSetItem.call(AsyncStorage, key, value, ...args);
    }
  }
  return originalSetItem.call(AsyncStorage, key, value, ...args);
};

AsyncStorage.removeItem = async (key: string, ...args: any[]) => {
  if (key === 'userToken') {
    try {
      await SecureStore.deleteItemAsync(key);
      return;
    } catch (err) {
      console.warn('SecureStore.deleteItemAsync failed, falling back to AsyncStorage:', err);
      return originalRemoveItem.call(AsyncStorage, key, ...args);
    }
  }
  return originalRemoveItem.call(AsyncStorage, key, ...args);
};

// Monkey patch Alert.alert globally to use CustomAlert popup design
Alert.alert = (title, message, buttons, options) => {
  showCustomAlert(title, message || '', buttons, options);
};

// Also monkey patch global/window alert to intercept direct alert() calls
const customGlobalAlert = (message: any) => {
  showCustomAlert('Darkpen', String(message));
};

if (typeof global !== 'undefined') {
  (global as any).alert = customGlobalAlert;
}
if (typeof window !== 'undefined') {
  (window as any).alert = customGlobalAlert;
}


// Global Text and TextInput override for Poppins Font
const oldTextRender = (Text as any).render;
(Text as any).render = function (...args: any[]) {
  const origin = oldTextRender.call(this, ...args);
  const style = origin.props.style;
  let fontFamily = 'Inter_400Regular';

  if (style) {
    const flat = StyleSheet.flatten(style);
    const weight = flat.fontWeight;
    if (weight === 'bold' || weight === '700' || weight === '800' || weight === '900') {
      fontFamily = 'Inter_700Bold';
    } else if (weight === '600') {
      fontFamily = 'Inter_600SemiBold';
    } else if (weight === '500') {
      fontFamily = 'Inter_500Medium';
    }
  }

  return React.cloneElement(origin, {
    style: {
      fontFamily,
      ...(style ? StyleSheet.flatten(style) : {})
    },
  });
};

const oldTextInputRender = (TextInput as any).render;
(TextInput as any).render = function (...args: any[]) {
  const origin = oldTextInputRender.call(this, ...args);
  const style = origin.props.style;
  let fontFamily = 'Inter_400Regular';

  if (style) {
    const flat = StyleSheet.flatten(style);
    const weight = flat.fontWeight;
    if (weight === 'bold' || weight === '700' || weight === '800' || weight === '900') {
      fontFamily = 'Inter_700Bold';
    } else if (weight === '600') {
      fontFamily = 'Inter_600SemiBold';
    } else if (weight === '500') {
      fontFamily = 'Inter_500Medium';
    }
  }

  return React.cloneElement(origin, {
    style: {
      fontFamily,
      ...(style ? StyleSheet.flatten(style) : {})
    },
  });
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: colors.background }
    }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="terms-content" />
      <Stack.Screen name="student-register" />
      <Stack.Screen name="group-register" />
      <Stack.Screen name="billing" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="voice-call" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="about" />
      <Stack.Screen name="readerexam" />
      <Stack.Screen name="downloaded" />
    </Stack>
  );
}

export default function RootLayout() {
  const { expoPushToken } = usePushNotifications();
  const segments = useSegments();
  const router = useRouter();
  const [activeDownloads, setActiveDownloads] = useState<any[]>([]);

  useEffect(() => {
    async function saveToken() {
      if (!expoPushToken?.data) return;
      try {
        const userToken = await AsyncStorage.getItem('userToken');
        if (!userToken) return;
        
        await fetch(`${Config.API_URL}/api/auth/push-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
          },
          body: JSON.stringify({ token: expoPushToken.data })
        });
        console.log('[PUSH] Push token registered successfully with backend.');
      } catch (err) {
        console.error('[PUSH] Error saving push token:', err);
      }
    }
    saveToken();
  }, [expoPushToken, segments]);

  // Subscribe to background downloader
  useEffect(() => {
    setActiveDownloads(backgroundDownloader.getActiveDownloads());
    const unsubscribe = backgroundDownloader.subscribeGlobal(() => {
      setActiveDownloads(backgroundDownloader.getActiveDownloads());
    });
    return unsubscribe;
  }, []);

  const [loaded, error] = useFonts({
    'Inter_400Regular': require('../assets/fonts/Inter-Regular.ttf'),
    'Inter_500Medium': require('../assets/fonts/Inter-Medium.ttf'),
    'Inter_600SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    'Inter_700Bold': require('../assets/fonts/Inter-Bold.ttf'),
    'Inter_800ExtraBold': require('../assets/fonts/Inter-ExtraBold.ttf'),
    ...Ionicons.font,
    ...Feather.font,
    ...FontAwesome.font,
    ...MaterialIcons.font,
    ...MaterialCommunityIcons.font,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  const showFloatingBanner = activeDownloads.length > 0 && !segments.includes('readerexam');

  return (
    <ThemeProvider>
      <RootStack />
      <CustomAlert />
      
      {showFloatingBanner && activeDownloads.map((dl) => (
        <TouchableOpacity 
          key={dl.pdfUrl}
          style={layoutStyles.floatingBanner}
          activeOpacity={0.85}
          onPress={() => {
            router.push({
              pathname: '/readerexam',
              params: { pdfUrl: dl.pdfUrl, title: dl.title, type: dl.type }
            });
          }}
        >
          <Ionicons name="cloud-download" size={20} color="white" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={layoutStyles.floatingBannerTitle} numberOfLines={1}>
              Dejinaya: {dl.title}
            </Text>
            <View style={layoutStyles.floatingBannerBarBg}>
              <View style={[layoutStyles.floatingBannerBarFill, { width: `${Math.round(dl.progress * 100)}%` }]} />
            </View>
          </View>
          <Text style={layoutStyles.floatingBannerPercent}>
            {Math.round(dl.progress * 100)}%
          </Text>
        </TouchableOpacity>
      ))}
    </ThemeProvider>
  );
}

const layoutStyles = StyleSheet.create({
  floatingBanner: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 90 : 70, // Positioned right above standard Expo navigation tabs
    left: 16,
    right: 16,
    backgroundColor: '#3B82F6', // Sleek premium blue accent
    padding: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 9999,
  },
  floatingBannerTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 5,
  },
  floatingBannerBarBg: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  floatingBannerBarFill: {
    height: '100%',
    backgroundColor: '#ffffff',
  },
  floatingBannerPercent: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 12,
  }
});
