import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { Ionicons, Feather, FontAwesome, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { Text, TextInput, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

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

  return (
    <ThemeProvider>
      <RootStack />
    </ThemeProvider>
  );
}
