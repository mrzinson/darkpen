import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';

export default function ReaderExamScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  const { pdfUrl, title } = useLocalSearchParams();
  const router = useRouter();

  const [loadingStep, setLoadingStep] = useState('Checking files...');
  const [isReady, setIsReady] = useState(false);
  const [pdfFilename, setPdfFilename] = useState('');

  useEffect(() => {
    if (!pdfUrl) return;

    const prepareReader = async () => {
      try {
        const urlStr = pdfUrl as string;
        const filename = urlStr.split('/').pop() || 'document.pdf';
        setPdfFilename(filename);

        const pdfjsPath = `${FileSystem.documentDirectory}pdf.min.js`;
        const workerPath = `${FileSystem.documentDirectory}pdf.worker.min.js`;
        const pdfPath = `${FileSystem.documentDirectory}${filename}`;

        // 1. Check/Download pdf.min.js
        const pdfjsInfo = await FileSystem.getInfoAsync(pdfjsPath);
        if (!pdfjsInfo.exists) {
          setLoadingStep('Raryaya maktabada akhriska (1/3)...');
          await FileSystem.downloadAsync(
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
            pdfjsPath
          );
        }

        // 2. Check/Download pdf.worker.min.js
        const workerInfo = await FileSystem.getInfoAsync(workerPath);
        if (!workerInfo.exists) {
          setLoadingStep('Raryaya maktabada akhriska (2/3)...');
          await FileSystem.downloadAsync(
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js',
            workerPath
          );
        }

        // 3. Check/Download PDF Document
        const pdfInfo = await FileSystem.getInfoAsync(pdfPath);
        if (!pdfInfo.exists) {
          setLoadingStep('Soo dejinaya buugga/imtixaanka (3/3)...');
          await FileSystem.downloadAsync(urlStr, pdfPath);
        }

        setLoadingStep('Diyaar');
        setIsReady(true);
      } catch (err) {
        console.error('Error preparing PDF reader:', err);
        setLoadingStep('Cilad ayaa dhacday soo dejinta.');
      }
    };

    prepareReader();
  }, [pdfUrl]);

  if (!pdfUrl) {
    return (
      <View style={styles.errorContainer}>
        <Text style={{ color: colors.text }}>PDF lama helin</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.primary, marginTop: 10 }}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Create our offline-capable PDF.js HTML viewer string
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: ${isDark ? '#090D16' : '#F8FAFC'};
          color: ${isDark ? '#F8FAFC' : '#0F172A'};
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          user-select: none;
          -webkit-user-select: none;
        }
        #loading {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-size: 16px;
        }
        #canvas-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 10px 0;
        }
        canvas {
          margin-bottom: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
          max-width: 98%;
          height: auto !important;
        }
      </style>
      <script src="pdf.min.js"></script>
    </head>
    <body>
      <div id="loading">Faylka waa la diyaarinayaa...</div>
      <div id="canvas-container"></div>

      <script>
        window.onload = function() {
          try {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
            
            const loadingTask = pdfjsLib.getDocument('${pdfFilename}');
            loadingTask.promise.then(function(pdf) {
              document.getElementById('loading').style.display = 'none';
              const container = document.getElementById('canvas-container');
              
              let renderQueue = Promise.resolve();
              
              for (let i = 1; i <= pdf.numPages; i++) {
                renderQueue = renderQueue.then(() => {
                  return pdf.getPage(i).then(function(page) {
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    container.appendChild(canvas);
                    
                    return page.render({
                      canvasContext: context,
                      viewport: viewport
                    }).promise;
                  });
                });
              }
            }).catch(function(error) {
              document.getElementById('loading').innerText = 'Cilad rarka PDF-ka: ' + error.message;
            });
          } catch (err) {
            document.getElementById('loading').innerText = 'Cilad: ' + err.message;
          }
        }
      </script>
    </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title || 'Exam Reader'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {Platform.OS === 'web' ? (
          <iframe 
            src={`${pdfUrl}#toolbar=0`} 
            style={{ width: '100%', height: '100%', border: 'none' }} 
            title={title as string}
          />
        ) : !isReady ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 10, color: colors.text }}>{loadingStep}</Text>
          </View>
        ) : (
          <WebView 
            source={{ 
              html: htmlContent, 
              baseUrl: FileSystem.documentDirectory || undefined 
            }}
            style={styles.webview}
            javaScriptEnabled={true}
            originWhitelist={['*']}
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
            allowFileAccessFromFileURLs={true}
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
