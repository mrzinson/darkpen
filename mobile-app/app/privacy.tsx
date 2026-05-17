import { useTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function PrivacyScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const [lang, setLang] = useState<'so' | 'en'>('so');

  const toggleLang = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLang(lang === 'en' ? 'so' : 'en');
  };

  const content = {
    en: {
      title: "Privacy Policy",
      lastUpdated: "Last updated: May 2026",
      sections: [
        {
          heading: "1. Information Collection",
          text: "At Darkpen, we collect only the necessary information to provide our educational and entertainment services. This includes your name, email address, WhatsApp number, and educational level. We do not collect unnecessary sensitive data."
        },
        {
          heading: "2. How We Use Information",
          text: "We use your information exclusively to personalize your 'Muraajaco' (revision) experience, provide relevant educational AI responses, process your subscriptions, and ensure a safe, ad-free environment. Your data helps us improve the quality of the app."
        },
        {
          heading: "3. Data Sharing & Security",
          text: "We have a strict policy against selling or sharing your personal data with third parties. All your interactions, including voice notes and chat history with the AI, are securely encrypted and protected against unauthorized access."
        },
        {
          heading: "4. Your Rights",
          text: "You have the right to request the deletion of your account and associated data at any time. If you wish to delete your data, please contact our support team through the app."
        }
      ]
    },
    so: {
      title: "Xeerka Qarsoodiga",
      lastUpdated: "Cusbooneysiintii ugu dambaysay: May 2026",
      sections: [
        {
          heading: "1. Uruurinta Xogta",
          text: "Darkpen ahaan, waxaan uruurinaa kaliya xogta asaasiga ah ee lagama maarmaanka u ah adeegyada waxbarashada iyo madadaalada ee aan bixino. Tan waxaa ku jira magacaaga, email-kaaga, nambarkaaga WhatsApp, iyo heerkaaga waxbarasho. Ma uruurinno xog xasaasi ah oo aan loo baahnayn."
        },
        {
          heading: "2. Sida Aan Xogta U Isticmaalno",
          text: "Waxaan xogtaada u adeegsanaa si gaar ah si aan kuu qaabeyno khibradaada 'Muraajaco', aan kuugu soo bandhigno jawaabo AI oo waxbarashadaada la xiriira, aan u maamulno isdiiwaangelintaada, iyo inaan xaqiijino jawi ammaan ah. Xogtaadu waxay naga caawisaa inaan app-ka horumarino."
        },
        {
          heading: "3. Wadaagista & Amniga Xogta",
          text: "Waxaan leenahay siyaasad adag oo ka dhan ah in la iibiyo ama lala wadaago xogtaada shakhsiga ah cid saddexaad. Dhammaan dhaqdhaqaaqaaga, oo ay ku jiraan fariimaha codka ah iyo taariikhda wada-sheekaysiga AI-da, si adag ayaa loo sireeyaa (Encrypted) oo loo ilaaliyaa."
        },
        {
          heading: "4. Xuquuqdaada",
          text: "Waxaad xaq u leedahay inaad dalbato in la tirtiro cinwaankaaga iyo xogtaada waqti kasta. Haddii aad rabto in xogtaada la tirtiro, fadlan kala xiriir qaybta taageerada ee app-ka."
        }
      ]
    }
  };

  const t = content[lang];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t.title}</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.langButton} onPress={toggleLang} activeOpacity={0.7}>
            <Text style={styles.langButtonText}>{lang === 'en' ? 'SO' : 'EN'}</Text>
            <Ionicons name="language-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={40} color={colors.primary} />
          </View>
          <Text style={styles.mainTitle}>{t.title}</Text>
          <Text style={styles.dateText}>{t.lastUpdated}</Text>
        </View>

        <View style={styles.contentCard}>
          {t.sections.map((section, index) => (
            <View key={index} style={styles.section}>
              <Text style={styles.sectionHeading}>{section.heading}</Text>
              <Text style={styles.sectionText}>{section.text}</Text>
              {index < t.sections.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <View style={styles.footerSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background, 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    zIndex: 10,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.secondary,
    letterSpacing: 0.5,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.1)',
  },
  langButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    marginRight: 6,
  },
  scrollContent: {
    padding: 20,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 14,
    color: colors.textLight,
    fontWeight: '500',
  },
  contentCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 3,
  },
  section: {
    marginBottom: 0,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.secondary,
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 26,
    color: '#475569', 
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 24,
  },
  footerSpacing: {
    height: 40,
  }
});
