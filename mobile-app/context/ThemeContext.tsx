import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

export type ThemeType = 'light' | 'dark' | 'system';

interface ThemeColors {
  primary: string;
  secondary: string;
  tertiary: string;
  neutral: string;
  background: string;
  text: string;
  textLight: string;
  border: string;
  error: string;
  card: string;
}

const lightColors: ThemeColors = {
  primary: '#3B82F6', // Blue
  secondary: '#000000',
  tertiary: '#F8F9FA',
  neutral: '#74777D',
  background: '#F8FAFC', // Very light cool gray
  text: '#0F172A',
  textLight: '#64748B',
  border: '#E2E8F0',
  error: '#EF4444',
  card: '#FFFFFF',
};

const darkColors: ThemeColors = {
  primary: '#FFFFFF', // White in dark mode
  secondary: '#FFFFFF', // White icons & text
  tertiary: '#1A2332', // Deep blue-gray
  neutral: '#A0AEC0', // Softer gray for subtitles
  background: '#0D1117', // Premium GitHub-style dark
  text: '#FFFFFF', // Pure white text
  textLight: '#CBD5E1', // Light slate for secondary text
  border: '#1E293B', // Subtle borders
  error: '#F87171',
  card: '#161B22', // Slightly lighter than background
};

interface ThemeContextData {
  theme: ThemeType;
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextData>({} as ThemeContextData);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeType>('dark'); // Default to Dark!
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Load saved theme
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('appTheme');
        if (savedTheme) {
          setThemeState(savedTheme as ThemeType);
        } else {
          // If no saved theme, default to dark
          setThemeState('dark');
        }
      } catch (e) {
        console.log('Error loading theme', e);
      } finally {
        setIsReady(true);
      }
    };
    loadTheme();
  }, []);

  const setTheme = async (newTheme: ThemeType) => {
    setThemeState(newTheme);
    try {
      await AsyncStorage.setItem('appTheme', newTheme);
    } catch (e) {
      console.log('Error saving theme', e);
    }
  };

  const isDark = theme === 'dark' || (theme === 'system' && systemColorScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  if (!isReady) return null; // Or a splash screen

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
