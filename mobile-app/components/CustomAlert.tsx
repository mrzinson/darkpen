import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Animated, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { CustomBlurView } from './CustomBlurView';
import { Ionicons } from '@expo/vector-icons';
import { registerAlertListener, unregisterAlertListener, AlertData } from '../utils/customAlert';

const { width } = Dimensions.get('window');

export function CustomAlert() {
  const { colors, isDark } = useTheme();
  const [alert, setAlert] = useState<AlertData | null>(null);
  const [visible, setVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.9));

  useEffect(() => {
    registerAlertListener((data) => {
      if (data) {
        setAlert(data);
        setVisible(true);
        // Animate in
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
          }),
        ]).start();
      }
    });

    return () => {
      unregisterAlertListener();
    };
  }, []);

  if (!visible || !alert) return null;

  const handleButtonPress = (onPress?: () => void) => {
    // Animate out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setAlert(null);
      if (onPress) onPress();
    });
  };

  const handleBackdropPress = () => {
    if (alert.options?.cancelable) {
      handleButtonPress(alert.options?.onDismiss);
    }
  };

  // Helper to determine the dialog style and icon based on title/message context
  const getAlertStyle = (title: string, message?: string) => {
    const t = title.toLowerCase();
    const m = message ? message.toLowerCase() : '';

    const isSuccess =
      t.includes('guul') ||
      t.includes('copied') ||
      t.includes('success') ||
      t.includes('la koobiyeeyay') ||
      t.includes('sabsab') ||
      t.includes('abuuray') ||
      t.includes('bedelay') ||
      m.includes('guul') ||
      m.includes('copied') ||
      m.includes('success') ||
      m.includes('saved') ||
      m.includes('abuuray') ||
      m.includes('bedelay') ||
      m.includes('sabsab');

    const isError =
      t.includes('cilad') ||
      t.includes('error') ||
      t.includes('warning') ||
      t.includes('xad') ||
      t.includes('ogolaansho') ||
      t.includes('permission') ||
      t.includes('fadlan buuxi') ||
      t.includes('ma awoodno') ||
      t.includes('haysatid') ||
      t.includes('malaha') ||
      m.includes('cilad') ||
      m.includes('error') ||
      m.includes('fadlan') ||
      m.includes('warning') ||
      m.includes('ma awoodno') ||
      m.includes('haysatid') ||
      m.includes('malaha') ||
      m.includes('sorry') ||
      m.includes('denied');

    if (isSuccess) {
      return {
        iconName: 'checkmark-circle-outline' as const,
        iconColor: '#10B981',
        bgColor: 'rgba(16, 185, 129, 0.12)',
      };
    }

    if (isError) {
      return {
        iconName: 'alert-circle-outline' as const,
        iconColor: '#EF4444',
        bgColor: 'rgba(239, 68, 68, 0.12)',
      };
    }

    // Default info styles (sparkles for premium AI theme)
    return {
      iconName: 'sparkles-outline' as const,
      iconColor: '#3B82F6',
      bgColor: 'rgba(59, 130, 246, 0.12)',
    };
  };

  const styleMeta = getAlertStyle(alert.title, alert.message);
  const styles = getStyles(colors, isDark);

  const renderButtons = () => {
    const buttons = alert.buttons;

    if (!buttons || buttons.length === 0) {
      return (
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => handleButtonPress()}
          activeOpacity={0.7}
        >
          <Text style={styles.btnPrimaryText}>Ok</Text>
        </TouchableOpacity>
      );
    }

    if (buttons.length === 1) {
      const btn = buttons[0];
      const isCancel = btn.style === 'cancel';
      return (
        <TouchableOpacity
          style={[styles.btn, isCancel ? styles.btnCancel : styles.btnPrimary]}
          onPress={() => handleButtonPress(btn.onPress)}
          activeOpacity={0.7}
        >
          <Text style={isCancel ? styles.btnCancelText : styles.btnPrimaryText}>
            {btn.text || 'Ok'}
          </Text>
        </TouchableOpacity>
      );
    }

    if (buttons.length === 2) {
      const leftBtn = buttons[0];
      const rightBtn = buttons[1];

      const isLeftCancel = leftBtn.style === 'cancel';
      const isRightDestructive = rightBtn.style === 'destructive';

      return (
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btnFlex, isLeftCancel ? styles.btnCancel : styles.btnPrimary]}
            onPress={() => handleButtonPress(leftBtn.onPress)}
            activeOpacity={0.7}
          >
            <Text style={isLeftCancel ? styles.btnCancelText : styles.btnPrimaryText}>
              {leftBtn.text}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnFlex, isRightDestructive ? styles.btnDestructive : styles.btnPrimary]}
            onPress={() => handleButtonPress(rightBtn.onPress)}
            activeOpacity={0.7}
          >
            <Text style={styles.btnPrimaryText}>
              {rightBtn.text}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Render vertically for 3+ buttons
    return (
      <View style={styles.btnCol}>
        {buttons.map((btn, idx) => {
          const isCancel = btn.style === 'cancel';
          const isDestructive = btn.style === 'destructive';
          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.btn,
                isCancel ? styles.btnCancel : isDestructive ? styles.btnDestructive : styles.btnPrimary,
              ]}
              onPress={() => handleButtonPress(btn.onPress)}
              activeOpacity={0.7}
            >
              <Text style={isCancel ? styles.btnCancelText : styles.btnPrimaryText}>
                {btn.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleBackdropPress}
    >
      <View style={styles.overlay}>
        <CustomBlurView
          intensity={40}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />
        
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Circular Badge Icon */}
          <View style={[styles.iconBg, { backgroundColor: styleMeta.bgColor }]}>
            <Ionicons name={styleMeta.iconName} size={30} color={styleMeta.iconColor} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{alert.title}</Text>

          {/* Message (Optional) */}
          {alert.message ? (
            <Text style={styles.message}>{alert.message}</Text>
          ) : null}

          {/* Action Buttons */}
          {renderButtons()}
        </Animated.View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    content: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
      width: '100%',
      maxWidth: 320,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border || 'rgba(255,255,255,0.05)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 15,
      elevation: 10,
    },
    iconBg: {
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.secondary,
      marginBottom: 8,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      color: colors.textLight || '#6B7280',
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    btnRow: {
      flexDirection: 'row',
      width: '100%',
      gap: 10,
    },
    btnCol: {
      flexDirection: 'column',
      width: '100%',
      gap: 8,
    },
    btn: {
      paddingVertical: 13,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    },
    btnFlex: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    btnPrimary: {
      backgroundColor: '#3B82F6', // Beautiful brand-aligned premium blue in both modes
    },
    btnPrimaryText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    btnCancel: {
      borderWidth: 1,
      borderColor: colors.border || '#E5E7EB',
      backgroundColor: colors.background,
    },
    btnCancelText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.secondary,
    },
    btnDestructive: {
      backgroundColor: '#EF4444',
    },
  });
