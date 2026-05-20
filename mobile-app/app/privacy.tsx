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
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const router = useRouter();
  const [lang, setLang] = useState<'en' | 'so'>('en');

  const toggleLang = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLang(lang === 'en' ? 'so' : 'en');
  };

  const content = {
    en: {
      title: "Privacy Policy",
      lastUpdated: "Effective Date: 18/5/2026",
      subtitle: "Darkpen respects your privacy. This Privacy Policy explains how we collect, use, and protect user information. By using Darkpen, you agree to this Privacy Policy.",
      sections: [
        {
          heading: "1. Information We Collect",
          text: "Depending on app features, we may collect:\n\nAccount Information\n• Name\n• Email address\n• Phone number\n• Login credentials\n\nUsage Information\n• Device information\n• App activity\n• Crash reports\n• IP address\n• Browser or device type\n\nUploaded Content\nUsers may upload:\n• PDFs\n• Notes\n• Educational documents\n• Previous exams\n• Messages and prompts"
        },
        {
          heading: "2. How We Use Information",
          text: "We use information to:\n• Provide AI study assistance\n• Improve app performance\n• Personalize user experience\n• Maintain security\n• Prevent abuse and cheating-related misuse\n• Respond to support requests\n• Analyze app usage"
        },
        {
          heading: "3. AI Processing",
          text: "User prompts and uploaded content may be processed by AI systems to generate responses.\n\nUsers should avoid uploading:\n• Sensitive personal data\n• Confidential information\n• Financial passwords\n• Private examination materials that are not authorized for sharing"
        },
        {
          heading: "4. Academic Integrity and Abuse Prevention",
          text: "We may monitor usage patterns to:\n• Detect abuse\n• Prevent cheating-related misuse\n• Enforce platform rules\n• Maintain educational integrity\n\nAccounts violating academic integrity policies may be restricted or suspended."
        },
        {
          heading: "5. Data Sharing",
          text: "We do not sell personal information.\n\nWe may share data only:\n• With service providers helping operate the app\n• When required by law\n• To protect safety, rights, or security\n• To prevent fraud or abuse"
        },
        {
          heading: "6. Data Security",
          text: "We implement reasonable security measures to protect user information.\n\nHowever, no online platform is completely secure.\n\nUsers are responsible for protecting their own account credentials."
        },
        {
          heading: "7. Children's Privacy",
          text: "The app is not intended for children below the minimum age required by applicable law without parental supervision.\n\nIf we discover unauthorized child data collection, we may remove the information."
        },
        {
          heading: "8. User Rights",
          text: "Depending on local laws, users may have rights to:\n• Access their data\n• Correct information\n• Request deletion\n• Withdraw consent\n\nRequests can be sent to: team.darkpen@gmail.com"
        },
        {
          heading: "9. Data Retention",
          text: "We retain information only as long as necessary to:\n• Provide services\n• Comply with legal obligations\n• Resolve disputes\n• Prevent abuse"
        },
        {
          heading: "10. Third-Party Services",
          text: "The app may use third-party services such as:\n• Analytics providers\n• Authentication services\n• Cloud hosting\n• Payment providers\n• AI processing providers\n\nThese third parties may process data according to their own privacy policies."
        },
        {
          heading: "11. International Users",
          text: "By using the app, users understand that information may be processed in countries outside their own."
        },
        {
          heading: "12. Changes to Privacy Policy",
          text: "We may update this Privacy Policy from time to time.\n\nContinued use of the app after updates means acceptance of the revised policy."
        },
        {
          heading: "13. Contact Information",
          text: "For privacy-related questions:\nEmail: team.darkpen@gmail.com\nCompany: darkpen"
        },
        {
          heading: "14. Group Chats and Monetization Data Processing",
          text: "We process transaction data, wallet balances, and subscriptions to enforce credit limits and automatic expiration rules. For Pay As You Go users, inactivity timestamps are processed to calculate the 1-month expiration of unused credits. Wallet balances are adjusted dynamically when interacting with AI features in Group Chats (e.g., credit deductions for text, image, and group observation)."
        }
      ]
    },
    so: {
      title: "Xeerka Qarsoodiga",
      lastUpdated: "Taariikhda Dhaqangalka: 18/5/2026",
      subtitle: "Darkpen waxay ixtiraamtaa qarsoodigaaga. Xeerkan Qarsoodiga wuxuu sharxayaa sida aan u ururino, u isticmaalno, iyo u ilaalino xogta isticmaalaha. Markaad isticmaasho Darkpen, waxaad ogolaatay Xeerkan Qarsoodiga.",
      sections: [
        {
          heading: "1. Xogta Aan Ururino",
          text: "Iyadoo ku xiran sifooyinka app-ka, waxaa suurtagal ah inaan ururino:\n\nXogta Koontada\n• Magaca\n• Ciwaanka Email-ka\n• Nambarka taleefanka\n• Macluumaadka gelitaanka\n\nXogta Adeegsiga\n• Macluumaadka aaladda (Device information)\n• Dhaqdhaqaaqa app-ka\n• Warbixinnada cilladaha (Crash reports)\n• Ciwaanka IP-ga\n• Nooca browser-ka ama aaladda\n\nXogta La Soo Upload-gareeyay\nIsticmaalayaashu waxay soo upload-gareyn karaan:\n• PDF-yo\n• Qoraallo\n• Dukumiintiyo waxbarasho\n• Imtixaanadii hore\n• Farriimaha iyo amarada (prompts)"
        },
        {
          heading: "2. Sida Aan Xogta U Adeegsano",
          text: "Waxaan xogta u adeegsanaa si aan:\n• U bixino kaalmada waxbarasho ee AI\n• U horumarino shaqada app-ka\n• U shakhsiyeyno khibrada isticmaalaha\n• U ilaalino ammaanka\n• Uga hortagno xadgudubyada iyo si qaldan u adeegsiga la xiriira qishka\n• Uga jawaabno codsiyada taageerada\n• U falanqayno isticmaalka app-ka"
        },
        {
          heading: "3. Habaynta AI (AI Processing)",
          text: "Amarka isticmaalaha iyo xogta la soo upload-gareeyay waxaa habayn kara nidaamyada AI si ay u soo saaraan jawaabaha.\n\nIsticmaalayaashu waa inay iska ilaaliyaan soo upload-garaynta:\n• Xogta shakhsiga ah ee xasaasiga ah\n• Macluumaadka sirta ah\n• Erayada sirta ah ee maaliyadeed (Passwords)\n• Agabka imtixaanka gaarka ah ee aan loo fasaxin wadaagistooda"
        },
        {
          heading: "4. Sharafta Waxbarashada iyo Kahortagga Xadgudubka",
          text: "Waxaan u kormeerikarnaa hababka isticmaalka si aan:\n• U ogaano xadgudubyada\n• Uga hortagno si qaldan u adeegsiga la xiriira qishka\n• U dhaqangelino xeerarka madal-ka\n• U ilaalino sharafta waxbarashada\n\nKoontooyinka ku xadgudba siyaasadaha sharafta waxbarashada waa la xadidi karaa ama la laali karaa."
        },
        {
          heading: "5. Wadaagista Xogta",
          text: "Ma iibino xogta shakhsiga ah.\n\nWaxaan wadaagi karnaa xogta oo kaliya:\n• Shirkadaha bixiya adeegyada ee naga caawiya ku shaqaynta app-ka\n• Marka uu sharcigu dalbado\n• Si loo ilaaliyo badbaadada, xuquuqda, ama ammaanka\n• Si looga hortago masuqmaasuq ama xadgudub"
        },
        {
          heading: "6. Amniga Xogta",
          text: "Waxaan hirgelinaa tallaabooyin ammaan oo macquul ah si aan u ilaalino xogta isticmaalaha.\n\nSi kastaba ha ahaatee, ma jiro madal online ah oo gabi ahaanba ammaan ah.\n\nIsticmaalayaasha ayaa mas'uul ka ah ilaalinta macluumaadka gelitaanka koontadooda."
        },
        {
          heading: "7. Qarsoodiga Carruurta",
          text: "App-ka looma talagalin carruurta ka yar da'da ugu yar ee uu sharcigu dalbado iyado aan la helin kormeerka waalidka.\n\nHaddii aan ogaano inaan ururinay xogta ilmo aan la fasaxin, waan tirtiri doonaa macluumaadkaas."
        },
        {
          heading: "8. Xuquuqda Isticmaalaha",
          text: "Iyadoo ku xiran shuruucda deegaanka, isticmaalayaashu waxay xaq u yeelan karaan inay:\n• Helaan xogtooda\n• Saxaan macluumaadka\n• Dalbadaan tirtiridda\n• Kala laabtaan ogolaanshaha\n\nCodsiyada waxaa loo soo diri karaa: team.darkpen@gmail.com"
        },
        {
          heading: "9. Haynta Xogta (Data Retention)",
          text: "Waxaan haynaa macluumaadka kaliya inta ay lagama maarmaanka u tahay si aan:\n• U bixino adeegyada\n• U raacno waajibka sharciga ah\n• U xalino khilaafaadka\n• Uga hortagno xadgudubyada"
        },
        {
          heading: "10. Adeegyada Cidda Saddexaad",
          text: "App-ku wuxuu isticmaali karaa adeegyada cidda saddexaad sida:\n• Bixiyeyaasha falanqaynta (Analytics)\n• Adeegyada xaqiijinta (Authentication)\n• Cloud hosting\n• Bixiyeyaasha lacag-bixinta\n• Bixiyeyaasha habaynta AI\n\nCidda saddexaad waxay u habayn karaan xogta si waafaqsan siyaasadahooda qarsoodiga ah."
        },
        {
          heading: "11. Isticmaalayaasha Caalamiga ah",
          text: "Markaad isticmaasho app-ka, isticmaalayaashu waxay fahmayaan in macluumaadka lagu habayn karo dalal ka baxsan dalkooda."
        },
        {
          heading: "12. Isbedelada Xeerka Qarsoodiga",
          text: "Waxaan cusbooneysiin karnaa Xeerkan Qarsoodiga marba marka ka dambaysa.\n\nIsticmaalka joogtada ah ee app-ka ka dib cusbooneysiinta wuxuu ka dhigan yahay ogolaanshaha xeerka la qayaxay."
        },
        {
          heading: "13. Macluumaadka Xiriirka",
          text: "Wixii su'aalo ah oo la xiriira qarsoodiga:\nEmail: team.darkpen@gmail.com\nCompany: darkpen"
        },
        {
          heading: "14. Habaynta Xogta Kooxaha iyo Qaybta Lacagta",
          text: "Waxaan u habaynaa xogta macaamilka, dhibcaha wallet-ka, iyo qorshayaasha si aan u dhaqangalino xaddidaadaha dhibcaha iyo xeerarka dhicitaanka tooska ah. Isticmaalayaasha Pay As You Go, waxaa la falanqeeyaa taariikhda u dambaysay ee dhaqdhaqaaqooda si loo xisaabiyo dhicitaanka 1-da bilood ah ee dhibcaha aan la isticmaalin. Dhibcaha wallet-ka waxaa loo cusboonaysiiyaa si dynamic ah markaad la macaamilayso AI-ga ku dhex jira Group Chats (sida jarista dhibcaha ee qoraalka, sawirka, iyo daawashada kooxda)."
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
          <Text style={styles.subtitleText}>{t.subtitle}</Text>
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

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
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
    borderWidth: 1,
    borderColor: colors.border,
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
    borderWidth: 1,
    borderColor: colors.border,
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
    paddingHorizontal: 10,
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
    fontWeight: '600',
    marginBottom: 12,
  },
  subtitleText: {
    fontSize: 15,
    color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#475569',
    textAlign: 'center',
    lineHeight: 22,
  },
  contentCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#475569', 
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 24,
  },
  footerSpacing: {
    height: 40,
  }
});
