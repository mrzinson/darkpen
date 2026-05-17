import { useTheme } from '../context/ThemeContext';
import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function TermsContentScreen() {
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
      title: "Terms & Conditions",
      lastUpdated: "Last updated: May 2026",
      sections: [
        {
          heading: "1. App Purpose (Muraajaco)",
          text: "The primary purpose of Darkpen (Kuuk) is to serve as a revision (Muraajaco) tool to help students remember and reinforce what they have learned. A small portion of the app is dedicated to entertainment. It is not intended to replace formal education."
        },
        {
          heading: "2. Strict Anti-Cheating Policy",
          text: "We maintain a zero-tolerance policy against cheating (Qish) and any illegal activities. This app MUST NOT be used to facilitate cheating in exams or any form of academic dishonesty. Any user found violating this rule will be permanently banned from the platform."
        },
        {
          heading: "3. User Conduct",
          text: "You agree to use our services only for lawful and educational purposes. You must not use our services to share illegal content, harass others, or cause damage to the app's infrastructure."
        },
        {
          heading: "4. Service Availability",
          text: "We reserve the right to withdraw or amend our service in our sole discretion without notice. We will not be liable if all or any part of the App is unavailable at any time."
        }
      ]
    },
    so: {
      title: "Shuruudaha & Xeerarka",
      lastUpdated: "Cusbooneysiintii ugu dambaysay: May 2026",
      sections: [
        {
          heading: "1. Ujeedada App-ka (Muraajaco)",
          text: "Ujeedada ugu weyn ee app-ka Darkpen (Kuuk) loo sameeyay waa inuu noqdo madal 'Muraajaco' oo ardayda ka caawisa inay dib u xasuustaan casharadii ay barteen. Qaybta yar ee soo hartayna waa mid loogu talagalay madadaalo maskaxda lagu dejiyo."
        },
        {
          heading: "2. Mamnuucida Qishka (Anti-Cheating)",
          text: "App-ku gabi ahaanba MA OGOLA in loo isticmaalo Qish ama falal kasta oo sharci darro ah. Sida xadidaada imtixaanada ama in ardaygu si qaldan wax ugu gudbo. Qof kasta oo lagu helo isagoo app-ka u adeegsanaya qish ama fal dambiyeed, si toos ah ayaa cinwaankiisa loo xirayaa (Permanent Ban)."
        },
        {
          heading: "3. Dhaqanka Isticmaalaha",
          text: "Waxaad ogolaatay inaad adeegyadayada u isticmaasho ujeedooyin sharci iyo waxbarasho oo kaliya. Waa inaanad sinaba u isticmaalin codsigan si aad u wadaagto xog sharci darro ah ama dhib u gaysata dadka kale."
        },
        {
          heading: "4. Isbedelada iyo Helitaanka Adeegga",
          text: "Waxaan xaq u leenahay inaan joojino ama wax ka badalno adeegyadayada ogeysiis la'aan. Waa in isticmaaluhu uu si joogto ah isha ugu hayaa isbedelada lagu sameeyo xeerarka."
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
          <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
            <Ionicons name="warning" size={40} color="#EF4444" />
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
