import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../constants/Config';
import { io } from 'socket.io-client';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';

const CACHE_KEY_PREFIX = 'cached_messages_';

const USER_COLORS = [
  '#2563EB', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#D97706', '#059669', '#0891B2'
];

const renderFormattedText = (text: string, isDark: boolean, colors: any, defaultTextColor?: string) => {
  if (!text) return null;
  const textColor = defaultTextColor || colors.text;

  // Split by block-level elements
  const blockRegex = /(```[\s\S]*?```|<table_data>[\s\S]*?<\/table_data>|<callout>[\s\S]*?<\/callout>|^#{1,3}\s+[^\n]+)/gm;
  const blocks = text.split(blockRegex);

  const renderInlineText = (inlineText: string, keyPrefix: string) => {
    const inlineRegex = /(\*\*.*?\*\*|<blue>[\s\S]*?<\/blue>|<green>[\s\S]*?<\/green>|<red>[\s\S]*?<\/red>|Q\d+:|A\d+:)/g;
    const parts = inlineText.split(inlineRegex);

    return parts.map((part, index) => {
      if (!part) return null;
      const key = `${keyPrefix}-inline-${index}`;

      if (part.startsWith('**') && part.endsWith('**')) {
        return <Text key={key} style={{ fontWeight: 'bold', color: textColor }}>{part.replace(/\*\*/g, '')}</Text>;
      }
      if (part.startsWith('<blue>') && part.endsWith('</blue>')) {
        return <Text key={key} style={{ color: '#3B82F6', fontWeight: '500' }}>{part.replace(/<\/?blue>/g, '')}</Text>;
      }
      if (part.startsWith('<green>') && part.endsWith('</green>')) {
        const innerText = part.replace(/<\/?green>/g, '');
        const optionMatch = innerText.match(/^([a-zA-Z])\s*[\.\)]\s*(.*)$/);
        if (optionMatch) {
          const letter = optionMatch[1].toUpperCase();
          const restOfText = optionMatch[2];
          return (
            <Text key={key}>
              <View style={{
                backgroundColor: '#22c55e', 
                borderRadius: 10, 
                width: 20, 
                height: 20, 
                justifyContent: 'center', 
                alignItems: 'center',
                marginRight: 6,
                transform: [{ translateY: 3 }]
              }}>
                <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 11, textAlign: 'center', lineHeight: 18 }}>
                  {letter}
                </Text>
              </View>
              {" "}
              <Text style={{ color: '#22c55e', fontWeight: 'bold' }}>{restOfText}</Text>
            </Text>
          );
        }
        return <Text key={key} style={{ color: '#22c55e', fontWeight: 'bold' }}>{innerText}</Text>;
      }
      if (part.startsWith('<red>') && part.endsWith('</red>')) {
        return <Text key={key} style={{ color: '#ef4444', fontWeight: 'bold' }}>{part.replace(/<\/?red>/g, '')}</Text>;
      }
      if (/^Q\d+:$/.test(part)) {
        return <Text key={key} style={{ fontWeight: 'bold', color: '#3B82F6' }}>{part}</Text>;
      }
      if (/^A\d+:$/.test(part)) {
        return <Text key={key} style={{ fontWeight: 'bold', color: '#10B981' }}>{part}</Text>;
      }
      return <Text key={key} style={{ color: textColor }}>{part}</Text>;
    });
  };

  return blocks.map((block, index) => {
    if (!block) return null;
    const blockKey = `block-${index}`;

    // 1. Code Block
    if (block.startsWith('```') && block.endsWith('```')) {
      const match = block.match(/^```(\w*)\n([\s\S]*?)```$/);
      const language = match && match[1] ? match[1] : 'code';
      const codeContent = match ? match[2] : block.replace(/```/g, '');
      return (
        <View key={blockKey} style={{ backgroundColor: '#1e1e1e', borderRadius: 8, marginVertical: 8, overflow: 'hidden', width: '100%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#2d2d2d', paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' }}>
            <Text style={{ color: '#a3a3a3', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{language}</Text>
            <TouchableOpacity 
              onPress={() => {
                Clipboard.setStringAsync(codeContent.trim());
                Alert.alert('Copied', 'Code copied to clipboard');
              }}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Ionicons name="copy-outline" size={14} color="#a3a3a3" />
              <Text style={{ color: '#a3a3a3', fontSize: 12, marginLeft: 4 }}>Copy</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ padding: 12 }}>
            <Text style={{ color: '#e5e7eb', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, lineHeight: 20 }}>
              {codeContent.trim()}
            </Text>
          </ScrollView>
        </View>
      );
    }

    // 2. Callout Block
    if (block.startsWith('<callout>') && block.endsWith('</callout>')) {
      const innerText = block.replace(/<\/?callout>/g, '').trim();
      return (
        <View key={blockKey} style={{ backgroundColor: isDark ? '#2a2b2f' : '#f3f4f6', borderLeftWidth: 4, borderLeftColor: colors.primary, padding: 12, marginVertical: 8, borderRadius: 4, width: '100%' }}>
          <Text style={{ color: textColor, fontSize: 14, fontStyle: 'italic', lineHeight: 22 }}>
            {innerText}
          </Text>
        </View>
      );
    }

    // 3. Table Block
    if (block.startsWith('<table_data>') && block.endsWith('</table_data>')) {
      const innerText = block.replace(/<\/?table_data>/g, '').trim();
      const rows = innerText.split('\n').filter(r => r.trim() !== '');
      if (rows.length === 0) return null;
      return (
        <View key={blockKey} style={{ borderWidth: 1, borderColor: colors.border || '#e5e7eb', borderRadius: 8, marginVertical: 8, overflow: 'hidden', width: '100%' }}>
          {rows.map((row, rIndex) => {
            const cols = row.split('|');
            return (
              <View key={rIndex} style={{ flexDirection: 'row', backgroundColor: rIndex === 0 ? (isDark ? '#27282c' : '#f3f4f6') : (isDark ? '#1e1f22' : '#ffffff'), borderBottomWidth: rIndex < rows.length - 1 ? 1 : 0, borderBottomColor: colors.border || '#e5e7eb' }}>
                {cols.map((col, cIndex) => (
                  <View key={cIndex} style={{ flex: 1, padding: 8, borderRightWidth: cIndex < cols.length - 1 ? 1 : 0, borderRightColor: colors.border || '#e5e7eb' }}>
                    <Text style={{ fontWeight: rIndex === 0 ? 'bold' : 'normal', color: rIndex === 0 ? colors.text : textColor, fontSize: 13 }}>{col.trim()}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      );
    }

    // 4. Headers
    if (block.startsWith('#')) {
      const level = (block.match(/^#+/g) || ['#'])[0].length;
      const headerText = block.replace(/^#+\s+/, '').trim();
      const fontSize = level === 1 ? 18 : level === 2 ? 16 : 14;
      return (
        <View key={blockKey} style={{ marginVertical: 6 }}>
          <Text style={{ fontWeight: 'bold', color: textColor, fontSize }}>{headerText}</Text>
        </View>
      );
    }

    // 5. Default/Paragraph block with inline formatting
    return (
      <View key={blockKey} style={{ marginVertical: 2 }}>
        <Text style={{ lineHeight: 20 }}>
          {renderInlineText(block, blockKey)}
        </Text>
      </View>
    );
  });
};

export default function GroupChatScreen() {
  const { colors, isDark, setTheme, theme } = useTheme();
  const styles = getStyles(colors, isDark);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, name, icon } = useLocalSearchParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const socket = useRef<any>(null);

  // Image Preview States
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [sendingImage, setSendingImage] = useState(false);

  const loadCache = async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY_PREFIX + id);
      if (cached) setMessages(JSON.parse(cached));
      
      const userData = await AsyncStorage.getItem('userData');
      if (userData) setCurrentUserId(JSON.parse(userData).id);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadCache();
    fetchMessages(false);
    setupSocket();
    return () => {
      if (socket.current) socket.current.disconnect();
    };
  }, [id]);

  const setupSocket = async () => {
    socket.current = io(Config.API_URL, { transports: ['websocket'] });
    socket.current.emit('join_room', `group_${id}`);
    socket.current.on('receive_message', (data: any) => {
      setMessages(prev => {
        const newMsgs = [...prev, data];
        AsyncStorage.setItem(CACHE_KEY_PREFIX + id, JSON.stringify(newMsgs));
        return newMsgs;
      });
    });
  };

  const fetchMessages = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${Config.API_URL}/api/groups/${id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(Array.isArray(data) ? data : []);
        await AsyncStorage.setItem(CACHE_KEY_PREFIX + id, JSON.stringify(data));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (contentInput?: string, type: 'text' | 'image' = 'text') => {
    const content = contentInput || inputText.trim();
    if (!content) return;
    if (type === 'text') setInputText('');

    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${Config.API_URL}/api/groups/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ groupId: id, message: content, type })
      });
      
      if (res.ok) {
        const resData = await res.json();
        const serverMessage = resData.message || content;

        const userData = await AsyncStorage.getItem('userData');
        const user = JSON.parse(userData || '{}');
        const newMessage = {
          id: resData.messageId || Date.now(),
          group_id: id,
          user_id: user.id,
          message: serverMessage,
          type,
          sender_name: user.name,
          created_at: new Date().toISOString()
        };
        setMessages(prev => {
           const newMsgs = [...prev, newMessage];
           AsyncStorage.setItem(CACHE_KEY_PREFIX + id, JSON.stringify(newMsgs));
           return newMsgs;
        });
        socket.current.emit('send_message', { room: `group_${id}`, ...newMessage });
      }
    } catch (err) {
      alert('Error sending message');
    }
  };

  const pickImage = async () => {
    Alert.alert(
      'Dir sawir',
      'Xulo meesha aad sawirka ka keenayso',
      [
        { text: 'Camera', onPress: () => openImagePicker(true) },
        { text: 'Photos', onPress: () => openImagePicker(false) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const openImagePicker = async (useCamera: boolean) => {
    let result;
    try {
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Denied', 'Fadlan ogolow kamarada si aad sawir u qaado.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.7,
          base64: true
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Denied', 'Fadlan ogolow gallery-ga si aad sawir u doorato.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.7,
          base64: true
        });
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        let base64Data = result.assets[0].base64;
        if (!base64Data) {
          base64Data = await FileSystem.readAsStringAsync(result.assets[0].uri, {
            encoding: 'base64',
          });
        }
        if (base64Data) {
          setSelectedImage(`data:image/jpeg;base64,${base64Data}`);
          setPreviewVisible(true);
        } else {
          Alert.alert('Error', 'Waa la heli waayay xogta sawirka.');
        }
      }
    } catch (err) {
      console.error('Image Picker Error:', err);
      Alert.alert('Error', 'Waa la heli waayay sawirka');
    }
  };

  const sendImageMessage = async () => {
    if (!selectedImage) return;
    setSendingImage(true);
    // Combine image and caption if exists, or just send image
    // For simplicity, we send the image as the message. If there's a caption, we can send it as a separate text or combined.
    // WhatsApp sends image with caption as ONE message.
    await handleSend(selectedImage, 'image');
    if (imageCaption.trim()) {
      await handleSend(imageCaption.trim(), 'text');
    }
    setSendingImage(false);
    setPreviewVisible(false);
    setSelectedImage(null);
    setImageCaption('');
  };

  const getUserColor = (name: string) => {
    if (!name) return USER_COLORS[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
  };

  const renderDateSeparator = (currentMsg: any, prevMsg: any) => {
    if (!currentMsg.created_at) return null;
    const curDate = new Date(currentMsg.created_at).toDateString();
    const prevDate = prevMsg?.created_at ? new Date(prevMsg.created_at).toDateString() : null;

    if (curDate !== prevDate) {
      let label = curDate;
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (curDate === today) label = 'Today';
      else if (curDate === yesterday) label = 'Yesterday';
      
      return (
        <View style={styles.dateSeparator}>
          <View style={styles.dateLine} />
          <Text style={styles.dateText}>{label}</Text>
          <View style={styles.dateLine} />
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={StyleSheet.flatten([styles.header, { paddingTop: Math.max(insets.top, 10) }])}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/group-details', params: { id, name } })}
      >
        <TouchableOpacity style={styles.headerIconBox} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          {icon ? <Image source={{ uri: icon as string }} style={styles.avatarImg} /> : <Ionicons name="people" size={24} color={colors.primary} />}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.groupName} numberOfLines={1}>{name}</Text>
          <Text style={styles.status}>tap here for group info</Text>
        </View>
        <View style={{ width: 40 }} />
      </TouchableOpacity>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 60}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.chatArea}
          contentContainerStyle={styles.scrollContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, index) => {
            const isMe = msg.user_id === currentUserId;
            const showSender = !isMe && (index === 0 || messages[index-1].user_id !== msg.user_id);
            
            return (
              <React.Fragment key={msg.id || index}>
                {renderDateSeparator(msg, messages[index-1])}
                <View style={StyleSheet.flatten([styles.messageRow, isMe ? styles.myRow : styles.otherRow])}>
                  <View style={StyleSheet.flatten([
                    styles.bubble, 
                    isMe ? styles.myBubble : styles.otherBubble,
                    msg.type === 'image' ? { padding: 4, borderRadius: 12 } : {}
                  ])}>
                    {showSender && <Text style={StyleSheet.flatten([styles.senderName, { color: getUserColor(msg.sender_name) }])}>{msg.sender_name}</Text>}
                    
                    {msg.type === 'image' ? (
                      <Image source={{ uri: msg.message.startsWith('http') || msg.message.startsWith('data:image') ? msg.message : `${Config.API_URL.endsWith('/') ? Config.API_URL.slice(0, -1) : Config.API_URL}${msg.message.startsWith('/') ? msg.message : '/' + msg.message}` }} style={styles.messageImage} resizeMode="cover" />
                    ) : (
                      renderFormattedText(msg.message, isDark, colors, isMe ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937'))
                    )}
                    
                    <Text style={StyleSheet.flatten([styles.time, isMe ? { color: 'rgba(255,255,255,0.7)' } : { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }])}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </Text>
                  </View>
                </View>
              </React.Fragment>
            );
          })}
        </ScrollView>

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            {/* Plus Button */}
            <TouchableOpacity style={styles.plusButtonBox} onPress={pickImage} activeOpacity={0.7}>
              <Ionicons name="add" size={24} color={colors.secondary} />
            </TouchableOpacity>
            
            {/* Text Input Container */}
            <View style={styles.textInputContainer}>
              <TextInput 
                style={StyleSheet.flatten([styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any])}
                placeholder="Type a message..." 
                placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.4)' : '#9CA3AF'}
                value={inputText}
                onChangeText={setInputText}
                multiline
                underlineColorAndroid="transparent"
              />

              <TouchableOpacity 
                style={StyleSheet.flatten([styles.sendBtn, !inputText.trim() ? { opacity: 0.5 } : {}])} 
                onPress={() => handleSend()}
                disabled={!inputText.trim()}
                activeOpacity={0.8}
              >
                <Ionicons name="send" size={18} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Image Preview Modal */}
      <Modal visible={previewVisible} animationType="fade" transparent={true}>
        <View style={styles.previewOverlay}>
          <SafeAreaView style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <TouchableOpacity onPress={() => setPreviewVisible(false)}>
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>
              <Text style={styles.previewTitle}>Preview Image</Text>
              <View style={{ width: 30 }} />
            </View>
            
            <View style={styles.imagePreviewBox}>
              {selectedImage && <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />}
            </View>

            <View style={styles.captionContainer}>
              <TextInput 
                style={styles.captionInput} 
                placeholder="Add a caption..." 
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={imageCaption}
                onChangeText={setImageCaption}
                multiline
              />
              <TouchableOpacity style={styles.previewSendBtn} onPress={sendImageMessage} disabled={sendingImage}>
                {sendingImage ? <ActivityIndicator color="white" /> : <Ionicons name="send" size={24} color="white" />}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
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
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.secondary,
  },
  status: {
    fontSize: 11,
    color: '#94A3B8',
  },
  chatArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 20,
  },
  messageRow: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  myRow: {
    justifyContent: 'flex-end',
  },
  otherRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    padding: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    maxWidth: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  myBubble: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageImage: {
    width: 240,
    height: 240,
    borderRadius: 10,
  },
  time: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dateText: {
    paddingHorizontal: 12,
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  inputContainer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  plusButtonBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 2,
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 4,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: colors.secondary,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 2,
  },
  // Preview Styles
  previewOverlay: {
    flex: 1,
    backgroundColor: 'black',
  },
  previewContainer: {
    flex: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  previewTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  imagePreviewBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  captionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 30,
    margin: 16,
    marginBottom: 40,
  },
  captionInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    paddingHorizontal: 16,
    maxHeight: 100,
  },
  previewSendBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
