import { useTheme } from '../context/ThemeContext';
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Animated, Dimensions, Pressable, Keyboard, PanResponder, Modal, Alert
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Config from '../constants/Config';
import { AuthGuard } from '../components/AuthGuard';
import { Image } from 'expo-image';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { ErrorState } from '../components/ErrorState';
import { Audio } from 'expo-av';
import { AppLogo } from '../components/AppLogo';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.75;

type MessageStatus = 'thinking' | 'streaming' | 'complete';
type Attachment = { uri: string; base64: string; mimeType: string; name: string };
type Message = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  status?: MessageStatus;
  image?: string;
  images?: string[];
};

const INITIAL_MESSAGES: Message[] = [];

const renderFormattedText = (text: string, isDark: boolean, colors: any) => {
  if (!text) return null;

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
        return <Text key={key} style={{ fontWeight: 'bold', color: colors.text }}>{part.replace(/\*\*/g, '')}</Text>;
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
              <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 11, backgroundColor: '#22c55e', borderRadius: 10 }}>
                {` ${letter} `}
              </Text>
              <Text style={{ color: '#22c55e', fontWeight: 'bold' }}>{' '}{restOfText}</Text>
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
      return <Text key={key} style={{ color: colors.text }}>{part}</Text>;
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
          <Text style={{ color: colors.text, fontSize: 14, fontStyle: 'italic', lineHeight: 22 }}>
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
                    <Text style={{ fontWeight: rIndex === 0 ? 'bold' : 'normal', color: colors.text, fontSize: 13 }}>{col.trim()}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      );
    }

    // 4. Header Block
    if (/^#{1,3}\s+/.test(block)) {
      const level = block.match(/^(#{1,3})/)?.[1].length || 1;
      const innerText = block.replace(/^#{1,3}\s+/, '').trim();
      const fontSize = level === 1 ? 22 : level === 2 ? 19 : 16;
      const marginTop = level === 1 ? 16 : 12;
      return (
        <Text key={blockKey} style={{ fontSize, fontWeight: 'bold', color: colors.text, marginTop, marginBottom: 8, lineHeight: fontSize * 1.3 }}>
          {innerText}
        </Text>
      );
    }

    // 5. Normal text block with potential line breaks and lists
    const lines = block.split('\n');
    return (
      <View key={blockKey} style={{ width: '100%', marginVertical: 2 }}>
        {lines.map((line, lIndex) => {
          const trimmedLine = line.trim();
          if (trimmedLine === '') {
            return <View key={lIndex} style={{ height: 8 }} />;
          }

          // Bullet Point Check
          const bulletMatch = line.match(/^(\s*)[-\*•]\s+(.*)$/);
          if (bulletMatch) {
            const indent = bulletMatch[1].length * 10;
            const content = bulletMatch[2];
            return (
              <View key={lIndex} style={{ flexDirection: 'row', paddingLeft: indent + 12, marginVertical: 3, alignItems: 'flex-start' }}>
                <Text style={{ color: colors.primary, fontSize: 15, marginRight: 8, lineHeight: 22 }}>•</Text>
                <Text style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>
                  {renderInlineText(content, `${blockKey}-line-${lIndex}`)}
                </Text>
              </View>
            );
          }

          // Numbered List Check
          const numberMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
          if (numberMatch) {
            const indent = numberMatch[1].length * 10;
            const number = numberMatch[2];
            const content = numberMatch[3];
            return (
              <View key={lIndex} style={{ flexDirection: 'row', paddingLeft: indent + 12, marginVertical: 3, alignItems: 'flex-start' }}>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 14, marginRight: 8, lineHeight: 22 }}>{number}.</Text>
                <Text style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>
                  {renderInlineText(content, `${blockKey}-line-${lIndex}`)}
                </Text>
              </View>
            );
          }

          // Standard paragraph line
          return (
            <Text key={lIndex} style={{ fontSize: 15, lineHeight: 24, color: colors.text, marginVertical: 2 }}>
              {renderInlineText(line, `${blockKey}-line-${lIndex}`)}
            </Text>
          );
        })}
      </View>
    );
  });
};

export default function ChatScreen() {
  const { colors, isDark, setTheme, theme, t, language } = useTheme();
  const styles = getStyles(colors, isDark);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);

  useEffect(() => {
    if (messages.length === 0 || (messages.length === 1 && messages[0].sender === 'ai')) {
      setMessages([
        { id: '1', text: t('welcome_ai'), sender: 'ai', status: 'complete' }
      ]);
    }
  }, [language]);
  const [inputText, setInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<string | null>(null);
  const [thinkingStatus, setThinkingStatus] = useState<string>('');
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);

  // Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Send Button Animation State
  const sendTranslateX = useRef(new Animated.Value(0)).current;
  const sendTranslateY = useRef(new Animated.Value(0)).current;
  const sendOpacity = useRef(new Animated.Value(1)).current;

  // Attachment Menu State
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const attachAnim = useRef(new Animated.Value(300)).current;

  // Thinking Animation
  const thinkingDot1 = useRef(new Animated.Value(0)).current;
  const thinkingDot2 = useRef(new Animated.Value(0)).current;
  const thinkingDot3 = useRef(new Animated.Value(0)).current;

  // Voice Recording State
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Generate unique session ID for this chat instance
    setSessionId(`chat_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  }, []);

  // Gesture for Attach Menu
  const attachPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          attachAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80) {
          closeOverlays();
        } else {
          Animated.spring(attachAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        }
      }
    })
  ).current;

  // Gesture for Sidebar
  const sidebarPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          sidebarAnim.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 80) {
          closeOverlays();
        } else {
          Animated.timing(sidebarAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
        }
      }
    })
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(sidebarAnim, {
        toValue: isSidebarOpen ? 0 : SIDEBAR_WIDTH,
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

  useEffect(() => {
    // Looping animation for thinking dots (snappy and fast)
    const animateDots = () => {
      Animated.sequence([
        Animated.stagger(100, [
          Animated.sequence([Animated.timing(thinkingDot1, { toValue: -6, duration: 100, useNativeDriver: true }), Animated.timing(thinkingDot1, { toValue: 0, duration: 100, useNativeDriver: true })]),
          Animated.sequence([Animated.timing(thinkingDot2, { toValue: -6, duration: 100, useNativeDriver: true }), Animated.timing(thinkingDot2, { toValue: 0, duration: 100, useNativeDriver: true })]),
          Animated.sequence([Animated.timing(thinkingDot3, { toValue: -6, duration: 100, useNativeDriver: true }), Animated.timing(thinkingDot3, { toValue: 0, duration: 100, useNativeDriver: true })]),
        ]),
        Animated.delay(100)
      ]).start(() => animateDots());
    };
    animateDots();
  }, []);

  useEffect(() => {
    fetchCredits();
  }, []);

  // Smooth scroll to bottom when messages change or typing state updates
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages.length, isAiTyping]);

  const fetchCredits = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.user) {
        setCredits(data.user.balance || 0);
        setSubscriptionType(data.user.subscription_type || null);
        setPaymentStatus(data.user.payment_status || null);
        setPaymentReference(data.user.payment_reference || null);
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Fadlan ogolow inaan isticmaalno gallery-gaaga.');
      return;
    }

    const remaining = 5 - attachments.length;
    if (remaining <= 0) {
      Alert.alert('Xad', 'Waxaad dooran kartaa ugu badan 5 sawir.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      const newAttachments: Attachment[] = result.assets.map(asset => ({
        uri: asset.uri,
        base64: asset.base64 || '',
        mimeType: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'image.jpg'
      }));
      setAttachments(prev => [...prev, ...newAttachments].slice(0, 5));
      setIsAttachOpen(false);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Fadlan ogolow inaan isticmaalno camera-gaaga.');
      return;
    }

    if (attachments.length >= 5) {
      Alert.alert('Xad', 'Waxaad dooran kartaa ugu badan 5 sawir.');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setAttachments(prev => [...prev, {
        uri: asset.uri,
        base64: asset.base64 || '',
        mimeType: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'photo.jpg'
      }].slice(0, 5));
      setIsAttachOpen(false);
    }
  };

  const pickDocument = async () => {
    let result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      try {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
        setAttachments([{
          uri: asset.uri,
          base64: base64,
          mimeType: asset.mimeType || 'application/octet-stream',
          name: asset.name
        }]);
        setIsAttachOpen(false);
      } catch (err) {
        alert('fyle masoo galin kartid waayo upgrade ma haysatid si uu kuugu shaqeeyo inaad fyle soo galisid iibso premium ');
      }
    }
  };

  // Hide Group Tooltip after 20 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTooltip(false);
    }, 20000);
    return () => clearTimeout(timer);
  }, []);

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
    // Show button if we scroll up more than 100px from the bottom
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
    setShowScrollBottom(!isCloseToBottom);
  };

  const startRecording = async () => {
    try {
      // Prevent overlapping initialization
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
        Alert.alert('Permission Denied', 'Fadlan oggolow makarafoonka si aad cod u duubto.');
      }
    } catch (err) {
      console.error('Failed to start recording', err);
      // Clean up on failure
      setRecording(null);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    // Save reference and clear state immediately to prevent overlaps
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
          // On Web, we need to fetch the blob URI to get the actual data
          const response = await fetch(uri);
          const blob = await response.blob();
          formData.append('audio', blob, 'voice_note.m4a');
        } else {
          // On Native (iOS/Android), we use the traditional {uri, name, type} object
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
          setInputText(data.text); // Fill input with transcribed text
        } else {
          Alert.alert('Cilad', 'Lama fahmin codkaaga.');
        }
      }
    } catch (error) {
      console.error('Failed to stop recording', error);
      Alert.alert('Cilad', 'Cilad ayaa dhacday soo dirista codka.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSend = async () => {
    if ((!inputText.trim() && attachments.length === 0) || isAiTyping) return;

    const userText = inputText.trim();
    const currentAttachments = [...attachments];
    const currentAttachment = currentAttachments.find(a => a.mimeType.startsWith('image/')) || currentAttachments[0] || null;

    setInputText('');
    setAttachments([]);
    setIsAiTyping(true);

    // Play Send Animation
    // ... (animation code)
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

    const imageUris = currentAttachments.filter(a => a.mimeType.startsWith('image/')).map(a => a.uri);
    const newUserMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      sender: 'user',
      image: imageUris[0],
      images: imageUris.length > 0 ? imageUris : undefined
    };
    const aiMsgId = (Date.now() + 1).toString();
    const newAiMsg: Message = { id: aiMsgId, text: '', sender: 'ai', status: 'thinking' };

    setMessages(prev => [...prev, newUserMsg, newAiMsg]);

    // Initial status (for attachment, always analyzing image)
    setThinkingStatus(currentAttachment && currentAttachment.mimeType.startsWith('image/') ? 'Analyzing image...' : 'Thinking...');
    const statusTimeout = setTimeout(() => {
      setThinkingStatus('Thinking...');
    }, 8000); // fallback in case no server status received

    if (userText === '112233') {
      clearTimeout(statusTimeout);
      setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: 'Waxaan ahay AI Darkpen Pro', status: 'complete' } : m));
        setIsAiTyping(false);
      }, 1000);
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${Config.API_URL}/api/chat/ask`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      let accumulatedText = "";
      let offset = 0;

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 2) {
          // Headers received
          if (xhr.status === 402) {
            clearTimeout(statusTimeout);
            xhr.abort();
            setMessages(prev => prev.filter(m => m.id !== aiMsgId));
            setIsAiTyping(false);
            router.push('/billing');
            return;
          }
        } else if (xhr.readyState === 3 || xhr.readyState === 4) {
          // Interactive (receiving chunks) or Complete
          const responseText = xhr.responseText;
          const chunk = responseText.substring(offset);
          offset = responseText.length;

          if (chunk) {
            const lines = chunk.split('\n');
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith('data: ')) {
                const dataStr = trimmedLine.slice(6).trim();
                if (dataStr === '[DONE]') {
                  break;
                }
                try {
                  const parsed = JSON.parse(dataStr);
                  // Handle server-sent status events
                  if (parsed.status === 'reading_books') {
                    clearTimeout(statusTimeout);
                    setThinkingStatus('Reading books...');
                  } else if (parsed.status === 'thinking') {
                    clearTimeout(statusTimeout);
                    setThinkingStatus('Thinking...');
                  } else if (parsed.error) {
                    accumulatedText = "Cilad: " + parsed.error;
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: accumulatedText, status: 'complete' } : m));
                    break;
                  } else if (parsed.text) {
                    accumulatedText += parsed.text;
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: accumulatedText, status: 'streaming' } : m));
                  }
                } catch (err) {
                  // Partial JSON chunk, wait for next buffer
                }
              }
            }
          }

          if (xhr.readyState === 4) {
            clearTimeout(statusTimeout);
            if (xhr.status >= 400 && !accumulatedText) {
              let errorMsg = "Cilad ayaa dhacday.";
              try {
                const data = JSON.parse(xhr.responseText);
                errorMsg = data.message || errorMsg;
              } catch (e) {}
              setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: 'Cilad: ' + errorMsg, status: 'complete' } : m));
            } else {
              setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: accumulatedText || "Waan ka xunnahay, jawaab ma jiro.", status: 'complete' } : m));
              fetchCredits();
            }
            setIsAiTyping(false);
          }
        }
      };

      xhr.onerror = () => {
        clearTimeout(statusTimeout);
        setMessages(prev => prev.map(m => m.id === aiMsgId ? {
          ...m,
          text: 'Fadlan hubi internet-kaaga.',
          status: 'complete'
        } : m));
        setIsAiTyping(false);
      };

      xhr.send(JSON.stringify({
        message: userText,
        chatType: 'education',
        stream: true,
        sessionId: sessionId,
        attachment: currentAttachments.length > 0 ? currentAttachments.map(att => ({
          base64: att.base64,
          mimeType: att.mimeType,
          name: att.name
        })) : null
      }));

    } catch (error) {
      setMessages(prev => prev.map(m => m.id === aiMsgId ? {
        ...m,
        text: 'Fadlan hubi internet-kaaga.',
        status: 'complete'
      } : m));
      clearTimeout(statusTimeout);
      setIsAiTyping(false);
    }
  };

  return (
    <AuthGuard>
      <View style={styles.container}>

        {/* HEADER */}
        <View style={StyleSheet.flatten([styles.header, { top: Math.max(insets.top, 10) }])}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.headerIconSolidBox} onPress={() => router.navigate('/(tabs)')} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.headerRight}>
            <View style={{ position: 'relative' }}>
              <TouchableOpacity onPress={() => router.navigate('/group')} activeOpacity={0.7}>
                <BlurView intensity={60} tint="light" style={styles.headerIconBlurBox}>
                  <Ionicons name="people-outline" size={20} color={colors.primary} />
                </BlurView>
              </TouchableOpacity>
              {/* Tooltip for Group Chat */}
              {showTooltip && (
                <View style={styles.groupTooltip}>
                  <Text style={styles.groupTooltipText}>Group Chat</Text>
                  <View style={styles.groupTooltipArrow} />
                </View>
              )}
            </View>

            <View style={{ width: 8 }} />

            <TouchableOpacity onPress={toggleSidebar} activeOpacity={0.7}>
              <BlurView intensity={60} tint="light" style={styles.headerIconBlurBox}>
                <Ionicons name="menu-outline" size={22} color={colors.primary} />
              </BlurView>
            </TouchableOpacity>
          </View>
        </View>

        {/* CHAT AREA */}
        <KeyboardAvoidingView
          style={styles.chatArea}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 60}
        >
          {/* Pending Payment Notice Banner */}
          {paymentStatus === 'pending' && (
            <View style={{
              backgroundColor: isDark ? '#1F2937' : '#FEF3C7',
              borderBottomWidth: 1,
              borderColor: isDark ? '#374151' : '#FCD34D',
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12
            }}>
              <Ionicons name="time" size={24} color="#D97706" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.text }}>
                  Dalabkaaga wuu qabsoomay (Pending)
                </Text>
                <Text style={{ fontSize: 11, color: isDark ? '#D1D5DB' : '#4B5563', marginTop: 2 }}>
                  Fadlan sug, lacagtii aad ka dirtay {paymentReference} waa la hubinayaa hadda si credit loogu shubo koontadaada.
                </Text>
              </View>
            </View>
          )}

          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((msg, index) => {
              const isUser = msg.sender === 'user';

              return (
                <View key={msg.id} style={StyleSheet.flatten([
                  styles.messageRow,
                  isUser ? styles.messageRowUser : styles.messageRowAi
                ])}>
                  {!isUser && <AppLogo size={30} style={styles.aiAvatar} />}
                  <View style={StyleSheet.flatten([
                    styles.messageContent,
                    isUser ? styles.messageContentUser : styles.messageContentAi
                  ])}>
                    {msg.images && msg.images.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ marginBottom: 6 }}
                        contentContainerStyle={{ gap: 8 }}
                      >
                        {msg.images.map((imgUri, imgIdx) => (
                          <TouchableOpacity
                            key={imgIdx}
                            activeOpacity={0.8}
                            onPress={() => setViewerImage(imgUri)}
                            style={[
                              styles.chatImageContainer,
                              { marginBottom: 0, width: msg.images!.length === 1 ? width * 0.7 : 140, height: msg.images!.length === 1 ? 200 : 140 }
                            ]}
                          >
                            <Image
                              source={{ uri: imgUri }}
                              style={{ width: '100%', height: '100%' }}
                              contentFit="cover"
                            />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    ) : msg.image ? (
                      <TouchableOpacity activeOpacity={0.8} onPress={() => setViewerImage(msg.image || null)} style={styles.chatImageContainer}>
                        <Image
                          source={{ uri: msg.image }}
                          style={styles.chatImage}
                          contentFit="cover"
                        />
                      </TouchableOpacity>
                    ) : null}

                    {isUser ? (
                      msg.text ? (
                        <View style={styles.messageBubbleUser}>
                          <Text style={styles.messageTextUser}>{msg.text}</Text>
                        </View>
                      ) : null
                    ) : (
                      <View style={styles.aiContentContainer}>
                        <View style={styles.messageBubbleAi}>
                          {msg.status === 'thinking' ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <View style={styles.thinkingContainer}>
                                <Animated.View style={StyleSheet.flatten([styles.thinkingDot, { transform: [{ translateY: thinkingDot1 }] }])} />
                                <Animated.View style={StyleSheet.flatten([styles.thinkingDot, { transform: [{ translateY: thinkingDot2 }] }])} />
                                <Animated.View style={StyleSheet.flatten([styles.thinkingDot, { transform: [{ translateY: thinkingDot3 }] }])} />
                              </View>
                              {thinkingStatus ? <Text style={styles.thinkingText}>{thinkingStatus}</Text> : null}
                            </View>
                          ) : (
                            <View style={styles.aiTextContainer}>
                              <View style={{ flex: 1 }}>
                                {renderFormattedText(msg.text, isDark, colors)}
                              </View>
                              {msg.status === 'streaming' && <View style={styles.typingCursor} />}
                            </View>
                          )}
                        </View>

                        {msg.status === 'complete' && (
                          <TouchableOpacity 
                            style={styles.smallCopyBtn} 
                            onPress={() => {
                              Clipboard.setStringAsync(msg.text);
                              Alert.alert('Copied', t('copied_alert'));
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="copy-outline" size={12} color="#3B82F6" />
                            <Text style={styles.smallCopyText}>Copy</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
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
          {attachments.length > 0 && (
            <View style={styles.attachmentPreviewRow}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, gap: 8, alignItems: 'center' }}
                style={{ flex: 1 }}
              >
                {attachments.map((att, idx) => (
                  <View key={idx} style={styles.attachmentThumbWrap}>
                    {att.mimeType.startsWith('image/') ? (
                      <Image source={{ uri: att.uri }} style={styles.attachmentThumb} contentFit="cover" />
                    ) : (
                      <View style={[styles.attachmentThumb, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }]}>
                        <Ionicons name="document-attach" size={24} color={colors.primary} />
                        <Text style={styles.previewFileName} numberOfLines={1}>{att.name}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.removeAttachThumb}
                      onPress={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <Ionicons name="close-circle" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Solid Input Area */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>

              {/* Plus Button - Circle */}
              <TouchableOpacity style={styles.circleBtn} onPress={toggleAttachMenu} activeOpacity={0.7}>
                <Ionicons name="add" size={22} color="#3B82F6" />
              </TouchableOpacity>

              <View style={styles.textInputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder={isTranscribing ? t('transcribing') : t('ask_placeholder')}
                  placeholderTextColor="#9CA3AF"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={500}
                  onFocus={() => {
                    setShowScrollBottom(false);
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }}
                />
              </View>

              {inputText.trim() || attachments.length > 0 ? (
                <TouchableOpacity
                  style={StyleSheet.flatten([
                    styles.circleBtn,
                    styles.sendCircle,
                    (!inputText.trim() && attachments.length === 0) || isAiTyping || isTranscribing ? styles.sendButtonDisabled : {}
                  ])}
                  onPress={handleSend}
                  disabled={(!inputText.trim() && attachments.length === 0) || isAiTyping || isTranscribing}
                  activeOpacity={0.8}
                >
                  <Animated.View style={{
                    transform: [
                      { translateX: sendTranslateX },
                      { translateY: sendTranslateY }
                    ],
                    opacity: sendOpacity
                  }}>
                    <Ionicons name="send" size={18} color="white" style={{ marginLeft: 2 }} />
                  </Animated.View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={StyleSheet.flatten([
                    styles.circleBtn,
                    isRecording ? styles.recordingCircle : {},
                    isTranscribing ? styles.sendButtonDisabled : {}
                  ])}
                  onPressIn={startRecording}
                  onPressOut={stopRecording}
                  disabled={isTranscribing || isAiTyping}
                  activeOpacity={0.8}
                >
                  <Ionicons name={isRecording ? "mic" : "mic-outline"} size={20} color={isRecording ? 'white' : '#3B82F6'} />
                </TouchableOpacity>
              )}

            </View>
          </View>
        </KeyboardAvoidingView>

        {/* GLOBAL OVERLAY */}
        <Animated.View style={StyleSheet.flatten([styles.globalOverlay, { opacity: overlayAnim }])} pointerEvents={isSidebarOpen ? 'auto' : 'none'}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeOverlays}>
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
          </Pressable>
        </Animated.View>

        {/* INVISIBLE OVERLAY FOR ATTACHMENT MENU */}
        {isAttachOpen && !isSidebarOpen && (
          <Pressable style={[StyleSheet.absoluteFillObject, { zIndex: 101 }]} onPress={closeOverlays} />
        )}

        {/* ATTACHMENT BOTTOM SHEET */}
        <Animated.View
          style={StyleSheet.flatten([styles.attachSheet, { transform: [{ translateY: attachAnim }] }])}
          pointerEvents={isAttachOpen ? 'auto' : 'none'}
          {...attachPanResponder.panHandlers}
        >
          <View style={styles.attachCard}>
            <View style={styles.attachHandle} />

            <View style={styles.attachGrid}>
              <TouchableOpacity style={styles.attachItem} onPress={takePhoto}>
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

              <TouchableOpacity style={styles.attachItem} onPress={pickDocument}>
                <View style={styles.attachIconBg}>
                  <Ionicons name="document-text-outline" size={32} color={colors.secondary} />
                </View>
                <Text style={styles.attachLabel}>Document</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* SIDEBAR PANEL */}
        <Animated.View
          style={StyleSheet.flatten([styles.sidebarPanel, { transform: [{ translateX: sidebarAnim }] }])}
          pointerEvents={isSidebarOpen ? 'auto' : 'none'}
          {...sidebarPanResponder.panHandlers}
        >
          <View style={{ flex: 1, paddingTop: Math.max(insets.top, 20) }}>
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>{t('chat_history')}</Text>
              <TouchableOpacity onPress={toggleSidebar} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                <Ionicons name="close" size={28} color={colors.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.creditsSection}>
              <View style={styles.creditsCard}>
                <View style={styles.creditsIconBg}>
                  <Ionicons name="flash" size={20} color={colors.primary} />
                </View>
                <View style={styles.creditsInfo}>
                  <Text style={styles.creditsLabel}>{subscriptionType ? t('your_plan') : t('your_credits')}</Text>
                  <Text style={styles.creditsValue}>
                    {subscriptionType === 'monthly_11' ? t('premium_unlimited') :
                      subscriptionType === 'monthly_3' ? t('basic_unlimited') :
                        credits !== null ? `${credits} ${t('credits')}` : t('loading')}
                  </Text>
                </View>
              </View>
              {!subscriptionType && (
                <TouchableOpacity
                  style={styles.topupBtn}
                  onPress={() => {
                    closeOverlays();
                    router.push('/billing');
                  }}
                >
                  <Text style={styles.topupBtnText}>{t('add_credits')}</Text>
                  <Ionicons name="chevron-forward" size={16} color="white" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.sidebarContent}>
              {/* Other sidebar content can go here if needed later */}
            </ScrollView>

            <View style={styles.sidebarFooter}>
              <TouchableOpacity style={styles.footerItem} onPress={() => router.push('/profile')}>
                <Ionicons name="person-outline" size={20} color={colors.primary} />
                 <Text style={StyleSheet.flatten([styles.footerItemText, { color: colors.primary }])}>{t('profile_settings')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        <Modal visible={!!viewerImage} transparent={true} animationType="fade" onRequestClose={() => setViewerImage(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }} onPress={() => setViewerImage(null)}>
              <Ionicons name="close" size={32} color="#ffffff" />
            </TouchableOpacity>
            {viewerImage && (
              <Image source={{ uri: viewerImage }} style={{ width: '100%', height: '80%' }} contentFit="contain" />
            )}
          </View>
        </Modal>
      </View>
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
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconSolidBox: {
    width: 40,
    height: 40,
    borderRadius: 20 ,
    borderWidth: 1,
    borderColor: colors.border || '#333',
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconBlurBox: {
    width: 40,
    height: 40,
    borderRadius: 20 ,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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
    paddingRight: 4,
  },
  groupTooltip: {
    position: 'absolute',
    top: 50,
    left: -20,
    backgroundColor: colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 20,
    minWidth: 80,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupTooltipText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  groupTooltipArrow: {
    position: 'absolute',
    top: -4,
    left: '50%',
    marginLeft: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.secondary,
  },

  // Chat Area
  chatArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 100,
    paddingBottom: 40,
    flexGrow: 1,
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
    paddingHorizontal: 0,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAi: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  messageContent: {
    maxWidth: '85%',
    gap: 6,
  },
  messageContentUser: {
    alignItems: 'flex-end',
  },
  messageContentAi: {
    alignItems: 'flex-start',
  },
  aiContentContainer: {
    maxWidth: '100%',
  },
  aiAvatar: {
    marginRight: 8,
    marginTop: 4,
  },
  aiTextContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  messageTextAi: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
  },
  typingCursor: {
    width: 6,
    height: 20,
    backgroundColor: colors.primary,
    marginLeft: 4,
    marginTop: 4,
    borderRadius: 3,
  },
  messageBubbleUser: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  messageBubbleAi: {
    paddingVertical: 8,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  smallCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F3F4F6',
  },
  smallCopyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 4,
  },
  chatImageContainer: {
    borderRadius: 20,
    overflow: 'hidden' ,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB',
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 6,
  },
  chatImage: {
    width: width * 0.7,
    height: 200,
  },
  messageTextUser: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 15,
    lineHeight: 22,
  },



  // Thinking State
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  thinkingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 4,
  },
  thinkingText: {
    marginLeft: 8,
    fontSize: 14,
    color: colors.textLight,
    fontStyle: 'italic',
  },

  // Action Buttons
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
    paddingHorizontal: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F9FAFB',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#E5E7EB',
  },
  actionBtnText: {
    fontSize: 13,
    color: colors.textLight,
    marginLeft: 6,
    fontWeight: '600',
  },

  // Solid Input Area
  inputContainer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border || '#222',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    minHeight: 60,
    gap: 8,
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  sendCircle: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  recordingCircle: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
    transform: [{ scale: 1.1 }],
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border || '#333',
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 4,
    minHeight: 48,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: colors.text,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 2,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border || '#333',
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
    opacity: 0.5,
  },
  recordingButton: {
    backgroundColor: '#EF4444',
    transform: [{ scale: 1.1 }]
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
    right: 0,
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
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  historyItemTexts: {
    marginLeft: 16,
    flex: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.secondary,
  },
  historyDate: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 4,
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
    marginLeft: 12,
  },

  // Credits Section Styles
  creditsSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
    backgroundColor: colors.background,
  },
  creditsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 16 ,
    borderWidth: 1,
    borderColor: colors.border || '#333',
    marginBottom: 12,
  },
  creditsIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  creditsInfo: {
    flex: 1,
  },
  creditsLabel: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '600',
  },
  creditsValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.secondary,
  },
  topupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  topupBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  sidebarSectionTitle: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitleText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pointsCard: {
    backgroundColor: '#FFFBEB',
    padding: 20,
    borderRadius: 20 ,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginHorizontal: 16,
    marginTop: 16,
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

  // Attachment Preview
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  attachmentPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border || '#E5E7EB',
    minHeight: 80,
  },
  attachmentThumbWrap: {
    position: 'relative',
    marginRight: 4,
  },
  attachmentThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border || '#E5E7EB',
  },
  removeAttachThumb: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 10,
    backgroundColor: colors.card,
    borderRadius: 10,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  previewFileIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border || '#333',
    maxWidth: '80%',
  },
  previewFileName: {
    marginLeft: 8,
    fontSize: 13,
    color: colors.secondary,
    fontWeight: '600',
  },
  removeAttachment: {
    marginLeft: 12,
  },
  emptyHistory: {
    textAlign: 'center',
    color: colors.neutral,
    marginTop: 20,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    padding: 24,
    borderRadius: 24,
    overflow: 'hidden' ,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: 'white',
    fontSize: 16,
    marginBottom: 24,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  modalSave: {
    flex: 2,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  settingsSheet: {
    backgroundColor: colors.card,
    width: '100%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    position: 'absolute',
    bottom: 0,
  },
  settingsTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.secondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.secondary,
  },
  settingHint: {
    fontSize: 12,
    color: colors.neutral,
    marginTop: 4,
    paddingRight: 20,
  },
  toggleBg: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 4,
  },
  toggleOn: {
    backgroundColor: colors.primary,
  },
  toggleOff: {
    backgroundColor: '#E5E7EB',
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.card,
  },
  toggleCircleOn: {
    alignSelf: 'flex-end',
  },
  toggleCircleOff: {
    alignSelf: 'flex-start',
  },
  settingsClose: {
    marginTop: 24,
    padding: 18,
    backgroundColor: colors.background,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  settingsCloseText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.secondary,
  }
});
