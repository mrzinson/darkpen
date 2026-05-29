import React from 'react';
import { View, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';

export function CustomBlurView({ intensity = 50, tint = 'default', style, children, ...props }: any) {
  const { isDark } = useTheme();

  if (Platform.OS === 'android') {
    // High-performance Android optimization: fallback to styled semi-transparent background to prevent lag
    let backgroundColor = 'rgba(255, 255, 255, 0.8)';
    if (tint === 'dark') {
      backgroundColor = 'rgba(15, 23, 42, 0.85)';
    } else if (tint === 'light') {
      backgroundColor = 'rgba(255, 255, 255, 0.85)';
    } else {
      backgroundColor = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)';
    }

    return (
      <View style={[style, { backgroundColor }]} {...props}>
        {children}
      </View>
    );
  }

  // Native hardware-accelerated blur for iOS and Web
  return (
    <BlurView intensity={intensity} tint={tint} style={style} {...props}>
      {children}
    </BlurView>
  );
}
