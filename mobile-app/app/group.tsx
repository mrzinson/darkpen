import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../constants/Config';
import { io } from 'socket.io-client';

const CACHE_KEY = 'cached_groups';

export default function GroupScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors, isDark);

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'your' | 'other'>('your');
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [otherGroups, setOtherGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCache = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setMyGroups(JSON.parse(cached));
      }
    } catch (e) {
      console.error('Cache load error', e);
    }
  };

  const fetchGroups = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      
      // Fetch My Groups
      const myRes = await fetch(`${Config.API_URL}/api/groups/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const myData = await myRes.json();
      if (myRes.ok) {
        // Sorting is already handled by backend ORDER BY last_message_time DESC
        setMyGroups(myData);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(myData));
      }

      // Fetch Other Groups
      const otherRes = await fetch(`${Config.API_URL}/api/groups/public?search=${searchQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const otherData = await otherRes.json();
      if (otherRes.ok) setOtherGroups(otherData);

    } catch (err) {
      console.error('Error fetching groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCache();
    fetchGroups(false); // Initial background fetch

    // Setup real-time updates for the list
    const socket = io(Config.API_URL, { transports: ['websocket'] });
    
    // Listen for any new message in any group
    // We should probably have a 'message_notification' event that targets the user
    // For now, we can refresh the list when ANY message is received if the user is a member
    socket.on('receive_message', () => {
      fetchGroups(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchGroups(false);
    }, [searchQuery, activeTab])
  );

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderGroupItem = (group: any, isMember: boolean) => (
    <TouchableOpacity 
      key={group.id} 
      style={styles.groupCard}
      onPress={() => {
        if (isMember) {
          router.push({ 
            pathname: '/group-chat', 
            params: { id: group.id, name: group.name, icon: group.image_url } 
          });
        } else {
          alert('Fadlan ku biir group-ka si aad u akhrido fariimaha.');
        }
      }}
    >
      <View style={styles.groupIconBox}>
        {group.image_url ? (
          <Image source={{ uri: group.image_url }} style={styles.groupImage} />
        ) : (
          <View style={StyleSheet.flatten([styles.groupIcon, { backgroundColor: colors.primary + '20' }])}>
            <Ionicons name="people" size={28} color={colors.primary} />
          </View>
        )}
      </View>

      <View style={styles.groupInfo}>
        <View style={styles.groupHeaderRow}>
          <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
          {isMember && (group.last_message_time || group.created_at) && (
            <Text style={styles.timeText}>{formatTime(group.last_message_time || group.created_at)}</Text>
          )}
        </View>
        
        <View style={styles.messageRow}>
          <Text style={styles.groupDesc} numberOfLines={1}>
            {isMember ? (group.last_message || group.description || 'No messages yet') : (group.description || 'Public Group')}
          </Text>
          
          {isMember && group.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{group.unread_count}</Text>
            </View>
          )}
          {!isMember && (
            <TouchableOpacity style={styles.joinBtnSmall} onPress={() => handleJoin(group.id)}>
              <Text style={styles.joinBtnTextSmall}>Join</Text>
            </TouchableOpacity>
          )}
          {isMember && group.unread_count === 0 && (
            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const handleJoin = async (groupId: number) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${Config.API_URL}/api/groups/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ groupId })
      });
      if (res.ok) {
        alert('Si guul leh ayaad ugu biirtay!');
        fetchGroups(false);
      } else {
        const data = await res.json();
        alert(data.message);
      }
    } catch (err) {
      alert('Cilad ayaa dhacday');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconBox} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Groups</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/create-group')}>
          <Ionicons name="add" size={26} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={StyleSheet.flatten([styles.tab, activeTab === 'your' && styles.activeTab])} 
          onPress={() => setActiveTab('your')}
        >
          <Text style={StyleSheet.flatten([styles.tabText, activeTab === 'your' && styles.activeTabText])}>Your Groups</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={StyleSheet.flatten([styles.tab, activeTab === 'other' && styles.activeTab])} 
          onPress={() => setActiveTab('other')}
        >
          <Text style={StyleSheet.flatten([styles.tabText, activeTab === 'other' && styles.activeTabText])}>Other Groups</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'other' && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Search groups..." 
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && myGroups.length === 0 ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : activeTab === 'your' ? (
          myGroups.length > 0 ? (
            myGroups.map(g => renderGroupItem(g, true))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#E2E8F0" />
              <Text style={styles.emptyText}>Ma lihid wax group ah wali.</Text>
            </View>
          )
        ) : (
          otherGroups.length > 0 ? (
            otherGroups.map(g => renderGroupItem(g, g.is_member))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={64} color="#E2E8F0" />
              <Text style={styles.emptyText}>Wax group ah lama helin.</Text>
            </View>
          )
        )}
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
    backgroundColor: colors.card,
  },
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    padding: 6,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 14 ,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textLight,
  },
  activeTabText: {
    color: colors.card,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12 ,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: colors.secondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 18,
    marginBottom: 12 ,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  groupImage: {
    width: '100%',
    height: '100%',
  },
  groupIcon: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.secondary,
    flex: 1,
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 8,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupDesc: {
    fontSize: 14,
    color: colors.textLight,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 10,
  },
  unreadText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
  },
  joinBtnSmall: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  joinBtnTextSmall: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
    fontWeight: '500',
  }
});
