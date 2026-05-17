import { AzureTheme } from '../constants/AzureTheme';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

export default function GroupRegisterScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const [schools, setSchools] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');

  useEffect(() => {
    fetch('http://localhost:5000/api/auth/schools')
      .then(res => res.json())
      .then(data => {
        setSchools(data);
        setLoading(false);
      })
      .catch(err => {
        Alert.alert('Cilad', 'Lama helin liiska dugsiyada');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selectedSchool) {
      setLoading(true);
      fetch(`http://localhost:5000/api/auth/classes/${selectedSchool}`)
        .then(res => res.json())
        .then(data => {
          setClasses(data);
          setLoading(false);
        })
        .catch(err => {
          setLoading(false);
        });
    }
  }, [selectedSchool]);

  const handleContinue = () => {
    if (!selectedSchool || !selectedClass || !selectedSection) {
      return Alert.alert('Fadlan', 'Fadlan buuxi dhamaan meelaha banaan');
    }

    const groupData = {
      school_id: selectedSchool,
      class_id: selectedClass,
      sub_class: selectedSection
    };

    router.push({
      pathname: '/payment',
      params: { 
        planId: 'group_join', 
        price: '$5.0', // Tusaale ahaan
        title: 'Is-diiwaangalinta Group-ka',
        groupData: JSON.stringify(groupData)
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Group Registration</Text>
        <Text style={styles.subtitle}>Fadlan dooro dugsigaaga iyo fasalkaaga si aad ugu biirto group-ka saxda ah.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>1. Dooro Dugsiga</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedSchool}
              onValueChange={(itemValue) => setSelectedSchool(itemValue)}
            >
              <Picker.Item label="Fadlan dooro dugsi..." value="" />
              {schools.map(s => (
                <Picker.Item key={s.id} label={s.name} value={s.id.toString()} />
              ))}
            </Picker>
          </View>
        </View>

        {selectedSchool !== '' && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>2. Dooro Fasalka</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedClass}
                onValueChange={(itemValue) => setSelectedClass(itemValue)}
              >
                <Picker.Item label="Fadlan dooro fasal..." value="" />
                {classes.map(c => (
                  <Picker.Item key={c.id} label={c.name} value={c.id.toString()} />
                ))}
              </Picker>
            </View>
          </View>
        )}

        {selectedClass !== '' && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>3. Dooro Section (A, B, C...)</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedSection}
                onValueChange={(itemValue) => setSelectedSection(itemValue)}
              >
                <Picker.Item label="Fadlan dooro qaybta..." value="" />
                <Picker.Item label="Section A" value="A" />
                <Picker.Item label="Section B" value="B" />
                <Picker.Item label="Section C" value="C" />
                <Picker.Item label="Section D" value="D" />
              </Picker>
            </View>
          </View>
        )}

        {loading && <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 20 }} />}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.button, (!selectedSection || loading) && styles.buttonDisabled]} 
          onPress={handleContinue}
          disabled={!selectedSection || loading}
        >
          <Text style={styles.buttonText}>SII SOCO {"->"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: AzureTheme.spacing.xl,
    paddingTop: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: colors.neutral,
    lineHeight: 22,
  },
  scrollContent: {
    padding: AzureTheme.spacing.xl,
    gap: 24,
  },
  formGroup: {
    gap: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.secondary,
  },
  pickerContainer: {
    backgroundColor: colors.background,
    borderRadius: 12 ,
    borderWidth: 1,
    borderColor: colors.border || '#333',
    overflow: 'hidden',
  },
  footer: {
    padding: AzureTheme.spacing.xl,
  },
  button: {
    backgroundColor: colors.card,
    paddingVertical: 18,
    borderRadius: AzureTheme.borderRadius.pill,
    alignItems: 'center' ,
    borderWidth: 1,
    borderColor: colors.border || '#333',
  },
  buttonDisabled: {
    backgroundColor: colors.border,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  }
});
