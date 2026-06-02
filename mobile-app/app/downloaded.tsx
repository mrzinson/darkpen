import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getDownloadedDocs, removeDownload, DownloadedDoc } from '../utils/downloadManager';

const { width } = Dimensions.get('window');

export default function DownloadedScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'book' | 'exam'>('book');
  const [downloadedList, setDownloadedList] = useState<DownloadedDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadDownloads = async () => {
    const list = await getDownloadedDocs();
    setDownloadedList(list);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadDownloads();
    }, [])
  );

  const handleDelete = (item: DownloadedDoc) => {
    Alert.alert(
      'Ma hubtaa?',
      `Ma rabtaa inaad tirtirto "${item.title}"?`,
      [
        { text: 'Maya', style: 'cancel' },
        { 
          text: 'Haa, Tirtir', 
          style: 'destructive',
          onPress: async () => {
            await removeDownload(item.pdfUrl);
            await loadDownloads();
          }
        }
      ]
    );
  };

  const handleOpen = (item: DownloadedDoc) => {
    router.push({
      pathname: '/readerexam',
      params: {
        pdfUrl: item.localPath, // Pass the local file:// path directly!
        title: item.title
      }
    });
  };

  const filteredItems = downloadedList.filter(item => {
    const matchesTab = item.type === activeTab;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Downloaded (Offline)</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={colors.secondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Ka baadh halkan..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'book' && styles.tabButtonActive]}
          onPress={() => setActiveTab('book')}
          activeOpacity={0.8}
        >
          <Ionicons name="book-outline" size={18} color={activeTab === 'book' ? '#3B82F6' : colors.secondary} style={{ marginRight: 6 }} />
          <Text style={[styles.tabText, activeTab === 'book' && styles.tabTextActive]}>Buugaagta</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'exam' && styles.tabButtonActive]}
          onPress={() => setActiveTab('exam')}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text-outline" size={18} color={activeTab === 'exam' ? '#3B82F6' : colors.secondary} style={{ marginRight: 6 }} />
          <Text style={[styles.tabText, activeTab === 'exam' && styles.tabTextActive]}>Imtixaanada</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filteredItems.length > 0 ? (
          filteredItems.map(item => (
            <TouchableOpacity 
              key={item.pdfUrl} 
              style={styles.card} 
              onPress={() => handleOpen(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconContainer, { backgroundColor: item.type === 'exam' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons 
                  name={item.type === 'exam' ? 'document-text' : 'book'} 
                  size={28} 
                  color={item.type === 'exam' ? '#EF4444' : '#3B82F6'} 
                />
              </View>
              
              <View style={styles.infoContainer}>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.itemMeta}>
                  {item.grade ? `${item.grade} • ` : ''}Offline Ready
                </Text>
              </View>

              <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-download-outline" size={80} color={colors.border || '#E5E7EB'} />
            <Text style={styles.emptyTitle}>Ma jiraan wax dejisan</Text>
            <Text style={styles.emptyDesc}>
              Deji buugaag ama imtixaano si aad halkan uga akhrisato offline ahaan adoon u baahnayn internet.
            </Text>
          </View>
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
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#1E293B' : '#F1F5F9',
    backgroundColor: colors.card,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.secondary,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.card,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#1E293B' : '#F1F5F9',
    backgroundColor: colors.card,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.secondary,
  },
  tabTextActive: {
    color: '#3B82F6',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: isDark ? '#1E293B' : '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 12,
    color: colors.textLight || '#9CA3AF',
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.secondary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textLight || '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  }
});
