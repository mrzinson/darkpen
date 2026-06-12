import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Platform, Alert, TextInput, Image, Animated, ScrollView, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
        .drawing-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 5;
          background: transparent;
          pointer-events: none;
        }
        .drawing-canvas.active {
          pointer-events: auto;
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
          z-index: 10;
        }
      </style>
      <script src="./pdf.min.js"></script>
    </head>
    <body>
      <div id="viewer"></div>

      <script>
        window.penModeActive = false;

        try {
          if (window.pdfjsLib) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';
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

            // Create transparent drawing canvas
            const drawCanvas = document.createElement('canvas');
            drawCanvas.className = 'drawing-canvas' + (window.penModeActive ? ' active' : '');
            drawCanvas.width = viewport.width;
            drawCanvas.height = viewport.height;
            pageContainer.appendChild(drawCanvas);
            
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

            // Extract page text content and send to React Native
            page.getTextContent().then(function(textContent) {
              const textItems = textContent.items.map(function(item) { return item.str; }).join(' ');
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PAGE_TEXT',
                pageNum: pageNum,
                text: textItems
              }));
            }).catch(function(e) {});

            // Paint Drawing Logic
            const dCtx = drawCanvas.getContext('2d');
            let drawing = false;
            dCtx.strokeStyle = '#3B82F6';
            dCtx.lineWidth = 5;
            dCtx.lineCap = 'round';
            dCtx.lineJoin = 'round';

            function getMousePos(canvasDom, e) {
              const rect = canvasDom.getBoundingClientRect();
              const touch = e.touches && e.touches[0] ? e.touches[0] : e;
              const x = (touch.clientX - rect.left) * (canvasDom.width / rect.width);
              const y = (touch.clientY - rect.top) * (canvasDom.height / rect.height);
              return { x, y };
            }

            function startDraw(e) {
              e.preventDefault(); // Prevent page scroll when drawing starts
              drawing = true;
              const pos = getMousePos(drawCanvas, e);
              dCtx.beginPath();
              dCtx.moveTo(pos.x, pos.y);
            }

            function draw(e) {
              if (!drawing) return;
              e.preventDefault(); // Prevent page scroll during drawing
              const pos = getMousePos(drawCanvas, e);
              dCtx.lineTo(pos.x, pos.y);
              dCtx.stroke();
            }

            function endDraw(e) {
              if (!drawing) return;
              e.preventDefault();
              drawing = false;
              dCtx.closePath();
              captureSnippet(canvas, drawCanvas);
            }

            drawCanvas.addEventListener('touchstart', startDraw, { passive: false });
            drawCanvas.addEventListener('touchmove', draw, { passive: false });
            drawCanvas.addEventListener('touchend', endDraw, { passive: false });

            drawCanvas.addEventListener('mousedown', startDraw);
            drawCanvas.addEventListener('mousemove', draw);
            drawCanvas.addEventListener('mouseup', endDraw);
          });
        }

        function captureSnippet(pageCanvas, drawCanvas) {
          const offscreen = document.createElement('canvas');
          offscreen.width = pageCanvas.width;
          offscreen.height = pageCanvas.height;
          const oCtx = offscreen.getContext('2d');
          oCtx.drawImage(pageCanvas, 0, 0);
          oCtx.drawImage(drawCanvas, 0, 0);
          
          const base64Data = offscreen.toDataURL('image/jpeg', 0.85);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DRAWING_DATA',
            base64: base64Data
          }));
        }

        // Selection listener
        document.addEventListener('selectionchange', () => {
          const selection = window.getSelection();
          const text = selection.toString().trim();
          if (text.length > 0) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SELECTION',
              text: text
            }));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SELECTION_CLEAR'
            }));
          }
        });

        // Command listener
        window.addEventListener('message', (e) => {
          try {
            const cmd = JSON.parse(e.data);
            if (cmd.type === 'SET_PEN_ACTIVE') {
              window.penModeActive = cmd.active;
              const drawCanvases = document.querySelectorAll('.drawing-canvas');
              drawCanvases.forEach(c => {
                if (cmd.active) {
                  c.classList.add('active');
                } else {
                  c.classList.remove('active');
                }
              });
            } else if (cmd.type === 'CLEAR_DRAWINGS') {
              const drawCanvases = document.querySelectorAll('.drawing-canvas');
              drawCanvases.forEach(c => {
                const dCtx = c.getContext('2d');
                dCtx.clearRect(0, 0, c.width, c.height);
                dCtx.beginPath();
              });
            }
          } catch (err) {}
        });
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

  // AI assistant states
  const [selectionText, setSelectionText] = useState<string | null>(null);
  const [scribbleActive, setScribbleActive] = useState<boolean>(false);
  const [drawingImage, setDrawingImage] = useState<string | null>(null);
  const [aiInputOpen, setAiInputOpen] = useState<boolean>(false);
  const [aiInputText, setAiInputText] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [pageTexts, setPageTexts] = useState<Record<number, string>>({});
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  // Refs & Animations
  const webViewRef = useRef<any>(null);
  const sheetHeight = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Keyboard height sync listener
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Sync pen active mode with WebView
  useEffect(() => {
    if (webViewRef.current && webViewLoaded) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'SET_PEN_ACTIVE',
        active: scribbleActive
      }));
    }
  }, [scribbleActive, webViewLoaded]);

  // Voice Pulse Looping Animation
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (loadingAi) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 800,
            useNativeDriver: true
          })
        ])
      );
      anim.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [loadingAi]);

  // Fetch wallet balance
  const fetchUserCredits = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.user) {
        setUserCredits(data.user.balance || 0);
      }
    } catch (err) {
      console.error("Error fetching user credits in reader:", err);
    }
  };

  useEffect(() => {
    if (aiInputOpen) {
      fetchUserCredits();
    }
  }, [aiInputOpen]);

  const handleClearDrawings = () => {
    setDrawingImage(null);
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'CLEAR_DRAWINGS'
      }));
    }
  };

  const handleSendAi = async (customQuestion?: string) => {
    const queryText = customQuestion !== undefined ? customQuestion : aiInputText;
    
    if (!queryText && !drawingImage) {
      Alert.alert("Fariintu waa madhan tahay", "Fadlan qor su'aal ama ku wareeji qalin.");
      return;
    }

    setLoadingAi(true);
    setAiResponse(null);

    // Animate response sheet up
    Animated.spring(sheetHeight, {
      toValue: 1,
      useNativeDriver: false
    }).start();

    // Compile document text context
    const fullDocText = Object.values(pageTexts).join('\n\n');
    const combinedContext = selectionText || fullDocText || `Page reading content of ${title || 'exam/book'}`;

    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${Config.API_URL}/api/chat/exam-assist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question: queryText,
          contextText: combinedContext,
          docTitle: title,
          docType: type || 'exam',
          attachment: drawingImage ? {
            base64: drawingImage,
            mimeType: 'image/jpeg'
          } : null
        })
      });

      const data = await response.json();
      if (response.ok) {
        setAiResponse(data.message);
        if (data.remainingBalance !== undefined) {
          setUserCredits(data.remainingBalance);
        }
        setAiInputText('');
        setDrawingImage(null);
        if (webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({ type: 'CLEAR_DRAWINGS' }));
        }
      } else {
        if (response.status === 402) {
          Alert.alert("Credit la'aan", data.message || "Wallet-kaagu kuma filna credit-ka su'aashan.");
          setAiResponse("Credit ku filan kuma harin wallet-kaaga. Fadlan ku shubo credit cusub.");
        } else {
          Alert.alert("Cilad", data.message || "Cilad ayaa dhacday wada hadalka AI.");
          setAiResponse("Nidaamka AI ayaa ku adkaaday inuu ka jawaabo hadda. Fadlan mar kale isku day.");
        }
      }
    } catch (err) {
      console.error("Error asking Exam AI:", err);
      setAiResponse("Xiriirka server-ka ayaa go'an. Fadlan hubi internet-kaaga.");
    } finally {
      setLoadingAi(false);
    }
  };

  let formattedPdfUrl = pdfUrl as string;
  if (formattedPdfUrl && !formattedPdfUrl.startsWith('http://') && !formattedPdfUrl.startsWith('https://') && !formattedPdfUrl.startsWith('file://')) {
    const cleanPath = formattedPdfUrl.startsWith('/') ? formattedPdfUrl : '/' + formattedPdfUrl;
    formattedPdfUrl = `${Config.API_URL}${cleanPath}`;
  }

  // Ensure PDF.js engine is cached locally
  const ensurePdfJsEngine = async () => {
    try {
      const pdfJsPath = `${FileSystem.documentDirectory}pdf.min.js`;
      const pdfWorkerPath = `${FileSystem.documentDirectory}pdf.worker.min.js`;

      const jsInfo = await FileSystem.getInfoAsync(pdfJsPath);
      if (!jsInfo.exists) {
        console.log("Downloading pdf.min.js to local cache...");
        await FileSystem.downloadAsync(
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
          pdfJsPath
        );
      }

      const workerInfo = await FileSystem.getInfoAsync(pdfWorkerPath);
      if (!workerInfo.exists) {
        console.log("Downloading pdf.worker.min.js to local cache...");
        await FileSystem.downloadAsync(
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js',
          pdfWorkerPath
        );
      }

      return { pdfJsPath, pdfWorkerPath };
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

        {!isCached && (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
        )}
      </View>

      <View style={styles.content}>
        {htmlUri ? (
          <View style={{ flex: 1 }}>
            <WebView 
              ref={webViewRef}
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
                  } else if (data.type === 'SELECTION') {
                    setSelectionText(data.text);
                  } else if (data.type === 'SELECTION_CLEAR') {
                    setSelectionText(null);
                  } else if (data.type === 'DRAWING_DATA') {
                    setDrawingImage(data.base64);
                    setScribbleActive(false); // Disable pen mode automatically
                    setAiInputOpen(true);     // Open the AI input bar automatically
                    if (webViewRef.current) {
                      webViewRef.current.postMessage(JSON.stringify({
                        type: 'SET_PEN_ACTIVE',
                        active: false
                      }));
                    }
                  } else if (data.type === 'PAGE_TEXT') {
                    setPageTexts(prev => ({
                      ...prev,
                      [data.pageNum]: data.text
                    }));
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

      {/* Floating Selection Tooltip Button */}
      {selectionText && !aiInputOpen && (
        <TouchableOpacity 
          style={styles.askSelectionBtn} 
          onPress={() => {
            setAiInputOpen(true);
            setAiInputText(`Fadlan ii sharax qoraalkan: "${selectionText}"`);
            handleSendAi(`Fadlan ii sharax qoraalkan: "${selectionText}"`);
          }}
        >
          <Ionicons name="sparkles" size={16} color="white" />
          <Text style={styles.askSelectionBtnText}>Ask Darkpen: "{selectionText.slice(0, 15)}..."</Text>
        </TouchableOpacity>
      )}

      {/* Floating AI Input Bar */}
      {aiInputOpen && (
        <BlurView 
          intensity={Platform.OS === 'ios' ? 90 : 100}
          tint={isDark ? 'dark' : 'light'}
          style={[
            styles.aiInputContainer,
            { bottom: keyboardHeight > 0 ? keyboardHeight + 16 : 24 }
          ]}
        >
          {/* Top Row: Pen mode and wallet badge */}
          <View style={styles.aiInputTopRow}>
            <TouchableOpacity 
              style={[styles.penToggleBtn, scribbleActive && styles.penToggleBtnActive]} 
              onPress={() => setScribbleActive(!scribbleActive)}
            >
              <Ionicons name="pencil" size={14} color={scribbleActive ? 'white' : colors.primary} />
              <Text style={[styles.penToggleBtnText, scribbleActive && { color: 'white' }]}>
                {scribbleActive ? 'Qalinka (Active)' : 'Scribble Mode'}
              </Text>
            </TouchableOpacity>

            <View style={styles.aiWalletBadge}>
              <Ionicons name="wallet-outline" size={14} color={colors.neutral} />
              <Text style={styles.aiWalletText}>{userCredits} Credits</Text>
            </View>
          </View>

          {/* Thumbnail preview if drawing image exists */}
          {drawingImage && (
            <View style={styles.thumbnailContainer}>
              <View style={styles.thumbnailWrapper}>
                <Image source={{ uri: drawingImage }} style={styles.thumbnailImg} />
                <TouchableOpacity 
                  style={styles.thumbnailCloseBtn} 
                  onPress={handleClearDrawings}
                >
                  <Ionicons name="close" size={12} color="white" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.editImagesBtn} onPress={() => setScribbleActive(true)}>
                <Ionicons name="crop" size={12} color={colors.secondary} />
                <Text style={styles.editImagesText}>Re-draw / Crop</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* The Gemini style pill input bar */}
          <View style={styles.aiInputBar}>
            <TextInput 
              style={styles.aiTextInput}
              placeholder="Weydii Darkpen..."
              placeholderTextColor={isDark ? '#9CA3AF' : '#64748B'}
              value={aiInputText}
              onChangeText={setAiInputText}
              onSubmitEditing={() => handleSendAi()}
            />

            <TouchableOpacity 
              style={[styles.sendBtn, (!aiInputText && !drawingImage) && styles.sendBtnDisabled]}
              onPress={() => handleSendAi()}
              disabled={!aiInputText && !drawingImage}
            >
              <Ionicons name="arrow-up" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </BlurView>
      )}

      {/* AI Response Slide-Up Sheet */}
      {aiInputOpen && (loadingAi || aiResponse) && (
        <Animated.View style={[
          styles.responseSheet,
          {
            transform: [{
              translateY: sheetHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [500, 0]
              })
            }]
          }
        ]}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandle} />
            <TouchableOpacity 
              style={styles.sheetCloseBtn}
              onPress={() => {
                Animated.timing(sheetHeight, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: false
                }).start(() => {
                  setAiResponse(null);
                  setLoadingAi(false);
                });
              }}
            >
              <Ionicons name="close-circle" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.sheetBody}>
            <Text style={styles.sheetTitle}>DARKPEN AI LIVE</Text>

            {loadingAi ? (
              <View style={styles.loadingAiContainer}>
                <Animated.View style={[
                  styles.pulseCircle1,
                  { transform: [{ scale: pulseAnim }] }
                ]} />
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.thinkingText}>Darkpen AI waa ay xisaabinaysaa...</Text>
              </View>
            ) : (
              <ScrollView style={styles.responseScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.responseText}>{aiResponse}</Text>
                <View style={{ height: 30 }} />
              </ScrollView>
            )}

            <View style={styles.costWarningCard}>
              <Ionicons name="information-circle-outline" size={14} color="#3B82F6" />
              <Text style={styles.costWarningText}>
                Fiiro gaar ah: Sawirka waxaa laga jarayaa 10 Credits, qoraalka 1-12 Credits.
              </Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Floating AI Extension Preparation Button */}
      {!aiInputOpen && (
        <TouchableOpacity 
          style={styles.floatingAiBtn} 
          activeOpacity={0.8}
          onPress={() => {
            setAiInputOpen(true);
            setScribbleActive(true);
          }}
        >
          <Ionicons name="sparkles" size={20} color="white" />
          <Text style={styles.floatingAiBtnText}>Ask AI</Text>
        </TouchableOpacity>
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
  },

  // AI Input Bar Styles
  aiInputContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.2)',
    overflow: 'hidden',
    zIndex: 998,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.35 : 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  aiInputTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  penToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(239, 246, 255, 0.8)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(71, 85, 105, 0.5)' : 'rgba(59, 130, 246, 0.3)',
  },
  penToggleBtnActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#2563EB',
  },
  penToggleBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3B82F6',
    marginLeft: 6,
  },
  aiWalletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiWalletText: {
    fontSize: 12,
    color: colors.neutral,
    fontWeight: '700',
  },
  thumbnailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    overflow: 'visible',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    resizeMode: 'cover',
  },
  thumbnailCloseBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editImagesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: isDark ? '#2D3748' : '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  editImagesText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
  },
  aiInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.5)' : 'rgba(241, 245, 249, 0.6)',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
  },
  plusBtn: {
    padding: 6,
  },
  aiTextInput: {
    flex: 1,
    fontSize: 14,
    color: colors.secondary,
    paddingHorizontal: 8,
    height: '100%',
  },
  sendBtn: {
    backgroundColor: '#3B82F6',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: isDark ? '#334155' : '#D1D5DB',
  },

  // AI Response Sheet Styles
  responseSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 460,
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.94)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 2,
    borderTopColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingTop: 10,
    zIndex: 999,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    height: 24,
    marginBottom: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: isDark ? '#475569' : '#CBD5E1',
    borderRadius: 2,
  },
  sheetCloseBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sheetBody: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#3B82F6',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  loadingAiContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pulseCircle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  thinkingText: {
    marginTop: 20,
    fontSize: 14,
    color: colors.neutral,
    fontWeight: '600',
  },
  responseScroll: {
    flex: 1,
    marginBottom: 10,
  },
  responseText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.secondary,
  },
  costWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    padding: 10,
    borderRadius: 12,
    marginBottom: Platform.OS === 'ios' ? 34 : 20,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  costWarningText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '700',
    flex: 1,
  },

  // Selection Button Tooltip
  askSelectionBtn: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    alignSelf: 'center',
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 997,
  },
  askSelectionBtnText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  }
});
