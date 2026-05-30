import { AzureTheme } from '../constants/AzureTheme';
import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Config from '../constants/Config';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthGuard } from '../components/AuthGuard';

export default function EditProfileScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    gender: '',
    country: '',
    region_state: '',
    profile_picture: ''
  });

  useEffect(() => {
    // Load initial data
    AsyncStorage.getItem('userData').then(data => {
      if (data) {
        const user = JSON.parse(data);
        setForm(prev => ({
          ...prev,
          name: user.name || '',
          username: user.username || '',
          email: user.email || '',
          gender: user.gender || '',
          country: user.country || '',
          region_state: user.region_state || '',
          profile_picture: user.profile_picture || ''
        }));
      }
    });
  }, []);

  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setForm({ ...form, profile_picture: base64Image });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) throw new Error("Authentication error");

      const apiUrl = Config.API_URL;
      
      const updateData: any = {};
      if (form.name) updateData.name = form.name;
      if (form.username) updateData.username = form.username;
      updateData.email = form.email.trim();
      if (form.gender) updateData.gender = form.gender;
      updateData.country = form.country;
      updateData.region_state = form.country === 'Somalia' ? form.region_state : null;
      if (form.profile_picture) updateData.profile_picture = form.profile_picture;
      if (form.password) updateData.password = form.password;

      const response = await fetch(`${apiUrl}/api/user/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Cilad ayaa dhacday');
      }

      await AsyncStorage.setItem('userData', JSON.stringify(data.user));
      
      // Clear books/exams cache to fetch new region specific data
      await AsyncStorage.removeItem('home_books');
      await AsyncStorage.removeItem('home_exams');
      await AsyncStorage.removeItem('manhajka_books');
      await AsyncStorage.removeItem('exams_list');

      if (Platform.OS === 'web') {
        alert('Profile-ka si guul leh ayaa loo bedelay!');
        router.back();
      } else {
        Alert.alert('Guul', 'Profile-ka si guul leh ayaa loo bedelay!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }

    } catch (err: any) {
      if (Platform.OS === 'web') {
        alert(err.message);
      } else {
        Alert.alert('Cilad', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.secondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading}>
            <Text style={styles.saveBtn}>{loading ? 'Saving' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
              {form.profile_picture ? (
                <Image source={{ uri: Config.getMediaUrl(form.profile_picture) || undefined }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="camera" size={40} color="white" />
                </View>
              )}
              <View style={styles.editIconBadge}>
                <Ionicons name="pencil" size={16} color="white" />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Tap to change photo</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Your name"
              value={form.name}
              onChangeText={(t) => setForm({...form, name: t})}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput 
              style={styles.input} 
              placeholder="@username"
              autoCapitalize="none"
              value={form.username}
              onChangeText={(t) => setForm({...form, username: t.replace(/\s/g, '').toLowerCase()})}
            />
            <Text style={styles.hint}>You can change your username once every 20 days.</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email (Optional)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Add recovery email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(t) => setForm({...form, email: t})}
            />
            <Text style={styles.hint}>Waxaa loo isticmaalaa password reset haddii aad password-ka ilowdo.</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Gender (Required for AI)</Text>
            <View style={styles.genderRow}>
              <TouchableOpacity 
                style={[styles.genderBtn, form.gender === 'male' && styles.genderBtnActive]}
                onPress={() => setForm({...form, gender: 'male'})}
              >
                <Ionicons name="male" size={20} color={form.gender === 'male' ? 'white' : colors.primary} />
                <Text style={[styles.genderText, form.gender === 'male' && styles.genderTextActive]}>Male</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.genderBtn, form.gender === 'female' && styles.genderBtnActive]}
                onPress={() => setForm({...form, gender: 'female'})}
              >
                <Ionicons name="female" size={20} color={form.gender === 'female' ? 'white' : colors.primary} />
                <Text style={[styles.genderText, form.gender === 'female' && styles.genderTextActive]}>Female</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Country Selection */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Country (Wadanka)</Text>
            <View style={styles.gridContainer}>
              {['Somaliland', 'Somalia', 'Kenya', 'Ethiopia', 'Nairobi'].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.gridBtn, form.country === c && styles.gridBtnActive]}
                  onPress={() => setForm({ ...form, country: c, region_state: '' })}
                >
                  <Text style={[styles.gridBtnText, form.country === c && styles.gridBtnTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Or type other country..."
              value={['Somaliland', 'Somalia', 'Kenya', 'Ethiopia', 'Nairobi'].includes(form.country) ? '' : form.country}
              onChangeText={(t) => setForm({ ...form, country: t, region_state: '' })}
            />
          </View>

          {/* Regional State (Visible only if Somalia is selected) */}
          {form.country === 'Somalia' && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Regional State (Maamul Goboleedka)</Text>
              <View style={styles.stateSelectContainer}>
                {[
                  'Puntland',
                  'Jubaland',
                  'Galmudug',
                  'Hirshabelle',
                  'South West State',
                  'SSC Khatumo',
                  'Villa Somalia / Mogadishu (Banaadir)'
                ].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.stateSelectBtn, form.region_state === s && styles.stateSelectBtnActive]}
                    onPress={() => setForm({ ...form, region_state: s })}
                  >
                    <Text style={[styles.stateSelectText, form.region_state === s && styles.stateSelectTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>New Password (Optional)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Leave blank to keep current"
              secureTextEntry
              value={form.password}
              onChangeText={(t) => setForm({...form, password: t})}
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </AuthGuard>
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
    paddingHorizontal: AzureTheme.spacing.l,
    paddingVertical: AzureTheme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.secondary,
  },
  saveBtn: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  content: {
    padding: AzureTheme.spacing.l,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: AzureTheme.spacing.xxl,
    marginTop: AzureTheme.spacing.m,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.secondary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  avatarHint: {
    marginTop: 12,
    fontSize: 14,
    color: colors.neutral,
    fontWeight: '500',
  },
  formGroup: {
    marginBottom: AzureTheme.spacing.xl,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 12,
    color: colors.neutral,
    marginTop: 6,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: colors.text,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 16,
  },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border || '#333',
    backgroundColor: colors.card,
    gap: 8,
  },
  genderBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  genderText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.secondary,
  },
  genderTextActive: {
    color: 'white',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  gridBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border || '#333',
    backgroundColor: colors.card,
    minWidth: '28%',
    alignItems: 'center',
  },
  gridBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  gridBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondary,
  },
  gridBtnTextActive: {
    color: 'white',
  },
  stateSelectContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  stateSelectBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border || '#333',
    backgroundColor: colors.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stateSelectBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  stateSelectText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.secondary,
  },
  stateSelectTextActive: {
    color: 'white',
  }
});
