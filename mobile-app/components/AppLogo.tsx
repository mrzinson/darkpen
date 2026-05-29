import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { useTheme } from '../context/ThemeContext';

type LogoVariant = 'auto' | 'blue' | 'white' | 'dark';

const logoSources = {
  blue: require('../assets/images/darkpen-logo-blue.png'),
  white: require('../assets/images/darkpen-logo-white.png'),
  dark: require('../assets/images/darkpen-logo-black.png'),
};

interface AppLogoProps {
  size?: number;
  variant?: LogoVariant;
  style?: StyleProp<ImageStyle>;
}

export function AppLogo({ size = 60, variant = 'auto', style }: AppLogoProps) {
  const { isDark } = useTheme();
  const resolvedVariant = variant === 'auto' ? (isDark ? 'white' : 'blue') : variant;

  return (
    <Image
      source={logoSources[resolvedVariant]}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
      accessibilityLabel="Darkpen"
    />
  );
}
