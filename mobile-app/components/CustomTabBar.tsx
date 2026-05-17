import { useTheme } from '../context/ThemeContext';
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';

const AnimatedIcon = ({ iconName, isFocused, label }: any) => {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const scaleValue = useRef(new Animated.Value(isFocused ? 1.1 : 1)).current;

  useEffect(() => {
    Animated.spring(scaleValue, {
      toValue: isFocused ? 1.15 : 1,
      useNativeDriver: true,
      friction: 4,
    }).start();
  }, [isFocused]);

  return (
    <Animated.View style={[styles.tabItem, { transform: [{ scale: scaleValue }] }]}>
      <Feather
        name={iconName}
        size={24}
        color={isDark ? '#FFFFFF' : '#3B82F6'}
      />
      <Text style={[styles.tabLabel, isFocused && styles.tabLabelFocused]}>
        {label}
      </Text>
    </Animated.View>
  );
};

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();

  const tabConfig = [
    { name: 'index', label: 'Home', icon: 'home' },
    { name: 'chat', label: 'Chat', icon: 'message-circle', isCustom: true },
    { name: 'exams', label: 'Exams', icon: 'book-open' },
    { name: 'quiz', label: 'Quiz', icon: 'help-circle' },
    { name: 'shukaansi', label: 'Shukaansi', icon: 'heart' },
  ];

  const activeRoute = state.routes[state.index];
  const activeOptions = descriptors[activeRoute.key].options;

  // Hide tab bar if screen options dictate it
  if ((activeOptions.tabBarStyle as any)?.display === 'none') {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.blurWrapper}>
        <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={styles.blurContainer}>
          <View style={styles.colorTint} />
          <View style={styles.tabBar}>
            {tabConfig.map((tabItem) => {

              if (tabItem.isCustom) {
                return (
                  <TouchableOpacity
                    key={tabItem.name}
                    onPress={() => router.push('/chat')}
                    activeOpacity={0.7}
                    style={{ flex: 1, alignItems: 'center' }}
                  >
                    <AnimatedIcon
                      iconName={tabItem.icon}
                      isFocused={false}
                      label={tabItem.label}
                    />
                  </TouchableOpacity>
                );
              }

              const route = state.routes.find(r => r.name === tabItem.name);
              if (!route) return null;

              const isFocused = state.index === state.routes.indexOf(route);

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <TouchableOpacity
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  onPress={onPress}
                  activeOpacity={0.7}
                  style={{ flex: 1, alignItems: 'center' }}
                >
                  <AnimatedIcon
                    iconName={tabItem.icon}
                    isFocused={isFocused}
                    label={tabItem.label}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 20,
    right: 20,
    backgroundColor: 'transparent',
  },
  blurWrapper: {
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: colors.border || 'rgba(255, 255, 255, 0.1)',
  },
  blurContainer: {
    width: '100%',
  },
  colorTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 132, 255, 0.05)',
  },
  tabBar: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 10,
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    color: colors.text,
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
  tabLabelFocused: {
    color: colors.text,
    fontWeight: '800',
  }
});
