import { useTheme } from '../../context/ThemeContext';
import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, TextInput, 
  KeyboardAvoidingView, Platform, ScrollView, Animated, Dimensions, Pressable, Keyboard
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { AuthGuard } from '../../components/AuthGuard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Config from '../../constants/Config';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker'; // For attachment support later if needed

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.75;

type Message = { 
  id: string; 
  text: string; 
  sender: 'user' | 'ai';
  image?: string;
};

const INITIAL_MESSAGES: Message[] = [];

export default function ShukaansiScreen() {
  const { colors, isDark, setTheme, theme, t, language } = useTheme();
  const styles = getStyles(colors, isDark);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [attachment, setAttachment] = useState<{ uri: string, base64: string, mimeType: string, name: string } | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<string | null>(null);
  
  // Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Sidebar starts off-screen to the right by its full width
  const sidebarAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Attachment Menu State
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const attachAnim = useRef(new Animated.Value(300)).current; 

  // Send Button Animation State
  const sendTranslateX = useRef(new Animated.Value(0)).current;
  const sendTranslateY = useRef(new Animated.Value(0)).current;
  const sendOpacity = useRef(new Animated.Value(1)).current;

  const scrollViewRef = useRef<ScrollView>(null);

  // Sidebar Animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(sidebarAnim, {
        toValue: isSidebarOpen ? 0 : SIDEBAR_WIDTH, // 0 means it's sitting exactly at right: 0
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: isSidebarOpen ? 1 : 0, 
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
  }, [isSidebarOpen]);

  // Attachment Menu Animation
  useEffect(() => {
    Animated.spring(attachAnim, {
      toValue: isAttachOpen ? 0 : 300,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [isAttachOpen]);

  const toggleSidebar = () => {
    Keyboard.dismiss();
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleAttachMenu = () => {
    Keyboard.dismiss();
    setIsAttachOpen(!isAttachOpen);
  };

  const closeOverlays = () => {
    if (isSidebarOpen) setIsSidebarOpen(false);
    if (isAttachOpen) setIsAttachOpen(false);
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
    setShowScrollBottom(!isCloseToBottom);
  };

  const startRecording = async () => {
    try {
      if (isRecording || recording) {
        await stopRecording();
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === 'granted') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setRecording(newRecording);
        setIsRecording(true);
      } else {
        alert('Fadlan oggolow makarafoonka si aad cod u duubto.');
      }
    } catch (err) {
      console.error('Failed to start recording', err);
      setRecording(null);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    
    const currentRecording = recording;
    setRecording(null);
    setIsRecording(false);
    setIsTranscribing(true);

    try {
      await currentRecording.stopAndUnloadAsync();
      const uri = currentRecording.getURI();
      
      if (uri) {
        const token = await AsyncStorage.getItem('userToken');
        const formData = new FormData();
        
        if (Platform.OS === 'web') {
          const response = await fetch(uri);
          const blob = await response.blob();
          formData.append('audio', blob, 'voice_note.m4a');
        } else {
          const platformUri = Platform.OS === 'ios' ? uri.replace('file://', '') : uri;
          formData.append('audio', {
            uri: platformUri,
            name: 'voice_note.m4a',
            type: 'audio/mp4'
          } as any);
        }

        const res = await fetch(`${Config.API_URL}/api/chat/voice`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        const data = await res.json();
        if (res.ok && data.text) {
          setInputText(data.text);
          fetchCredits(); // Refresh credits
        } else {
          alert('Lama fahmin codkaaga.');
        }
      }
    } catch (error) {
      console.error('Failed to stop recording', error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        const asset = result.assets[0];
        setAttachment({
          uri: asset.uri,
          base64: asset.base64 || '',
          mimeType: asset.mimeType || 'image/jpeg',
          name: asset.fileName || 'upload.jpg'
        });
        setIsAttachOpen(false);
      }
    } catch (err) {
      console.error('Pick Image Error:', err);
    }
  };

  const fetchCredits = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/chat/shukaansi-profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setCredits(data.balance);
        setSubscriptionType(data.subscription?.type || null);
      }
    } catch (error) {
      console.error('Error fetching shukaansi credits:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/chat/shukaansi-history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        if (data.length > 0) {
          setMessages(data.map((m: any, idx: number) => ({
            id: m.id || idx.toString(),
            text: m.message,
            sender: m.sender,
            image: m.image ? `${Config.API_URL}${m.image}` : undefined
          })));
        } else {
          // If no history, show welcome message
          setMessages([{ id: 'welcome', text: t('welcome_love'), sender: 'ai' }]);
        }
      }
    } catch (error) {
      console.error('Error fetching shukaansi history:', error);
    }
  };

  useEffect(() => {
    fetchCredits();
    fetchHistory();
  }, [language]);

  const [isAiTyping, setIsAiTyping] = useState(false);

  const handleSend = async () => {
    if ((!inputText.trim() && !attachment) || isAiTyping) return;

    const userText = inputText.trim();
    const currentAttachment = attachment;
    
    setInputText('');
    setAttachment(null);
    setIsAiTyping(true);

    // Play Send Animation
    Animated.parallel([
      Animated.timing(sendTranslateX, { toValue: 30, duration: 200, useNativeDriver: true }),
      Animated.timing(sendTranslateY, { toValue: -30, duration: 200, useNativeDriver: true }),
      Animated.timing(sendOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      sendTranslateX.setValue(-30);
      sendTranslateY.setValue(30);
      Animated.parallel([
        Animated.spring(sendTranslateX, { toValue: 0, useNativeDriver: true, friction: 6 }),
        Animated.spring(sendTranslateY, { toValue: 0, useNativeDriver: true, friction: 6 }),
        Animated.timing(sendOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    });

    const newUserMsg: Message = { 
      id: Date.now().toString(), 
      text: userText, 
      sender: 'user',
      image: currentAttachment?.uri
    };
    const aiMsgId = (Date.now() + 1).toString();
    const newAiMsg: Message = { id: aiMsgId, text: 'Thinking...', sender: 'ai' };
    setMessages(prev => [...prev, newUserMsg, newAiMsg]);

    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/chat/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          message: userText, 
          chatType: 'shukaansi',
          attachment: currentAttachment ? {
            base64: currentAttachment.base64,
            mimeType: currentAttachment.mimeType,
            name: currentAttachment.name
          } : null
        })
      });

      if (response.status === 402) {
        setMessages(prev => prev.filter(m => m.id !== aiMsgId));
        setIsAiTyping(false);
        return router.push({
          pathname: '/billing',
          params: { chatType: 'shukaansi' }
        });
      }

      const data = await response.json();
      if (response.ok) {
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: data.message } : m));
        fetchCredits(); // Refresh credits here
      } else {
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: 'Cilad: ' + data.message } : m));
      }
    } catch (error) {
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { 
        ...m, 
        text: 'Waan ka xumahay, laakiin hadda internet-kaagu ma shaqaynayo. Fadlan ku soo noqo markaad xidhiidh hesho si aan u wada hadallo! ❤️' 
      } : m));
    } finally {
      setIsAiTyping(false);
    }
  };

  return (
    <AuthGuard>
    <SafeAreaView style={styles.container} edges={['top']}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerIconBox} onPress={() => router.navigate('/')} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.secondary} />
          </TouchableOpacity>
          
          <BlurView intensity={40} tint="light" style={styles.nameBadgeBlur}>
            <Text style={styles.aiName}>M Y   L O V E</Text>
          </BlurView>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBox} activeOpacity={0.7}>
            <Ionicons name="call-outline" size={22} color={colors.secondary} />
          </TouchableOpacity>
          
          <View style={{ width: 10 }} />
          
          <TouchableOpacity style={styles.headerIconBox} onPress={toggleSidebar} activeOpacity={0.7}>
            <Ionicons name="menu-outline" size={24} color={colors.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* CHAT AREA WITH KEYBOARD AVOIDING */}
      <KeyboardAvoidingView 
        style={styles.chatArea} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={{ flex: 1 }} // This fixes the input floating in the middle! It forces ScrollView to expand.
          contentContainerStyle={styles.scrollContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map(msg => (
            <View key={msg.id} style={[
              styles.messageRow, 
              msg.sender === 'user' ? styles.messageRowUser : styles.messageRowAi
            ]}>
              <View style={[
                styles.messageContent,
                msg.sender === 'user' ? styles.messageContentUser : styles.messageContentAi
              ]}>
                {msg.image && (
                  <View style={styles.imageContainer}>
                    <Animated.Image 
                      source={{ uri: msg.image }} 
                      style={styles.messageImage}
                      resizeMode="cover"
                    />
                  </View>
                )}
                {msg.text ? (
                  msg.sender === 'ai' ? (
                    <BlurView 
                      intensity={isDark ? 45 : 75} 
                      tint={isDark ? 'dark' : 'light'} 
                      style={StyleSheet.flatten([styles.messageBubble, styles.messageBubbleAi, { overflow: 'hidden' }])}
                    >
                      <Text style={StyleSheet.flatten([styles.messageText, styles.messageTextAi])}>
                        {msg.text}
                      </Text>
                    </BlurView>
                  ) : (
                    <View style={StyleSheet.flatten([styles.messageBubble, styles.messageBubbleUser])}>
                      <Text style={StyleSheet.flatten([styles.messageText, styles.messageTextUser])}>
                        {msg.text}
                      </Text>
                    </View>
                  )
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>

        {showScrollBottom && (
          <TouchableOpacity 
            style={styles.scrollBottomBtn} 
            onPress={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-down" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}

        {/* Attachment Preview */}
        {attachment && (
          <View style={styles.attachmentPreview}>
            <View style={styles.previewImageWrapper}>
              <Animated.Image source={{ uri: attachment.uri }} style={styles.previewImage} />
              <TouchableOpacity style={styles.removeAttachment} onPress={() => setAttachment(null)}>
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Solid Input Area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            
            {/* Plus Button */}
            <TouchableOpacity style={styles.plusButtonBox} onPress={toggleAttachMenu} activeOpacity={0.7}>
              <Ionicons name="add" size={24} color={colors.secondary} />
            </TouchableOpacity>
            
            {/* Text Input Container */}
            <View style={styles.textInputContainer}>
              <TextInput 
                style={[styles.textInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                placeholder={isTranscribing ? t('transcribing') : t('placeholder_love')}
                placeholderTextColor="#9CA3AF"
                value={inputText}
                onChangeText={setInputText}
                multiline={true} 
                maxLength={1000}
                underlineColorAndroid="transparent"
                editable={!isTranscribing}
              />

              {inputText.trim() ? (
                /* Send Button */
                <TouchableOpacity 
                  style={[styles.sendButtonBox, styles.sendButtonActive]} 
                  onPress={handleSend}
                  activeOpacity={0.8}
                >
                  <Animated.View style={{ 
                    transform: [
                      { translateX: sendTranslateX },
                      { translateY: sendTranslateY }
                    ],
                    opacity: sendOpacity 
                  }}>
                    <Ionicons name="arrow-forward" size={18} color="white" />
                  </Animated.View>
                </TouchableOpacity>
              ) : (
                /* Microphone Button */
                <TouchableOpacity 
                  style={[
                    styles.sendButtonBox, 
                    isRecording ? styles.recordingButton : styles.micButton
                  ]} 
                  onPressIn={startRecording}
                  onPressOut={stopRecording}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={isRecording ? "stop" : "mic-outline"} 
                    size={20} 
                    color="white" 
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* GLOBAL OVERLAY */}
      {/* We keep it mounted so animations play, but toggle pointerEvents so it doesn't block clicks when closed */}
      <Animated.View style={[styles.globalOverlay, { opacity: overlayAnim }]} pointerEvents={isSidebarOpen ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={closeOverlays}>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
        </Pressable>
      </Animated.View>

      {/* INVISIBLE OVERLAY FOR ATTACHMENT MENU TO CLOSE IT WHEN CLICKED OUTSIDE */}
      {isAttachOpen && !isSidebarOpen && (
        <Pressable style={[StyleSheet.absoluteFillObject, { zIndex: 101 }]} onPress={closeOverlays} />
      )}

      {/* ATTACHMENT BOTTOM SHEET */}
      <Animated.View style={[styles.attachSheet, { transform: [{ translateY: attachAnim }] }]} pointerEvents={isAttachOpen ? 'auto' : 'none'}>
        <View style={styles.attachCard}>
          <View style={styles.attachHandle} />
          
          <View style={styles.attachGrid}>
            <TouchableOpacity style={styles.attachItem}>
              <View style={styles.attachIconBg}>
                <Ionicons name="camera-outline" size={32} color={colors.secondary} />
              </View>
              <Text style={styles.attachLabel}>Camera</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.attachItem} onPress={pickImage}>
              <View style={styles.attachIconBg}>
                <Ionicons name="image-outline" size={32} color={colors.secondary} />
              </View>
              <Text style={styles.attachLabel}>Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.attachItem}>
              <View style={styles.attachIconBg}>
                <Ionicons name="document-text-outline" size={32} color={colors.secondary} />
              </View>
              <Text style={styles.attachLabel}>Document</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* SIDEBAR PANEL */}
      <Animated.View style={[styles.sidebarPanel, { transform: [{ translateX: sidebarAnim }] }]} pointerEvents={isSidebarOpen ? 'auto' : 'none'}>
        <View style={{ flex: 1, paddingTop: Math.max(insets.top, 20) }}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Settings</Text>
            <TouchableOpacity onPress={toggleSidebar} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
              <Ionicons name="close" size={28} color={colors.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sidebarContent}>
            <View style={styles.pointsCard}>
              <View style={styles.pointsHeaderRow}>
                <Ionicons name="flash" size={24} color="#F59E0B" />
                <Text style={styles.pointsAmount}>
                  {subscriptionType === 'monthly_11' ? t('premium_unlimited') :
                   subscriptionType === 'monthly_3' ? t('basic_unlimited') :
                   credits !== null ? `${credits} ${t('credits')}` : t('loading')}
                </Text>
              </View>
              <Text style={styles.pointsDesc}>
                {t('love_points_desc').replace('{credits}', String(credits || 0))}
              </Text>
              
              <TouchableOpacity 
                style={styles.buyButton} 
                activeOpacity={0.8}
                onPress={() => {
                  closeOverlays();
                  router.push({
                    pathname: '/billing',
                    params: { chatType: 'shukaansi' }
                  });
                }}
              >
                <Text style={styles.buyButtonText}>{t('buy_more_points')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.sidebarFooter}>
            <TouchableOpacity style={styles.footerItem}>
              <Ionicons name="settings-outline" size={24} color={colors.secondary} />
              <Text style={styles.footerItemText}>AI Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

    </SafeAreaView>
    </AuthGuard>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card, 
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
    backgroundColor: colors.card,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20 ,
    borderWidth: 1,
    borderColor: colors.border || '#333',
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameBadgeBlur: {
    marginLeft: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
    overflow: 'hidden' ,
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.2)',
  },
  aiName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Chat Area
  chatArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1, // Ensures content can grow and push input down
  },
  scrollBottomBtn: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card ,
    borderWidth: 1,
    borderColor: colors.border || '#333',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAi: {
    justifyContent: 'flex-start',
  },
  messageContent: {
    maxWidth: '85%',
    gap: 4,
  },
  messageContentUser: {
    alignItems: 'flex-end',
  },
  messageContentAi: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageBubbleUser: {
    backgroundColor: isDark ? '#2563EB' : colors.primary,
    borderBottomRightRadius: 4,
    borderTopRightRadius: 16,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  messageBubbleAi: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.45)',
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.08)',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextUser: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  messageTextAi: {
    color: isDark ? '#FFFFFF' : '#1E293B', 
  },
  imageContainer: {
    borderRadius: 15,
    overflow: 'hidden' ,
    borderWidth: 1,
    borderColor: colors.border || '#333',
    backgroundColor: colors.background,
  },
  messageImage: {
    width: width * 0.7,
    height: 250,
  },
  attachmentPreview: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: colors.card,
  },
  previewImageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative' ,
    borderWidth: 1,
    borderColor: colors.border || '#333',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeAttachment: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.card,
    borderRadius: 12,
  },

  // Solid Input Area
  inputContainer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.background,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end', // Aligns items to bottom when text input grows
    paddingHorizontal: 16,
    paddingTop: 12,
    minHeight: 60, 
  },
  plusButtonBox: {
    width: 44,
    height: 44,
    borderRadius: 22 ,
    borderWidth: 1,
    borderColor: colors.border || '#333',
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 4,
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.background ,
    borderWidth: 1,
    borderColor: colors.border || '#333',
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
  sendButtonBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 2,
  },
  sendButtonActive: {
    backgroundColor: colors.card ,
    borderWidth: 1,
    borderColor: colors.border || '#333',
  },
  sendButtonInactive: {
    backgroundColor: '#E5E7EB',
  },
  micButton: {
    backgroundColor: colors.card ,
    borderWidth: 1,
    borderColor: colors.border || '#333',
  },
  recordingButton: {
    backgroundColor: '#EF4444', // Red for recording
  },

  // Global Overlay
  globalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  
  // Attach Bottom Sheet
  attachSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 102,
    elevation: 102,
    backgroundColor: 'transparent',
  },
  attachCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  attachHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  attachGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  attachItem: {
    alignItems: 'center',
    width: '30%',
  },
  attachIconBg: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.background ,
    borderWidth: 1,
    borderColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },

  // Sidebar Panel
  sidebarPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0, // CRITICAL FIX: Align to right explicitly instead of animating from left
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.card,
    zIndex: 101,
    elevation: 101,
    shadowColor: '#000',
    shadowOffset: { width: -5, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.secondary,
  },
  sidebarContent: {
    flex: 1,
    padding: 24,
  },
  pointsCard: {
    backgroundColor: '#FFFBEB',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pointsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pointsAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#B45309',
    marginLeft: 8,
  },
  pointsDesc: {
    fontSize: 14,
    color: '#B45309',
    lineHeight: 22,
    marginBottom: 20,
  },
  buyButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  buyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  sidebarFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  footerItemText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.secondary,
    marginLeft: 12,
  }
});
