import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Image, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../constants/Config';
import * as ImagePicker from 'expo-image-picker';

export default function GroupDetailsScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors);

  const router = useRouter();
  const { id, name } = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [tempImage, setTempImage] = useState<string | null>(null);

  useEffect(() => {
    fetchGroupData();
  }, [id]);

  const fetchGroupData = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const userData = await AsyncStorage.getItem('userData');
      const user = JSON.parse(userData || '{}');
      
      // Fetch members
      const memRes = await fetch(`${Config.API_URL}/api/groups/${id}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const memData = await memRes.json();
      if (memRes.ok) {
        setMembers(Array.isArray(memData) ? memData : []);
        const me = memData.find((m: any) => m.id === user.id);
        if (me && me.role === 'admin') setIsAdmin(true);
      }

      // Fetch specific group info
      const groupsRes = await fetch(`${Config.API_URL}/api/groups/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const groups = await groupsRes.json();
      const current = groups.find((g: any) => g.id == id);
      if (current) {
        setGroupInfo(current);
        setNewName(current.name);
        setNewDesc(current.description || '');
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditOpen = () => {
    setNewName(groupInfo?.name || '');
    setNewDesc(groupInfo?.description || '');
    setTempImage(groupInfo?.image_url || null);
    setEditModalVisible(true);
  };

  const handleUpdateGroup = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/groups/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: newName, 
          description: newDesc,
          image_url: tempImage 
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Cilad ayaa dhacday');
      }

      setGroupInfo({ ...groupInfo, name: newName, description: newDesc, image_url: tempImage });
      setEditModalVisible(false);
      Alert.alert('Guul', 'Group-ka si guul leh ayaa loo cusboonaysiiyey!', [
        { text: 'OK', onPress: () => fetchGroupData() }
      ]);
    } catch (err: any) {
      Alert.alert('Cilad', err.message);
    }
  };

  const pickImage = async () => {
    if (!isAdmin) return;
    Alert.alert(
      'Profile Picture',
      'Xulo sawirka group-ka',
      [
        { text: 'Camera', onPress: () => openImagePicker(true) },
        { text: 'Gallery', onPress: () => openImagePicker(false) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const openImagePicker = async (useCamera: boolean) => {
    let result;
    if (useCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return;
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true
      });
    }

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setTempImage(base64Image);
    }
  };

  const updateGroupIcon = async (base64: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${Config.API_URL}/api/groups/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...groupInfo, image_url: base64 })
      });
      if (res.ok) {
        setGroupInfo({ ...groupInfo, image_url: base64 });
        Alert.alert('Success', 'Group profile updated');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update icon');
    }
  };

  const handleSearch = async () => {
    if (searchQuery.length < 3) return;
    setSearching(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${Config.API_URL}/api/user/search?query=${searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setSearchResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const addMember = async (targetUserId: number, targetName: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${Config.API_URL}/api/groups/add-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ groupId: id, targetUserId })
      });
      if (res.ok) {
        Alert.alert('Guul', `${targetName} waa lagu daray group-ka!`);
        setSearchResults([]);
        setSearchQuery('');
        fetchGroupData();
      } else {
        const data = await res.json();
        Alert.alert('Error', data.message);
      }
    } catch (err) {
      Alert.alert('Error', 'Cilad ayaa dhacday');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconBox} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Group Info</Text>
        {isAdmin ? (
          <TouchableOpacity onPress={handleEditOpen}>
            <Feather name="edit-3" size={20} color={colors.primary} />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoSection}>
          <TouchableOpacity style={styles.groupIconLarge} onPress={pickImage} disabled={!isAdmin}>
            {groupInfo?.image_url ? (
              <Image source={{ uri: Config.getMediaUrl(groupInfo.image_url) || undefined }} style={styles.iconImg} />
            ) : (
              <Ionicons name="people" size={48} color="white" />
            )}
            {isAdmin && (
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={16} color="white" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.groupNameLarge}>{groupInfo?.name || name}</Text>
          <Text style={styles.groupMeta}>{members.length} Members</Text>
          {groupInfo?.description && <Text style={styles.groupDesc}>{groupInfo.description}</Text>}
        </View>

        {/* Rules/Xeerarka Section */}
        <View style={[styles.section, { borderBottomWidth: 1, borderBottomColor: isDark ? '#374151' : '#E5E7EB' }]}>
          <Text style={styles.sectionTitle}>Xeerarka AI-ga ee Kooxda</Text>
          
          <View style={{
            backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#E5E7EB'
          }}>
            <Text style={{
              fontSize: 14,
              color: colors.text,
              fontWeight: '600',
              marginBottom: 10,
              lineHeight: 20
            }}>
              Si aad AI-ga Darkpen ugula hadasho kooxdan, fadlan ogow qiimayaasha credit-ka:
            </Text>

            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.text }}>
                  Su'aalaha Qoraalka ah: <Text style={{ fontWeight: 'bold' }}>10 Credit</Text> (laga jarayo qofka weydiiyey)
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="image-outline" size={18} color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.text }}>
                  Su'aalaha Sawirada ah: <Text style={{ fontWeight: 'bold' }}>20 Credit</Text> (laga jarayo qofka weydiiyey)
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="people-outline" size={18} color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.text }}>
                  Kuwa Kale (Helaya jawaabta): <Text style={{ fontWeight: 'bold' }}>5 Credit</Text> (laga jarayo xubnaha kale ee kooxda)
                </Text>
              </View>
            </View>

            <View style={{
              marginTop: 14,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: isDark ? '#374151' : '#E5E7EB'
            }}>
              <Text style={{
                fontSize: 12,
                color: '#9CA3AF',
                lineHeight: 18
              }}>
                * Fiiro gaar ah: Credit-kaaga waxaad sidoo kale u isticmaali kartaa chat-ka caadiga ah. Haddii credit-kaagu madhan yahay, ma awoodi doontid inaad fariin u dirto kooxda.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          {members.length === 0 && !loading && <Text style={styles.emptyText}>No members found.</Text>}
          {members.map(member => (
            <View key={member.id} style={styles.memberCard}>
              <View style={styles.memberAvatar}>
                {member.profile_picture ? (
                  <Image source={{ uri: Config.getMediaUrl(member.profile_picture) || undefined }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>{member.name?.charAt(0)}</Text>
                )}
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name} {member.id === groupInfo?.created_by && '(Creator)'}</Text>
                <Text style={styles.memberHandle}>@{member.username || 'user'}</Text>
              </View>
              {member.role === 'admin' && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {isAdmin && (
          <View style={[styles.section, { borderTopWidth: 8, borderTopColor: '#F1F5F9' }]}>
            <Text style={styles.sectionTitle}>Add New Member</Text>
            <View style={styles.searchRow}>
              <TextInput 
                style={styles.searchInput} 
                placeholder="Name, email or username..." 
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                {searching ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="search" size={20} color="white" />}
              </TouchableOpacity>
            </View>

            {searchResults.map(user => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userHandle}>@{user.username || 'user'}</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => addMember(user.id, user.name)}>
                  <Ionicons name="person-add" size={18} color="white" />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Group Details</Text>
            
            {/* Image Picker in Modal */}
            <TouchableOpacity style={styles.modalImageSection} onPress={pickImage}>
              {tempImage ? (
                <Image source={{ uri: tempImage }} style={styles.modalImage} />
              ) : (
                <View style={styles.modalImagePlaceholder}>
                  <Feather name="users" color="#FFF" size={40} />
                </View>
              )}
              <View style={styles.modalEditBadge}>
                <Feather name="camera" size={16} color="#FFF" />
              </View>
            </TouchableOpacity>

            <TextInput 
              style={styles.modalInput} 
              placeholder="Group Name" 
              value={newName} 
              onChangeText={setNewName} 
            />
            <TextInput 
              style={[styles.modalInput, { height: 100 }]} 
              placeholder="Description" 
              value={newDesc} 
              onChangeText={setNewDesc} 
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateGroup}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  infoSection: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  groupIconLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  iconImg: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupNameLarge: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.secondary,
  },
  groupMeta: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 4,
  },
  groupDesc: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 16,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.secondary,
  },
  memberHandle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4 ,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  adminBadgeText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.background ,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  searchBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.secondary,
  },
  userHandle: {
    fontSize: 12,
    color: colors.textLight,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: colors.background ,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    fontWeight: '700',
    color: colors.textLight,
  },
  saveBtn: {
    flex: 2,
    padding: 16,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  saveBtnText: {
    fontWeight: '700',
    color: 'white',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 10,
  },
  modalImageSection: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    marginBottom: 20,
    position: 'relative',
    marginTop: 10,
  },
  modalImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  modalImagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalEditBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
