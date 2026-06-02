import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import Config from '../constants/Config';
import { isDocDownloaded, registerDownload, removeDownload } from '../utils/downloadManager';

export default function ReaderExamScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const { pdfUrl, title } = useLocalSearchParams();
  const router = useRouter();

  const [downloading, setDownloading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [isSavedOffline, setIsSavedOffline] = useState(false);
  const [useNativeViewer, setUseNativeViewer] = useState(false);

  // JavaScript to hide the pop-out button on Google Docs Viewer
  const injectedJS = `
    const style = document.createElement('style');
    style.innerHTML = '.ndfHFb-c4YZDc-GSQQnc-LgbsSe, .ndfHFb-c4YZDc-i5755e, div[aria-label="Pop-out"], a[aria-label="Pop-out"], div[role="button"][title*="popout"] { display: none !important; }';
    document.head.appendChild(style);
    
    setInterval(() => {
      const popoutBtn = document.querySelector('.ndfHFb-c4YZDc-GSQQnc-LgbsSe') || 
                        document.querySelector('div[aria-label="Pop-out"]') || 
                        document.querySelector('a[aria-label="Pop-out"]');
      if (popoutBtn) {
        popoutBtn.style.display = 'none';
      }
    }, 300);
    true;
  `;

  let formattedPdfUrl = pdfUrl as string;
  if (formattedPdfUrl && !formattedPdfUrl.startsWith('http://') && !formattedPdfUrl.startsWith('https://') && !formattedPdfUrl.startsWith('file://')) {
    const cleanPath = formattedPdfUrl.startsWith('/') ? formattedPdfUrl : '/' + formattedPdfUrl;
    formattedPdfUrl = `${Config.API_URL}${cleanPath}`;
  }

  useEffect(() => {
    if (!formattedPdfUrl) return;

    // Check if it's already registered as downloaded
    isDocDownloaded(formattedPdfUrl).then(setIsSavedOffline);

    if (formattedPdfUrl.startsWith('file://')) {
      setLocalPath(formattedPdfUrl);
      setIsCached(true);
      if (Platform.OS === 'android') {
        setUseNativeViewer(true);
      }
      return;
    }

    const checkAndDownload = async () => {
      try {
        const urlStr = formattedPdfUrl;
        const filename = urlStr.split('/').pop() || 'document.pdf';
        const targetPath = `${FileSystem.documentDirectory}${filename}`;
        setLocalPath(targetPath);

        const fileInfo = await FileSystem.getInfoAsync(targetPath);
        if (fileInfo.exists) {
          setIsCached(true);
        } else {
          // Download in background
          setDownloading(true);
          const downloadRes = await FileSystem.downloadAsync(urlStr, targetPath);
          if (downloadRes.status === 200) {
            setIsCached(true);
          }
        }
      } catch (err) {
        console.error('Error checking/downloading PDF:', err);
      } finally {
        setDownloading(false);
      }
    };

    checkAndDownload();
  }, [formattedPdfUrl]);

  const handleOpenOffline = async () => {
    if (!localPath) return;
    if (Platform.OS === 'android') {
      try {
        const contentUri = await FileSystem.getContentUriAsync(localPath);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/pdf',
        });
      } catch (error) {
        // Fallback to Sharing if default viewer fails
        await Sharing.shareAsync(localPath);
      }
    } else if (Platform.OS === 'ios') {
      await Sharing.shareAsync(localPath);
    }
  };

  const handleToggleSaveOffline = async () => {
    if (!localPath) {
      Alert.alert('Faylka lama rari karo', 'Faylku wali si buuxda uma soo degin.');
      return;
    }

    if (isSavedOffline) {
      await removeDownload(formattedPdfUrl);
      setIsSavedOffline(false);
      Alert.alert('Waa la tirtiray', 'Buuggan/Imtixaankan waa laga saaray liiska downloads-kaaga.');
    } else {
      const isExam = formattedPdfUrl.toLowerCase().includes('exam') || (title && (title as string).toLowerCase().includes('imtixaan'));
      await registerDownload({
        pdfUrl: formattedPdfUrl,
        title: (title as string) || 'Document',
        type: isExam ? 'exam' : 'book',
        localPath: localPath,
        grade: 'Form 4',
      });
      setIsSavedOffline(true);
      Alert.alert('Downloads-ka waa lagu daray', 'Waa la soo dejiyey! Waxaad ka heli kartaa page-ka cusub ee Downloaded, adigoo offline ahna waad akhrisan kartaa. ⚡');
    }
  };

  if (!formattedPdfUrl) {
    return (
      <View style={styles.errorContainer}>
        <Text style={{ color: colors.text }}>PDF lama helin</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, marginTop: 10 }}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Define what source to load in the WebView
  let webViewSourceUri = formattedPdfUrl;
  if (Platform.OS === 'android') {
    webViewSourceUri = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(formattedPdfUrl)}`;
  } else if (Platform.OS === 'ios' && isCached && localPath) {
    webViewSourceUri = localPath; // Loads local file instantly on iOS!
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title || 'Exam Reader'}</Text>
        
        {/* Toggle offline registry button */}
        <TouchableOpacity onPress={handleToggleSaveOffline} style={styles.offlineBtn} activeOpacity={0.7}>
          <Ionicons 
            name={isSavedOffline ? "cloud-done" : "cloud-download-outline"} 
            size={24} 
            color={isSavedOffline ? "#10B981" : colors.secondary} 
          />
        </TouchableOpacity>

        {isCached ? (
          <TouchableOpacity onPress={handleOpenOffline} style={styles.offlineBtn} activeOpacity={0.7}>
            <Ionicons name="flash" size={22} color="#10B981" />
          </TouchableOpacity>
        ) : (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
        )}
      </View>

      {isCached && !useNativeViewer && (
        <TouchableOpacity 
          style={styles.instantBanner} 
          onPress={handleOpenOffline}
          activeOpacity={0.9}
        >
          <Ionicons name="flash" size={16} color="white" style={{ marginRight: 6 }} />
          <Text style={styles.instantBannerText}>
            ⚡ Si degdeg ah ugu akhriso NATIVE (Speed)
          </Text>
          <Ionicons name="chevron-forward" size={16} color="white" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      )}

      {useNativeViewer ? (
        <View style={styles.nativeViewerContainer}>
          <Ionicons name="document-text" size={80} color="#10B981" />
          <Text style={styles.nativeViewerTitle}>{title || 'Document'}</Text>
          <Text style={styles.nativeViewerDesc}>
            Faylkan wuu soo degay waxaanu ku jiraa appkaaga. Waxaad diyaar u tahay inaad offline u akhrisato adigoo isticmaalaya PDF readerka qalabkaaga.
          </Text>
          <TouchableOpacity style={styles.nativeViewerBtn} onPress={handleOpenOffline} activeOpacity={0.8}>
            <Ionicons name="flash" size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.nativeViewerBtnText}>Furo & Akhri (Offline)</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          {Platform.OS === 'web' ? (
            <iframe 
              src={`${formattedPdfUrl}#toolbar=0`} 
              style={{ width: '100%', height: '100%', border: 'none' }} 
              title={title as string}
            />
          ) : (
            <WebView 
              source={{ uri: webViewSourceUri }}
              style={styles.webview}
              startInLoadingState={true}
              javaScriptEnabled={true}
              injectedJavaScript={injectedJS}
              originWhitelist={['*']}
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
              renderLoading={() => (
                <View style={styles.loading}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ marginTop: 10, color: colors.text }}>Faylka waa la raryaa...</Text>
                  {downloading && (
                    <Text style={{ fontSize: 12, color: colors.neutral, marginTop: 4 }}>
                      Offline ahaan ayaa loo kaydinayaa si degdeg ah...
                    </Text>
                  )}
                </View>
              )}
              renderError={() => (
                <View style={styles.errorContainer}>
                  <Ionicons name="wifi-outline" size={48} color={colors.primary} />
                  <Text style={{ marginTop: 12, color: colors.text, fontSize: 16, fontWeight: '700' }}>
                    No Internet Connection
                  </Text>
                  <Text style={{ marginTop: 6, color: colors.secondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 }}>
                    Fadlan ku xidh internet-ka ama guji badhanka buugga ee sare si aad offline u akhrisato.
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
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
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#1E293B' : '#F1F5F9',
  },
  backBtn: {
    padding: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.secondary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  offlineBtn: {
    padding: 8,
    marginRight: 4,
  },
  instantBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  instantBannerText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  // Native offline viewer styles
  nativeViewerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  nativeViewerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.secondary,
    marginTop: 16,
    textAlign: 'center',
  },
  nativeViewerDesc: {
    fontSize: 14,
    color: isDark ? '#9CA3AF' : '#4B5563',
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  nativeViewerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nativeViewerBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  }
});
