import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import Config from '../constants/Config';

export default function ReaderExamScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const { pdfUrl, title } = useLocalSearchParams();
  const router = useRouter();

  const [downloading, setDownloading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [localPath, setLocalPath] = useState<string | null>(null);

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
  if (formattedPdfUrl && !formattedPdfUrl.startsWith('http://') && !formattedPdfUrl.startsWith('https://')) {
    const cleanPath = formattedPdfUrl.startsWith('/') ? formattedPdfUrl : '/' + formattedPdfUrl;
    formattedPdfUrl = `${Config.API_URL}${cleanPath}`;
  }

  useEffect(() => {
    if (!formattedPdfUrl) return;

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
        
        {isCached ? (
          <TouchableOpacity onPress={handleOpenOffline} style={styles.offlineBtn} activeOpacity={0.7}>
            <Ionicons name="flash" size={22} color="#10B981" />
          </TouchableOpacity>
        ) : (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
        )}
      </View>

      {isCached && (
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
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    flex: 1,
    textAlign: 'center',
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
  }
});
