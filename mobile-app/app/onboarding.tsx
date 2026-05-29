import { AzureTheme } from '../constants/AzureTheme';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Animated, Dimensions, TextInput, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../constants/Config';

const { width } = Dimensions.get('window');

const ALL_OTHER_COUNTRIES = [
  'Djibouti', 'Uganda', 'Tanzania', 'Yemen', 'Turkey', 'Saudi Arabia', 'UAE',
  'UK', 'USA', 'Canada', 'Sweden', 'Norway', 'Finland', 'Germany', 'Italy',
  'Egypt', 'Sudan', 'Zambia', 'South Africa', 'Qatar', 'Malaysia'
];

export default function OnboardingScreen() {
  const { colors, isDark, language } = useTheme();
  const styles = getStyles(colors, isDark);
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [country, setCountry] = useState('');
  const [regionState, setRegionState] = useState('');

  // Other country search
  const [searchQuery, setSearchQuery] = useState('');
  const [showOtherCountries, setShowOtherCountries] = useState(false);

  // Animations
  const stepAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0.25)).current;

  // Animate progress bar
  useEffect(() => {
    let target = 0.25;
    if (step === 1) target = 0.25;
    else if (step === 2) target = 0.50;
    else if (step === 3 && country === 'Somalia') target = 0.75;
    else target = 1.0;

    Animated.timing(progressAnim, {
      toValue: target,
      duration: 350,
      useNativeDriver: false
    }).start();
  }, [step, country]);

  const handleStepTransition = (nextStep: number) => {
    Animated.timing(stepAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true
    }).start(() => {
      setStep(nextStep);
      Animated.timing(stepAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      }).start();
    });
  };

  const handleGenderSelect = (selectedGender: 'male' | 'female') => {
    setGender(selectedGender);
    handleStepTransition(2);
  };

  const handleCountrySelect = (selectedCountry: string) => {
    setCountry(selectedCountry);
    setShowOtherCountries(false);
    if (selectedCountry === 'Somalia') {
      handleStepTransition(3);
    } else {
      setRegionState(''); // Clear state if not Somalia
      handleStepTransition(4); // Skip to confirmation
    }
  };

  const handleStateSelect = (selectedState: string) => {
    setRegionState(selectedState);
    handleStepTransition(4);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error(language === 'so' ? 'Kalfadhigaagu wuu dhacay. Fadlan mar kale soo gal.' : 'Session expired. Please login again.');

      const response = await fetch(`${Config.API_URL}/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          gender,
          country,
          region_state: country === 'Somalia' ? regionState : null
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Error saving data');
      }

      // Update Cached User Data
      const cachedData = await AsyncStorage.getItem('userData');
      if (cachedData) {
        const user = JSON.parse(cachedData);
        await AsyncStorage.setItem('userData', JSON.stringify({
          ...user,
          gender,
          country,
          region_state: country === 'Somalia' ? regionState : null
        }));
      }

      // Clear books/exams cache to fetch new region specific data
      await AsyncStorage.removeItem('home_books');
      await AsyncStorage.removeItem('home_exams');
      await AsyncStorage.removeItem('manhajka_books');
      await AsyncStorage.removeItem('exams_list');

      // Success Alert and go to App
      Alert.alert(
        language === 'so' ? 'Guul' : 'Success',
        language === 'so'
          ? 'Xogtaada si guul leh ayaa loo keydiyey!'
          : 'Your information has been successfully saved!',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (err: any) {
      Alert.alert(language === 'so' ? 'Cilad' : 'Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCountries = ALL_OTHER_COUNTRIES.filter(c =>
    c.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navigation & Progress */}
      <View style={styles.header}>
        {step > 1 && !loading && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (step === 4 && country !== 'Somalia') {
                handleStepTransition(2);
              } else {
                handleStepTransition(step - 1);
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.secondary} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        <Text style={styles.stepTitle}>
          {language === 'so' ? `Tallaabada ${step} ee 4` : `Step ${step} of 4`}
        </Text>
      </View>

      {/* Progress Line */}
      <View style={styles.progressContainer}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%']
              })
            }
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: stepAnim, transform: [{ scale: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }}>

          {/* STEP 1: GENDER SELECTION */}
          {step === 1 && (
            <View style={styles.stepWrapper}>
              <Text style={styles.title}>
                {language === 'so' ? 'Dooro Jinsigaaga' : 'Select Your Gender'}
              </Text>
              <Text style={styles.subtitle}>
                {language === 'so'
                  ? 'Fadlan dooro jinsigaaga si aan kuugu habeyno caawiyaha AI.'
                  : 'Please choose your gender to help customize your AI assistant experience.'}
              </Text>

              <View style={styles.cardContainer}>
                <TouchableOpacity
                  style={[styles.genderCard, gender === 'male' && styles.genderCardActive]}
                  onPress={() => handleGenderSelect('male')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.genderIconWrapper, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="male" size={48} color="#3B82F6" />
                  </View>
                  <Text style={styles.genderLabelSO}>Lab (Nin)</Text>
                  <Text style={styles.genderLabelEN}>Male</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.genderCard, gender === 'female' && styles.genderCardActive]}
                  onPress={() => handleGenderSelect('female')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.genderIconWrapper, { backgroundColor: '#FDF2F8' }]}>
                    <Ionicons name="female" size={48} color="#EC4899" />
                  </View>
                  <Text style={styles.genderLabelSO}>Dhedig (Naag)</Text>
                  <Text style={styles.genderLabelEN}>Female</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 2: COUNTRY SELECTION */}
          {step === 2 && (
            <View style={styles.stepWrapper}>
              <Text style={styles.title}>
                {language === 'so' ? 'Wadankee degan tahay?' : 'Where do you live?'}
              </Text>
              <Text style={styles.subtitle}>
                {language === 'so'
                  ? 'Dooro wadanka aad degan tahay si aan kuugu soo rarno manhajka iyo imtixaanada saxda ah.'
                  : 'Select the country you are in to load the matching curriculum and exams.'}
              </Text>

              {/* Main Quick Countries */}
              <View style={styles.countryGrid}>
                <TouchableOpacity
                  style={[styles.countryButton, country === 'Somaliland' && styles.countryButtonActive]}
                  onPress={() => handleCountrySelect('Somaliland')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="location" size={20} color={country === 'Somaliland' ? 'white' : '#3B82F6'} />
                  <Text style={[styles.countryButtonText, country === 'Somaliland' && styles.countryButtonTextActive]}>Somaliland</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.countryButton, country === 'Somalia' && styles.countryButtonActive]}
                  onPress={() => handleCountrySelect('Somalia')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="location" size={20} color={country === 'Somalia' ? 'white' : '#3B82F6'} />
                  <Text style={[styles.countryButtonText, country === 'Somalia' && styles.countryButtonTextActive]}>Somalia</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.countryButton, country === 'Kenya' && styles.countryButtonActive]}
                  onPress={() => handleCountrySelect('Kenya')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="location" size={20} color={country === 'Kenya' ? 'white' : '#3B82F6'} />
                  <Text style={[styles.countryButtonText, country === 'Kenya' && styles.countryButtonTextActive]}>Kenya</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.countryButton, country === 'Ethiopia' && styles.countryButtonActive]}
                  onPress={() => handleCountrySelect('Ethiopia')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="location" size={20} color={country === 'Ethiopia' ? 'white' : '#3B82F6'} />
                  <Text style={[styles.countryButtonText, country === 'Ethiopia' && styles.countryButtonTextActive]}>Ethiopia</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.countryButton, country === 'Nairobi' && styles.countryButtonActive]}
                  onPress={() => handleCountrySelect('Nairobi')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="business" size={20} color={country === 'Nairobi' ? 'white' : '#3B82F6'} />
                  <Text style={[styles.countryButtonText, country === 'Nairobi' && styles.countryButtonTextActive]}>Nairobi</Text>
                </TouchableOpacity>
              </View>

              {/* Other Countries Search Expandable */}
              <TouchableOpacity
                style={styles.expandOtherBtn}
                onPress={() => setShowOtherCountries(!showOtherCountries)}
              >
                <Text style={styles.expandOtherBtnText}>
                  {language === 'so' ? 'Wadamo kale oo badan...' : 'Search other countries...'}
                </Text>
                <Ionicons name={showOtherCountries ? "chevron-up" : "chevron-down"} size={16} color={colors.secondary} />
              </TouchableOpacity>

              {showOtherCountries && (
                <View style={styles.searchSection}>
                  <View style={styles.searchBar}>
                    <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder={language === 'so' ? 'Qor wadanka...' : 'Type country...'}
                      placeholderTextColor="#9CA3AF"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </View>

                  <View style={styles.countriesList}>
                    {filteredCountries.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={styles.countryListItem}
                        onPress={() => handleCountrySelect(c)}
                      >
                        <Text style={styles.countryListItemText}>{c}</Text>
                        <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* STEP 3: STATE SELECTION (SOMALIA ONLY) */}
          {step === 3 && country === 'Somalia' && (
            <View style={styles.stepWrapper}>
              <Text style={styles.title}>
                {language === 'so' ? 'Maamul Goboleedkee degan tahay?' : 'Which State are you in?'}
              </Text>
              <Text style={styles.subtitle}>
                {language === 'so'
                  ? 'Fadlan dooro maamul goboleedkaaga si aad u hesho imtixaanada iyo manhajka deegaankaas.'
                  : 'Please choose your state to receive localized exams and curriculum materials.'}
              </Text>

              <View style={styles.stateContainer}>
                {[
                  'Puntland',
                  'Jubaland',
                  'Galmudug',
                  'Hirshabelle',
                  'South West State',
                  'SSC Khatumo',
                  'Villa Somalia / Mogadishu (Banaadir)'
                ].map((stateOption) => (
                  <TouchableOpacity
                    key={stateOption}
                    style={[styles.statePill, regionState === stateOption && styles.statePillActive]}
                    onPress={() => handleStateSelect(stateOption)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.stateText, regionState === stateOption && styles.stateTextActive]}>
                      {stateOption}
                    </Text>
                    {regionState === stateOption && (
                      <Ionicons name="checkmark-circle" size={18} color="white" style={{ marginLeft: 8 }} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* STEP 4: SUMMARY & CONFIRM */}
          {step === 4 && (
            <View style={styles.stepWrapper}>
              <Text style={styles.title}>
                {language === 'so' ? 'Ma saxan yihiin?' : 'Is everything correct?'}
              </Text>
              <Text style={styles.subtitle}>
                {language === 'so'
                  ? 'Fadlan hubi xogtaada ka hor inta aadan guda galin isticmaalka app-ka.'
                  : 'Please review your selections before entering the application.'}
              </Text>

              {/* Display card */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryIconWrapper}>
                    <Ionicons name="person" size={20} color="#3B82F6" />
                  </View>
                  <View>
                    <Text style={styles.summaryLabel}>{language === 'so' ? 'Jinsiga' : 'Gender'}</Text>
                    <Text style={styles.summaryValue}>
                      {gender === 'male' ? (language === 'so' ? 'Lab (Nin)' : 'Male') : (language === 'so' ? 'Dhedig (Naag)' : 'Female')}
                    </Text>
                  </View>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryRow}>
                  <View style={styles.summaryIconWrapper}>
                    <Ionicons name="earth" size={20} color="#10B981" />
                  </View>
                  <View>
                    <Text style={styles.summaryLabel}>{language === 'so' ? 'Wadanka' : 'Country'}</Text>
                    <Text style={styles.summaryValue}>{country}</Text>
                  </View>
                </View>

                {country === 'Somalia' && (
                  <>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <View style={styles.summaryIconWrapper}>
                        <Ionicons name="map" size={20} color="#F59E0B" />
                      </View>
                      <View>
                        <Text style={styles.summaryLabel}>{language === 'so' ? 'Maamul Goboleedka' : 'State / Region'}</Text>
                        <Text style={styles.summaryValue}>{regionState}</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>

              {/* Action Banner for General Curriculum users */}
              {country !== 'Somalia' && country !== 'Somaliland' && (
                <View style={styles.generalNoticeCard}>
                  <Ionicons name="information-circle-outline" size={24} color="#3B82F6" style={{ marginRight: 10, marginTop: 2 }} />
                  <Text style={styles.generalNoticeText}>
                    {language === 'so'
                      ? `Maadaama aad ku sugan tahay ${country}, waxaan kuu diyaarinay Manhajka Guud. Haddii aad rabto inaad u beddelato manhaj kale, waxaad hadhow ka beddeli kartaa Profile-kaaga.`
                      : `Since you live in ${country}, we've configured the General Curriculum for you. You can switch to a specific country's curriculum anytime in your profile settings.`}
                  </Text>
                </View>
              )}

              {/* Confirm and Submit button */}
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>
                      {language === 'so' ? 'BILOW AKHRISKA' : 'START STUDYING'}
                    </Text>
                    <Ionicons name="arrow-forward-outline" size={20} color="white" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

        </Animated.View>
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    height: 60,
  },
  backButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textLight,
  },
  progressContainer: {
    height: 4,
    width: '100%',
    backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  stepWrapper: {
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textLight,
    lineHeight: 22,
    marginBottom: 32,
  },
  cardContainer: {
    flexDirection: 'column',
    gap: 16,
  },
  genderCard: {
    backgroundColor: isDark ? '#161B22' : '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: isDark ? '#21262D' : '#E5E7EB',
    padding: 20,
    flexDirection: 'column',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  genderCardActive: {
    borderColor: '#3B82F6',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.05)' : '#EFF6FF',
  },
  genderIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  genderLabelSO: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  genderLabelEN: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 2,
  },
  countryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#161B22' : '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: isDark ? '#21262D' : '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minWidth: '45%',
    flexGrow: 1,
    gap: 8,
  },
  countryButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  countryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  countryButtonTextActive: {
    color: '#FFFFFF',
  },
  expandOtherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: isDark ? '#21262D' : '#F1F5F9',
    borderRadius: 12,
    marginTop: 8,
  },
  expandOtherBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  searchSection: {
    marginTop: 16,
    backgroundColor: isDark ? '#161B22' : '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: isDark ? '#21262D' : '#E2E8F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#0D1117' : '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  countriesList: {
    maxHeight: 180,
  },
  countryListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#21262D' : '#F3F4F6',
  },
  countryListItemText: {
    fontSize: 15,
    color: colors.text,
  },
  stateContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? '#161B22' : '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: isDark ? '#21262D' : '#E5E7EB',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statePillActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  stateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  stateTextActive: {
    color: '#FFFFFF',
  },
  summaryCard: {
    backgroundColor: isDark ? '#161B22' : '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: isDark ? '#21262D' : '#E2E8F0',
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  summaryIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? '#21262D' : '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: isDark ? '#21262D' : '#E2E8F0',
    marginVertical: 16,
  },
  generalNoticeCard: {
    flexDirection: 'row',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.08)' : '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#BFDBFE',
    marginBottom: 24,
  },
  generalNoticeText: {
    flex: 1,
    fontSize: 13,
    color: isDark ? '#60A5FA' : '#1E40AF',
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  }
});
