import { AzureTheme } from '../constants/AzureTheme';
import { useTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';

export default function StudentRegisterScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const [form, setForm] = useState({ name: '', school: '', grade: '', reason: '' });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.headerIconContainer}>
            <View style={styles.hatIcon}>
              <Ionicons name="school-outline" size={32} color={colors.primary} />
            </View>
          </View>

          <Text style={styles.title}>is diwaan gali{'\n'}arday</Text>
          <Text style={styles.subtitle}>
            Kuso dhawaaw Darkpen. Fadlan buuxi macluumaadkaaga hoos ku xusan.
          </Text>

          <View style={styles.form}>
            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Magaca oo seddexan</Text>
              <View style={styles.inputWrapper}>
                <Feather name="user" size={18} color={colors.neutral} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Gali magacaaga oo dhan"
                  placeholderTextColor={colors.neutral}
                  value={form.name}
                  onChangeText={(t) => setForm({...form, name: t})}
                />
              </View>
            </View>

            {/* School Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Schoolka aad dhigato</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="business-outline" size={20} color={colors.neutral} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Magaca dugsigaaga"
                  placeholderTextColor={colors.neutral}
                  value={form.school}
                  onChangeText={(t) => setForm({...form, school: t})}
                />
              </View>
            </View>

            {/* Class Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Classka aad tahay</Text>
              <View style={styles.inputWrapper}>
                <Feather name="book" size={18} color={colors.neutral} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Tusaale: Form 4"
                  placeholderTextColor={colors.neutral}
                  value={form.grade}
                  onChangeText={(t) => setForm({...form, grade: t})}
                />
              </View>
            </View>

            {/* Reason Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Maxaad utimi halkan</Text>
              <View style={styles.inputWrapper}>
                <Feather name="message-circle" size={18} color={colors.neutral} style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="Ujeedada booqashadaada"
                  placeholderTextColor={colors.neutral}
                  value={form.reason}
                  onChangeText={(t) => setForm({...form, reason: t})}
                />
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.button}
              onPress={() => router.push('/payment')}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>is diwaan gali →</Text>
            </TouchableOpacity>
            
            <Text style={styles.footerText}>
              Adigoo is diwaangalinaya waxaad ogolaanaysaa Shuruudahayaga.
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: AzureTheme.spacing.xl,
    paddingTop: AzureTheme.spacing.xl,
    justifyContent: 'flex-start',
  },
  headerIconContainer: {
    alignItems: 'center',
    marginBottom: AzureTheme.spacing.l,
  },
  hatIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E7F5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: AzureTheme.spacing.m,
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: AzureTheme.spacing.xxl,
    paddingHorizontal: AzureTheme.spacing.m,
  },
  form: {
    gap: AzureTheme.spacing.l,
    marginBottom: AzureTheme.spacing.xxl,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondary,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tertiary,
    borderRadius: AzureTheme.borderRadius.m,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 10,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 15,
    color: colors.text,
  },
  footer: {
    paddingBottom: AzureTheme.spacing.xl,
    alignItems: 'center',
  },
  button: {
    backgroundColor: colors.card,
    width: '100%',
    paddingVertical: 18,
    borderRadius: AzureTheme.borderRadius.pill,
    alignItems: 'center',
    marginBottom: AzureTheme.spacing.m,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: colors.border || '#333',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  footerText: {
    fontSize: 11,
    color: colors.textLight,
    textAlign: 'center',
  }
});
