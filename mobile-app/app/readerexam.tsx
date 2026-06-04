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

// Helper function to generate PDF.js viewer HTML with inline engine code to run 100% offline
const getHtmlContent = (pdfFilename: string, isDark: boolean) => {
  const bgColor = isDark ? '#0F172A' : '#F1F5F9';
  const paperColor = isDark ? '#1E293B' : '#FFFFFF';
  const textColor = isDark ? '#F1F5F9' : '#1E293B';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
      <style>
        * {
          box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
        }
        body {
          margin: 0;
          padding: 0;
          background-color: ${bgColor};
          color: ${textColor};
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-height: 100vh;
        }
        #viewer {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 16px 8px;
        }
        .page-container {
          position: relative;
          box-shadow: 0 4px 12px rgba(0, 0, 0, ${isDark ? '0.4' : '0.1'});
          background-color: ${paperColor};
          max-width: 100%;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
          border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'};
        }
        canvas {
          display: block;
          width: 100% !important;
          height: auto !important;
        }
        .page-number {
          position: absolute;
          bottom: 12px;
          right: 12px;
          background: rgba(15, 23, 42, 0.75);
          color: #ffffff;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 700;
          border-radius: 20px;
          pointer-events: none;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }
      </style>
      <script src="./pdf.min.js"></script>
    </head>
    <body>
      <div id="viewer"></div>

      <script>
        try {
          // Disable worker to run inline (prevents loading hangs/CORS/Blob errors)
          if (window.pdfjsLib) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '';
          }

          const loadingTask = pdfjsLib.getDocument('./${pdfFilename}');
          
          loadingTask.promise.then(function(pdf) {
            const viewer = document.getElementById('viewer');
            const numPages = pdf.numPages;

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'LOADED',
              totalPages: numPages
            }));

            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
              renderPage(pdf, pageNum, viewer);
            }
          }).catch(function(error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ERROR',
              message: error.message
            }));
          });
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'ERROR',
            message: e.message
          }));
        }

        function renderPage(pdf, pageNum, container) {
          pdf.getPage(pageNum).then(function(page) {
            const scale = 1.5;
            const viewport = page.getViewport({ scale: scale });

            const pageContainer = document.createElement('div');
            pageContainer.className = 'page-container';
            pageContainer.id = 'page-' + pageNum;
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            pageContainer.appendChild(canvas);
            
            const badge = document.createElement('div');
            badge.className = 'page-number';
            badge.innerText = pageNum + ' / ' + pdf.numPages;
            pageContainer.appendChild(badge);

            container.appendChild(pageContainer);

            const renderContext = {
              canvasContext: context,
              viewport: viewport
            };
            
            page.render(renderContext);
          });
        }
      </script>
    </body>
    </html>
  `;
};


export default function ReaderExamScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const { pdfUrl, title, localPath: passedLocalPath, type } = useLocalSearchParams();
  const router = useRouter();

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isCached, setIsCached] = useState(false);
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [isSavedOffline, setIsSavedOffline] = useState(false);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [webViewLoaded, setWebViewLoaded] = useState(false);

  let formattedPdfUrl = pdfUrl as string;
  if (formattedPdfUrl && !formattedPdfUrl.startsWith('http://') && !formattedPdfUrl.startsWith('https://') && !formattedPdfUrl.startsWith('file://')) {
    const cleanPath = formattedPdfUrl.startsWith('/') ? formattedPdfUrl : '/' + formattedPdfUrl;
    formattedPdfUrl = `${Config.API_URL}${cleanPath}`;
  }

  // Ensure PDF.js engine is cached locally
  const ensurePdfJsEngine = async () => {
    try {
      const pdfJsPath = `${FileSystem.documentDirectory}pdf.min.js`;
      const jsInfo = await FileSystem.getInfoAsync(pdfJsPath);

      if (!jsInfo.exists) {
        console.log("Downloading pdf.min.js to local cache...");
        await FileSystem.downloadAsync(
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
          pdfJsPath
        );
      }

      return { pdfJsPath };
    } catch (err) {
      console.error("Error ensuring PDF.js engine:", err);
      throw err;
    }
  };

  useEffect(() => {
    if (!formattedPdfUrl) return;

    // Check if it's already registered as downloaded
    isDocDownloaded(formattedPdfUrl).then(setIsSavedOffline);

    if (formattedPdfUrl.startsWith('file://') || passedLocalPath) {
      const activeLocalPath = formattedPdfUrl.startsWith('file://') ? formattedPdfUrl : (passedLocalPath as string);
      setLocalPath(activeLocalPath);
      setIsCached(true);
      setIsSavedOffline(true);
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
          // Download with progress callback
          setDownloading(true);
          setDownloadProgress(0);

          const downloadResumable = FileSystem.createDownloadResumable(
            urlStr,
            targetPath,
            {},
            (downloadProgress) => {
              const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
              setDownloadProgress(progress || 0);
            }
          );

          const result = await downloadResumable.downloadAsync();
          if (result && result.status === 200) {
            setIsCached(true);
            // Save automatically as offline document
            let finalType: 'book' | 'exam' = 'book';
            if (type) {
              finalType = type as 'book' | 'exam';
            } else {
              const isExam = formattedPdfUrl.toLowerCase().includes('exam') || (title && (title as string).toLowerCase().includes('imtixaan'));
              finalType = isExam ? 'exam' : 'book';
            }
            await registerDownload({
              pdfUrl: formattedPdfUrl,
              title: (title as string) || 'Document',
              type: finalType,
              localPath: targetPath,
              grade: 'Form 4',
            });
            setIsSavedOffline(true);
          } else {
            throw new Error("Failed to download PDF document from server.");
          }
        }
      } catch (err: any) {
        console.error('Error checking/downloading PDF:', err);
        setErrorMessage(err.message || "Faylka waa la soo dejin waayey.");
      } finally {
        setDownloading(false);
      }
    };

    checkAndDownload();
  }, [formattedPdfUrl, passedLocalPath]);

  // Load local file into PDF.js Webview viewer
  useEffect(() => {
    if (!isCached || !localPath) return;

    const loadLocalPdf = async () => {
      try {
        // Ensure engine is ready
        await ensurePdfJsEngine();

        // Get filename from localPath
        const filename = localPath.split('/').pop() || 'document.pdf';

        // Generate static html content and write it to viewer.html
        const generatedHtml = getHtmlContent(filename, isDark);
        const viewerHtmlPath = `${FileSystem.documentDirectory}viewer.html`;
        await FileSystem.writeAsStringAsync(viewerHtmlPath, generatedHtml);

        // Set the HTML URI to state
        setHtmlUri(viewerHtmlPath);
      } catch (err: any) {
        console.error("Error loading PDF into Webview:", err);
        setErrorMessage(err.message || "Faylka waa la furi waayey.");
      }
    };

    loadLocalPdf();
  }, [isCached, localPath, isDark]);

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
      let finalType: 'book' | 'exam' = 'book';
      if (type) {
        finalType = type as 'book' | 'exam';
      } else {
        const isExam = formattedPdfUrl.toLowerCase().includes('exam') || (title && (title as string).toLowerCase().includes('imtixaan'));
        finalType = isExam ? 'exam' : 'book';
      }

      await registerDownload({
        pdfUrl: formattedPdfUrl,
        title: (title as string) || 'Document',
        type: finalType,
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

  if (downloading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <View style={styles.downloadCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.downloadTitle}>{title || 'Document'}</Text>
          <Text style={styles.downloadSubtitle}>
            Faylka waa la soo dejinayaa, fadlan sug...
          </Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
          </View>
          <Text style={styles.downloadPercent}>
            {Math.round(downloadProgress * 100)}%
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={[styles.downloadTitle, { color: '#EF4444', marginTop: 16 }]}>Cilad Farsamo</Text>
        <Text style={[styles.downloadSubtitle, { textAlign: 'center', marginTop: 8 }]}>
          {errorMessage}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryBtnText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title || 'Document Reader'}</Text>
        
        {/* Toggle offline registry button */}
        {!isSavedOffline && !formattedPdfUrl.startsWith('file://') && !passedLocalPath && (
          <TouchableOpacity onPress={handleToggleSaveOffline} style={styles.offlineBtn} activeOpacity={0.7}>
            <Ionicons 
              name="cloud-download-outline" 
              size={24} 
              color={colors.secondary} 
            />
          </TouchableOpacity>
        )}

        {isCached ? (
          <TouchableOpacity onPress={handleOpenOffline} style={styles.offlineBtn} activeOpacity={0.7}>
            <Ionicons name="flash" size={22} color="#10B981" />
          </TouchableOpacity>
        ) : (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
        )}
      </View>

      <View style={styles.content}>
        {htmlUri ? (
          <View style={{ flex: 1 }}>
            <WebView 
              source={{ uri: htmlUri! }}
              style={[styles.webview, { opacity: webViewLoaded ? 1 : 0 }]}
              startInLoadingState={false}
              javaScriptEnabled={true}
              originWhitelist={['*']}
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
              allowingReadAccessToURL={FileSystem.documentDirectory || undefined}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'LOADED') {
                    setWebViewLoaded(true);
                  } else if (data.type === 'ERROR') {
                    console.error("WebView error:", data.message);
                    setErrorMessage(data.message);
                  }
                } catch (e) {}
              }}
            />
            {!webViewLoaded && (
              <View style={styles.loadingAbsolute}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 12, color: colors.text, fontWeight: '600' }}>Boggaga waa la diyaarinayaa...</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.loadingAbsolute}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 12, color: colors.text, fontWeight: '600' }}>Boggaga waa la diyaarinayaa...</Text>
          </View>
        )}
      </View>

      {/* Floating AI Extension Preparation Button (WOW layout for future integration) */}
      <TouchableOpacity 
        style={styles.floatingAiBtn} 
        activeOpacity={0.8}
        onPress={() => Alert.alert("Darkpen AI Extension", "Muuqaalkan (AI Extension) dhawaan ayaa la hawlgalin doonaa si aad wax uga weydiiso casharada buugga! ⚡")}
      >
        <Ionicons name="sparkles" size={20} color="white" />
        <Text style={styles.floatingAiBtnText}>Ask AI</Text>
      </TouchableOpacity>
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
  content: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  loadingAbsolute: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    zIndex: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  // Custom downloader style components
  downloadCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border || 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
  downloadTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.secondary,
    marginTop: 20,
    textAlign: 'center',
  },
  downloadSubtitle: {
    fontSize: 14,
    color: colors.textLight || '#6B7280',
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: isDark ? '#374151' : '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  downloadPercent: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  // Floating AI Button
  floatingAiBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 30,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
  },
  floatingAiBtnText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 15,
    marginLeft: 8,
  },
  retryBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  retryBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  }
});
