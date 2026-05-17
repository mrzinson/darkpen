import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { Ionicons, Feather, FontAwesome, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

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
      <Stack.Screen name="terms-content" />
      <Stack.Screen name="student-register" />
      <Stack.Screen name="group-register" />
      <Stack.Screen name="billing" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="voice-call" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="about" />
      <Stack.Screen name="readerexam" />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
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
