import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ActivityIndicator,
  Platform, Alert, TextInput, Image, Animated, ScrollView,
  Keyboard, Easing
} from 'react-native';
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

// ─── PDF.js HTML Generator ────────────────────────────────────────────────────
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
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body {
          margin: 0; padding: 0;
          background-color: ${bgColor};
          color: ${textColor};
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          display: flex; flex-direction: column; align-items: center; min-height: 100vh;
        }
        #viewer { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 16px 8px; }
        .page-container {
          position: relative;
          box-shadow: 0 4px 12px rgba(0, 0, 0, ${isDark ? '0.4' : '0.1'});
          background-color: ${paperColor};
          max-width: 100%; border-radius: 12px; overflow: hidden;
          display: flex; justify-content: center; align-items: center;
          border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'};
        }
        canvas { display: block; width: 100% !important; height: auto !important; }
        .drawing-canvas {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          z-index: 5; background: transparent; pointer-events: none;
        }
        .drawing-canvas.active { pointer-events: auto; touch-action: none; }
        .page-number {
          position: absolute; bottom: 12px; right: 12px;
          background: rgba(15, 23, 42, 0.75); color: #ffffff;
          padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 20px;
          pointer-events: none; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.15); z-index: 10;
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
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOADED', totalPages: numPages }));
            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
              renderPage(pdf, pageNum, viewer);
            }
          }).catch(function(error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: error.message }));
          });
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', message: e.message }));
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
            const renderContext = { canvasContext: context, viewport: viewport };
            page.render(renderContext);
            page.getTextContent().then(function(textContent) {
              const textItems = textContent.items.map(function(item) { return item.str; }).join(' ');
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAGE_TEXT', pageNum: pageNum, text: textItems }));
            }).catch(function(e) {});
            const dCtx = drawCanvas.getContext('2d');
            let drawing = false;
            dCtx.strokeStyle = '#6366F1';
            dCtx.lineWidth = 5;
            dCtx.lineCap = 'round';
            dCtx.lineJoin = 'round';
            function getPos(canvasDom, e) {
              const rect = canvasDom.getBoundingClientRect();
              const touch = e.touches && e.touches[0] ? e.touches[0] : e;
              return {
                x: (touch.clientX - rect.left) * (canvasDom.width / rect.width),
                y: (touch.clientY - rect.top) * (canvasDom.height / rect.height)
              };
            }
            function startDraw(e) { e.preventDefault(); drawing = true; const pos = getPos(drawCanvas, e); dCtx.beginPath(); dCtx.moveTo(pos.x, pos.y); }
            function draw(e) { if (!drawing) return; e.preventDefault(); const pos = getPos(drawCanvas, e); dCtx.lineTo(pos.x, pos.y); dCtx.stroke(); }
            function endDraw(e) { if (!drawing) return; e.preventDefault(); drawing = false; dCtx.closePath(); captureSnippet(canvas, drawCanvas); }
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
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DRAWING_DATA', base64: base64Data }));
        }

        document.addEventListener('selectionchange', () => {
          const selection = window.getSelection();
          const text = selection.toString().trim();
          if (text.length > 0) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECTION', text: text }));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECTION_CLEAR' }));
          }
        });

        window.addEventListener('message', (e) => {
          try {
            const cmd = JSON.parse(e.data);
            if (cmd.type === 'SET_PEN_ACTIVE') {
              window.penModeActive = cmd.active;
              const drawCanvases = document.querySelectorAll('.drawing-canvas');
              drawCanvases.forEach(c => {
                if (cmd.active) { c.classList.add('active'); } else { c.classList.remove('active'); }
              });
              if (cmd.active) {
                document.body.style.overflow = 'hidden';
                document.body.style.touchAction = 'none';
              } else {
                document.body.style.overflow = 'auto';
                document.body.style.touchAction = 'auto';
              }
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

// ─── Chat Message Type ─────────────────────────────────────────────────────────
type ChatMessage = {
  role: 'user' | 'ai';
  text: string;
};

// ─── Gemini Wave Loading Animation ────────────────────────────────────────────
const WAVE_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

function GeminiWaveLoader() {
  const anims = useRef(WAVE_COLORS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 100),
          Animated.timing(anim, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={waveStyles.container}>
      {WAVE_COLORS.map((color, i) => (
        <Animated.View
          key={i}
          style={[
            waveStyles.bar,
            { backgroundColor: color },
            {
              transform: [{
                scaleY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.6] })
              }]
            }
          ]}
        />
      ))}
      <Text style={waveStyles.label}>Darkpen AI waa ay xisaabinaysaa...</Text>
    </View>
  );
}

const waveStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 16 },
  bar: { width: 6, height: 32, borderRadius: 4, marginHorizontal: 3 },
  label: { fontSize: 13, color: '#9CA3AF', fontWeight: '600', marginTop: 4 },
});

// Wrap bars in a row
function GeminiWave() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 40, marginBottom: 12 }}>
        {WAVE_COLORS.map((_, i) => (
          <GeminiBar key={i} index={i} />
        ))}
      </View>
      <Text style={{ fontSize: 13, color: '#9CA3AF', fontWeight: '600' }}>Darkpen AI waa ay xisaabinaysaa...</Text>
    </View>
  );
}

function GeminiBar({ index }: { index: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 120),
        Animated.timing(anim, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={{
        width: 7,
        height: 36,
        borderRadius: 5,
        marginHorizontal: 4,
        backgroundColor: WAVE_COLORS[index % WAVE_COLORS.length],
        transform: [{
          scaleY: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.5] })
        }]
      }}
    />
  );
}

// ─── AI Response Renderer ──────────────────────────────────────────────────────
function AiResponseRenderer({ text, colors, isDark }: { text: string; colors: any; isDark: boolean }) {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let i = 0;

  // Helper: parse inline formatting (bold, green, red, code)
  function parseInline(rawLine: string, key: string): JSX.Element {
    const parts: JSX.Element[] = [];
    let remaining = rawLine;
    let pi = 0;

    // Patterns: <green>...</green>, <red>...</red>, **bold**, `code`
    const patterns = [
      { regex: /<green>(.*?)<\/green>/s, color: '#10B981', bold: true },
      { regex: /<red>(.*?)<\/red>/s, color: '#EF4444', bold: true },
    ];

    // Simple sequential replace
    function renderSegment(seg: string, segKey: string): JSX.Element[] {
      const result: JSX.Element[] = [];
      let rest = seg;
      let idx = 0;

      while (rest.length > 0) {
        // Check <green>
        const greenMatch = rest.match(/<green>(.*?)<\/green>/s);
        const redMatch = rest.match(/<red>(.*?)<\/red>/s);
        const boldMatch = rest.match(/\*\*(.*?)\*\*/s);
        const codeMatch = rest.match(/`(.*?)`/s);

        const candidates = [
          greenMatch && { match: greenMatch, color: '#10B981', bold: true, bg: false },
          redMatch && { match: redMatch, color: '#EF4444', bold: true, bg: false },
          boldMatch && { match: boldMatch, color: colors.secondary, bold: true, bg: false },
          codeMatch && { match: codeMatch, color: '#6366F1', bold: false, bg: true },
        ].filter(Boolean) as any[];

        if (candidates.length === 0) {
          result.push(<Text key={`${segKey}-rest-${idx}`} style={{ color: colors.secondary }}>{rest}</Text>);
          break;
        }

        // Pick earliest match
        let earliest = candidates[0];
        for (const c of candidates) {
          if (c.match.index! < earliest.match.index!) earliest = c;
        }

        const before = rest.slice(0, earliest.match.index);
        if (before) {
          result.push(<Text key={`${segKey}-b-${idx}`} style={{ color: colors.secondary }}>{before}</Text>);
          idx++;
        }

        result.push(
          <Text
            key={`${segKey}-m-${idx}`}
            style={{
              color: earliest.color,
              fontWeight: earliest.bold ? '700' : '400',
              backgroundColor: earliest.bg ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)') : 'transparent',
              borderRadius: 4, paddingHorizontal: earliest.bg ? 4 : 0,
              fontFamily: earliest.bg ? Platform.OS === 'ios' ? 'Menlo' : 'monospace' : undefined
            }}
          >
            {earliest.match[1]}
          </Text>
        );
        idx++;
        rest = rest.slice(earliest.match.index! + earliest.match[0].length);
      }
      return result;
    }

    return <Text key={key}>{renderSegment(rawLine, key)}</Text>;
  }

  while (i < lines.length) {
    const line = lines[i];

    // <table_data>...</table_data>
    if (line.trim() === '<table_data>') {
      const tableLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '</table_data>') {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length > 0) {
        const headers = tableLines[0].split('|');
        const rows = tableLines.slice(1);
        elements.push(
          <View key={`table-${i}`} style={[rStyles.tableContainer, isDark ? rStyles.tableDark : rStyles.tableLight]}>
            <View style={rStyles.tableHeaderRow}>
              {headers.map((h, hi) => (
                <Text key={hi} style={rStyles.tableHeaderCell}>{h.trim()}</Text>
              ))}
            </View>
            {rows.map((row, ri) => (
              <View key={ri} style={[rStyles.tableRow, ri % 2 === 0 ? (isDark ? rStyles.tableRowAltDark : rStyles.tableRowAltLight) : {}]}>
                {row.split('|').map((cell, ci) => (
                  <Text key={ci} style={[rStyles.tableCell, { color: colors.secondary }]}>{cell.trim()}</Text>
                ))}
              </View>
            ))}
          </View>
        );
      }
      i++;
      continue;
    }

    // <callout>...</callout>
    if (line.trim().startsWith('<callout>')) {
      const calloutText = line.replace(/<callout>/g, '').replace(/<\/callout>/g, '').trim();
      elements.push(
        <View key={`callout-${i}`} style={[rStyles.callout, isDark ? rStyles.calloutDark : rStyles.calloutLight]}>
          <Ionicons name="information-circle" size={16} color="#6366F1" />
          <Text style={rStyles.calloutText}>{calloutText}</Text>
        </View>
      );
      i++;
      continue;
    }

    // # Heading 1
    if (line.startsWith('# ')) {
      elements.push(<Text key={`h1-${i}`} style={[rStyles.h1, { color: colors.secondary }]}>{line.slice(2)}</Text>);
      i++;
      continue;
    }
    // ## Heading 2
    if (line.startsWith('## ')) {
      elements.push(<Text key={`h2-${i}`} style={[rStyles.h2, { color: colors.secondary }]}>{line.slice(3)}</Text>);
      i++;
      continue;
    }
    // ### Heading 3
    if (line.startsWith('### ')) {
      elements.push(<Text key={`h3-${i}`} style={[rStyles.h3, { color: '#6366F1' }]}>{line.slice(4)}</Text>);
      i++;
      continue;
    }

    // Bullet: - or * or numbered
    const bulletMatch = line.match(/^(\s*[-*•]|\s*\d+\.) (.+)/);
    if (bulletMatch) {
      const isNumbered = /\d+\./.test(bulletMatch[1]);
      elements.push(
        <View key={`bullet-${i}`} style={rStyles.bulletRow}>
          <Text style={[rStyles.bulletDot, { color: '#6366F1' }]}>{isNumbered ? bulletMatch[1].trim() : '•'}</Text>
          <Text style={[rStyles.bulletText, { color: colors.secondary }]}>{bulletMatch[2]}</Text>
        </View>
      );
      i++;
      continue;
    }

    // ```code block```
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <View key={`code-${i}`} style={[rStyles.codeBlock, isDark ? rStyles.codeBlockDark : rStyles.codeBlockLight]}>
          {lang ? <Text style={rStyles.codeLang}>{lang}</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={rStyles.codeText}>{codeLines.join('\n')}</Text>
          </ScrollView>
        </View>
      );
      i++;
      continue;
    }

    // Empty line → spacer
    if (line.trim() === '') {
      elements.push(<View key={`space-${i}`} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // Default: inline parsed text
    elements.push(
      <Text key={`line-${i}`} style={[rStyles.bodyText, { color: colors.secondary }]}>
        {parseInline(line, `inline-${i}`)}
      </Text>
    );
    i++;
  }

  return <View style={{ paddingBottom: 8 }}>{elements}</View>;
}

const rStyles = StyleSheet.create({
  h1: { fontSize: 18, fontWeight: '900', marginTop: 16, marginBottom: 6 },
  h2: { fontSize: 16, fontWeight: '800', marginTop: 12, marginBottom: 4 },
  h3: { fontSize: 14, fontWeight: '800', marginTop: 8, marginBottom: 4 },
  bodyText: { fontSize: 14, lineHeight: 22, marginBottom: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 3, paddingLeft: 4 },
  bulletDot: { fontSize: 14, fontWeight: '800', marginRight: 8, marginTop: 1, minWidth: 14 },
  bulletText: { fontSize: 14, lineHeight: 22, flex: 1 },
  tableContainer: { borderRadius: 12, overflow: 'hidden', marginVertical: 10, borderWidth: 1 },
  tableDark: { borderColor: 'rgba(99,102,241,0.3)', backgroundColor: 'rgba(30,41,59,0.8)' },
  tableLight: { borderColor: 'rgba(99,102,241,0.2)', backgroundColor: '#F8FAFC' },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#6366F1', padding: 8 },
  tableHeaderCell: { flex: 1, color: 'white', fontWeight: '800', fontSize: 12, textAlign: 'center' },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4 },
  tableRowAltDark: { backgroundColor: 'rgba(99,102,241,0.05)' },
  tableRowAltLight: { backgroundColor: 'rgba(99,102,241,0.03)' },
  tableCell: { flex: 1, fontSize: 12, textAlign: 'center', paddingHorizontal: 4 },
  callout: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, marginVertical: 8, borderLeftWidth: 3, borderLeftColor: '#6366F1' },
  calloutDark: { backgroundColor: 'rgba(99,102,241,0.1)' },
  calloutLight: { backgroundColor: '#EEF2FF' },
  calloutText: { fontSize: 13, color: '#6366F1', fontWeight: '700', flex: 1 },
  codeBlock: { borderRadius: 10, padding: 12, marginVertical: 8 },
  codeBlockDark: { backgroundColor: '#0F172A' },
  codeBlockLight: { backgroundColor: '#F1F5F9' },
  codeLang: { fontSize: 10, color: '#9CA3AF', fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  codeText: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#10B981', lineHeight: 18 },
});

// ─── Main Component ───────────────────────────────────────────────────────────
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
  const [aiPanelOpen, setAiPanelOpen] = useState<boolean>(false);
  const [aiInputText, setAiInputText] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [pageTexts, setPageTexts] = useState<Record<number, string>>({});
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);

  // Refs & Animations
  const webViewRef = useRef<any>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  // Scroll WebView (disable when pen active)
  const setWebViewScroll = useCallback((enabled: boolean) => {
    if (webViewRef.current && webViewLoaded) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'SET_PEN_ACTIVE',
        active: !enabled
      }));
    }
  }, [webViewLoaded]);

  // Keyboard
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Sync pen mode with WebView
  useEffect(() => {
    if (webViewRef.current && webViewLoaded) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'SET_PEN_ACTIVE',
        active: scribbleActive
      }));
    }
  }, [scribbleActive, webViewLoaded]);

  // Sheet slide animation
  const openSheet = () => {
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };
  const closeSheet = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setAiPanelOpen(false);
      setChatHistory([]);
      setAiInputText('');
      setDrawingImage(null);
      setScribbleActive(false);
    });
  };

  // Fetch user credits
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
    if (aiPanelOpen) fetchUserCredits();
  }, [aiPanelOpen]);

  // Auto-scroll to bottom when chat grows
  useEffect(() => {
    if (chatHistory.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [chatHistory]);

  const handleClearDrawings = () => {
    setDrawingImage(null);
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'CLEAR_DRAWINGS' }));
    }
  };

  const handleSendAi = async (customQuestion?: string) => {
    const queryText = customQuestion !== undefined ? customQuestion : aiInputText;

    if (!queryText.trim() && !drawingImage) {
      Alert.alert("Fariintu waa madhan tahay", "Fadlan qor su'aal ama ku wareeji qalin.");
      return;
    }

    const userMessage = queryText.trim() || '[Sawir/Drawing]';
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', text: userMessage }];
    setChatHistory(newHistory);
    setAiInputText('');
    setLoadingAi(true);

    if (!aiPanelOpen) {
      setAiPanelOpen(true);
      openSheet();
    }

    const fullDocText = Object.values(pageTexts).join('\n\n');
    const combinedContext = selectionText || fullDocText || `Page reading content of ${title || 'exam/book'}`;

    // Build Gemini history format
    const geminiHistory = newHistory.slice(0, -1).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

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
          history: geminiHistory,
          attachment: drawingImage ? {
            base64: drawingImage,
            mimeType: 'image/jpeg'
          } : null
        })
      });

      const data = await response.json();
      if (response.ok) {
        setChatHistory(prev => [...prev, { role: 'ai', text: data.message }]);
        if (data.remainingBalance !== undefined) setUserCredits(data.remainingBalance);
        setDrawingImage(null);
        if (webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify({ type: 'CLEAR_DRAWINGS' }));
        }
      } else {
        const errText = response.status === 402
          ? "Credit ku filan kuma harin wallet-kaaga. Fadlan ku shubo credit cusub."
          : (data.message || "Cilad ayaa dhacday wada hadalka AI.");
        setChatHistory(prev => [...prev, { role: 'ai', text: errText }]);
        if (response.status === 402) {
          Alert.alert("Credit la'aan", data.message || "Wallet-kaagu kuma filna.");
        }
      }
    } catch (err) {
      console.error("Error asking Exam AI:", err);
      setChatHistory(prev => [...prev, { role: 'ai', text: "Xiriirka server-ka ayaa go'an. Fadlan hubi internet-kaaga." }]);
    } finally {
      setLoadingAi(false);
    }
  };

  let formattedPdfUrl = pdfUrl as string;
  if (formattedPdfUrl && !formattedPdfUrl.startsWith('http://') && !formattedPdfUrl.startsWith('https://') && !formattedPdfUrl.startsWith('file://')) {
    const cleanPath = formattedPdfUrl.startsWith('/') ? formattedPdfUrl : '/' + formattedPdfUrl;
    formattedPdfUrl = `${Config.API_URL}${cleanPath}`;
  }

  const ensurePdfJsEngine = async () => {
    try {
      const pdfJsPath = `${FileSystem.documentDirectory}pdf.min.js`;
      const pdfWorkerPath = `${FileSystem.documentDirectory}pdf.worker.min.js`;
      const jsInfo = await FileSystem.getInfoAsync(pdfJsPath);
      if (!jsInfo.exists) {
        await FileSystem.downloadAsync('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js', pdfJsPath);
      }
      const workerInfo = await FileSystem.getInfoAsync(pdfWorkerPath);
      if (!workerInfo.exists) {
        await FileSystem.downloadAsync('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js', pdfWorkerPath);
      }
      return { pdfJsPath, pdfWorkerPath };
    } catch (err) {
      console.error("Error ensuring PDF.js engine:", err);
      throw err;
    }
  };

  useEffect(() => {
    if (!formattedPdfUrl) return;
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
          setDownloading(true);
          setDownloadProgress(0);
          const downloadResumable = FileSystem.createDownloadResumable(
            urlStr, targetPath, {},
            (dp) => setDownloadProgress(dp.totalBytesWritten / dp.totalBytesExpectedToWrite || 0)
          );
          const result = await downloadResumable.downloadAsync();
          if (result && result.status === 200) {
            setIsCached(true);
            let finalType: 'book' | 'exam' = 'book';
            if (type) {
              finalType = type as 'book' | 'exam';
            } else {
              finalType = (formattedPdfUrl.toLowerCase().includes('exam') || (title && (title as string).toLowerCase().includes('imtixaan'))) ? 'exam' : 'book';
            }
            await registerDownload({ pdfUrl: formattedPdfUrl, title: (title as string) || 'Document', type: finalType, localPath: targetPath, grade: 'Form 4' });
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

  useEffect(() => {
    if (!isCached || !localPath) return;
    const loadLocalPdf = async () => {
      try {
        await ensurePdfJsEngine();
        const filename = localPath.split('/').pop() || 'document.pdf';
        const generatedHtml = getHtmlContent(filename, isDark);
        const viewerHtmlPath = `${FileSystem.documentDirectory}viewer.html`;
        await FileSystem.writeAsStringAsync(viewerHtmlPath, generatedHtml);
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
          data: contentUri, flags: 1, type: 'application/pdf',
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
      let finalType: 'book' | 'exam' = type ? (type as 'book' | 'exam') :
        (formattedPdfUrl.toLowerCase().includes('exam') || (title && (title as string).toLowerCase().includes('imtixaan'))) ? 'exam' : 'book';
      await registerDownload({ pdfUrl: formattedPdfUrl, title: (title as string) || 'Document', type: finalType, localPath: localPath, grade: 'Form 4' });
      setIsSavedOffline(true);
      Alert.alert('Downloads-ka waa lagu daray', 'Waa la soo dejiyey! ⚡');
    }
  };

  // ─── Render: Error states ─────────────────────────────────────────────────────
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
          <Text style={styles.downloadSubtitle}>Faylka waa la soo dejinayaa, fadlan sug...</Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
          </View>
          <Text style={styles.downloadPercent}>{Math.round(downloadProgress * 100)}%</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={[styles.downloadTitle, { color: '#EF4444', marginTop: 16 }]}>Cilad Farsamo</Text>
        <Text style={[styles.downloadSubtitle, { textAlign: 'center', marginTop: 8 }]}>{errorMessage}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryBtnText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ─── Panel sheet translateY ───────────────────────────────────────────────────
  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [700, 0]
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title || 'Document Reader'}</Text>

        {!isSavedOffline && !formattedPdfUrl.startsWith('file://') && !passedLocalPath && (
          <TouchableOpacity onPress={handleToggleSaveOffline} style={styles.offlineBtn} activeOpacity={0.7}>
            <Ionicons name="cloud-download-outline" size={24} color={colors.secondary} />
          </TouchableOpacity>
        )}

        {!isCached && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />}
      </View>

      {/* ── WebView Content ─────────────────────────────────────────────────── */}
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
              scrollEnabled={!scribbleActive}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'LOADED') {
                    setWebViewLoaded(true);
                  } else if (data.type === 'ERROR') {
                    setErrorMessage(data.message);
                  } else if (data.type === 'SELECTION') {
                    setSelectionText(data.text);
                  } else if (data.type === 'SELECTION_CLEAR') {
                    setSelectionText(null);
                  } else if (data.type === 'DRAWING_DATA') {
                    setDrawingImage(data.base64);
                    setScribbleActive(false);
                    if (!aiPanelOpen) {
                      setAiPanelOpen(true);
                      openSheet();
                    }
                    if (webViewRef.current) {
                      webViewRef.current.postMessage(JSON.stringify({ type: 'SET_PEN_ACTIVE', active: false }));
                    }
                  } else if (data.type === 'PAGE_TEXT') {
                    setPageTexts(prev => ({ ...prev, [data.pageNum]: data.text }));
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

      {/* ── Floating Selection Tooltip ─────────────────────────────────────── */}
      {selectionText && !aiPanelOpen && (
        <TouchableOpacity
          style={styles.askSelectionBtn}
          onPress={() => {
            setAiPanelOpen(true);
            openSheet();
            const q = `Fadlan ii sharax qoraalkan: "${selectionText}"`;
            setAiInputText(q);
            handleSendAi(q);
          }}
        >
          <Ionicons name="sparkles" size={16} color="white" />
          <Text style={styles.askSelectionBtnText}>Ask Darkpen: "{selectionText.slice(0, 15)}..."</Text>
        </TouchableOpacity>
      )}

      {/* ── Floating AI Button ─────────────────────────────────────────────── */}
      {!aiPanelOpen && (
        <TouchableOpacity
          style={styles.floatingAiBtn}
          activeOpacity={0.8}
          onPress={() => {
            setAiPanelOpen(true);
            openSheet();
          }}
        >
          <Ionicons name="sparkles" size={20} color="white" />
          <Text style={styles.floatingAiBtnText}>Ask AI</Text>
        </TouchableOpacity>
      )}

      {/* ── AI Full Panel (Slide-Up Sheet) ────────────────────────────────── */}
      {aiPanelOpen && (
        <Animated.View
          style={[
            styles.aiPanel,
            { transform: [{ translateY: sheetTranslateY }] }
          ]}
        >
          {/* Panel Header */}
          <View style={styles.panelHeader}>
            <View style={styles.panelHandle} />
            {/* Gemini-style colored title */}
            <View style={styles.panelTitleRow}>
              <Ionicons name="sparkles" size={18} color="#6366F1" />
              <Text style={styles.panelTitle}>DARKPEN AI</Text>
              <View style={styles.panelCreditsChip}>
                <Ionicons name="wallet-outline" size={11} color="#9CA3AF" />
                <Text style={styles.panelCreditsText}>{userCredits}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.panelCloseBtn} onPress={closeSheet}>
              <Ionicons name="close-circle" size={28} color={isDark ? '#475569' : '#CBD5E1'} />
            </TouchableOpacity>
          </View>

          {/* Chat History */}
          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {chatHistory.length === 0 && !loadingAi && (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={isDark ? '#334155' : '#CBD5E1'} />
                <Text style={styles.emptyStateText}>Weydii Darkpen su'aal ku saabsan buugga ama imtixaanka</Text>
              </View>
            )}

            {chatHistory.map((msg, idx) => (
              <View key={idx} style={msg.role === 'user' ? styles.userBubble : styles.aiBubbleContainer}>
                {msg.role === 'user' ? (
                  <Text style={styles.userBubbleText}>{msg.text}</Text>
                ) : (
                  <View style={[styles.aiBubble, isDark ? styles.aiBubbleDark : styles.aiBubbleLight]}>
                    <View style={styles.aiLabel}>
                      <Ionicons name="sparkles" size={11} color="#6366F1" />
                      <Text style={styles.aiLabelText}>Darkpen AI</Text>
                    </View>
                    <AiResponseRenderer text={msg.text} colors={colors} isDark={isDark} />
                  </View>
                )}
              </View>
            ))}

            {loadingAi && <GeminiWave />}
          </ScrollView>

          {/* Drawing thumbnail */}
          {drawingImage && (
            <View style={styles.thumbRow}>
              <View style={styles.thumbBox}>
                <Image source={{ uri: drawingImage }} style={styles.thumbImg} />
                <TouchableOpacity style={styles.thumbClose} onPress={handleClearDrawings}>
                  <Ionicons name="close" size={12} color="white" />
                </TouchableOpacity>
              </View>
              <Text style={styles.thumbLabel}>Sawirka ayaa la dir</Text>
            </View>
          )}

          {/* Scribble / Pen Mode Toggle */}
          <View style={styles.penRow}>
            <TouchableOpacity
              style={[styles.penBtn, scribbleActive && styles.penBtnActive]}
              onPress={() => setScribbleActive(!scribbleActive)}
            >
              <Ionicons name="pencil" size={14} color={scribbleActive ? 'white' : '#6366F1'} />
              <Text style={[styles.penBtnText, scribbleActive && { color: 'white' }]}>
                {scribbleActive ? 'Qalinka (Active)' : 'Scribble / Qor'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Input Bar */}
          <BlurView
            intensity={Platform.OS === 'ios' ? 80 : 100}
            tint={isDark ? 'dark' : 'light'}
            style={[styles.inputBar, { marginBottom: keyboardHeight > 0 ? keyboardHeight - 20 : 12 }]}
          >
            <TextInput
              style={styles.textInput}
              placeholder="Weydii Darkpen..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={aiInputText}
              onChangeText={setAiInputText}
              onSubmitEditing={() => handleSendAi()}
              multiline
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!aiInputText.trim() && !drawingImage) && styles.sendBtnDisabled]}
              onPress={() => handleSendAi()}
              disabled={!aiInputText.trim() && !drawingImage}
            >
              <Ionicons name="arrow-up" size={18} color="white" />
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: isDark ? '#1E293B' : '#F1F5F9',
  },
  backBtn: { padding: 8 },
  title: { fontSize: 16, fontWeight: '700', color: colors.secondary, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  offlineBtn: { padding: 8, marginRight: 4 },
  content: { flex: 1 },
  webview: { flex: 1 },
  loadingAbsolute: {
    ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.card, zIndex: 10,
  },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  // Download
  downloadCard: {
    backgroundColor: colors.card, borderRadius: 24, padding: 32, width: '100%', maxWidth: 320,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border || 'rgba(255,255,255,0.05)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 8,
  },
  downloadTitle: { fontSize: 18, fontWeight: '800', color: colors.secondary, marginTop: 20, textAlign: 'center' },
  downloadSubtitle: { fontSize: 14, color: colors.textLight || '#6B7280', marginTop: 8, marginBottom: 24, textAlign: 'center' },
  progressBarBg: { width: '100%', height: 8, backgroundColor: isDark ? '#374151' : '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  downloadPercent: { fontSize: 16, fontWeight: '800', color: colors.primary },
  retryBtn: { marginTop: 24, backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 32, borderRadius: 24 },
  retryBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },

  // Floating buttons
  floatingAiBtn: {
    position: 'absolute', bottom: 24, right: 24,
    backgroundColor: '#6366F1',
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 20, borderRadius: 30,
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 14,
    elevation: 10, zIndex: 999,
  },
  floatingAiBtnText: { color: 'white', fontWeight: '800', fontSize: 15, marginLeft: 8 },
  askSelectionBtn: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 100 : 80, alignSelf: 'center',
    backgroundColor: '#6366F1', flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 24,
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8,
    elevation: 8, zIndex: 997,
  },
  askSelectionBtnText: { color: 'white', fontSize: 13, fontWeight: '800', marginLeft: 6 },

  // AI Panel
  aiPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '75%',
    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 2, borderTopColor: '#6366F1',
    zIndex: 1000,
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.25, shadowRadius: 20,
    elevation: 25,
    paddingTop: 0,
  },
  panelHeader: {
    paddingTop: 12, paddingHorizontal: 16, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
    alignItems: 'center',
  },
  panelHandle: { width: 40, height: 4, backgroundColor: isDark ? '#334155' : '#E2E8F0', borderRadius: 2, marginBottom: 10 },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  panelTitle: {
    fontSize: 16, fontWeight: '900', letterSpacing: 1.5,
    color: '#6366F1',
  },
  panelCreditsChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF',
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 20,
  },
  panelCreditsText: { fontSize: 11, color: '#9CA3AF', fontWeight: '700' },
  panelCloseBtn: { position: 'absolute', right: 16, top: 10 },

  chatScroll: { flex: 1, paddingHorizontal: 14 },
  emptyState: { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyStateText: {
    fontSize: 14, color: isDark ? '#475569' : '#94A3B8', textAlign: 'center',
    fontWeight: '500', maxWidth: 260, lineHeight: 20,
  },

  // Chat bubbles
  userBubble: {
    alignSelf: 'flex-end', marginVertical: 4, maxWidth: '80%',
    backgroundColor: '#6366F1', borderRadius: 18, borderBottomRightRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
    elevation: 4,
  },
  userBubbleText: { color: 'white', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  aiBubbleContainer: { alignSelf: 'flex-start', width: '95%', marginVertical: 4 },
  aiBubble: { borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  aiBubbleDark: { backgroundColor: 'rgba(30,41,59,0.9)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
  aiBubbleLight: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: 'rgba(99,102,241,0.15)' },
  aiLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  aiLabelText: { fontSize: 10, fontWeight: '800', color: '#6366F1', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Drawing thumbnail
  thumbRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 10 },
  thumbBox: { position: 'relative', width: 50, height: 50, borderRadius: 8, borderWidth: 1.5, borderColor: '#6366F1', overflow: 'visible' },
  thumbImg: { width: '100%', height: '100%', borderRadius: 6, resizeMode: 'cover' },
  thumbClose: { position: 'absolute', top: -6, right: -6, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  thumbLabel: { fontSize: 12, color: isDark ? '#64748B' : '#94A3B8', fontWeight: '500' },

  // Pen row
  penRow: { paddingHorizontal: 14, paddingBottom: 6 },
  penBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.08)',
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20,
    borderWidth: 1, borderColor: isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.25)',
    gap: 6,
  },
  penBtnActive: { backgroundColor: '#6366F1', borderColor: '#4F46E5' },
  penBtnText: { fontSize: 12, fontWeight: '800', color: '#6366F1' },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, borderRadius: 24,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)',
    overflow: 'hidden',
  },
  textInput: {
    flex: 1, fontSize: 14, color: colors.secondary,
    paddingHorizontal: 6, maxHeight: 90, minHeight: 38,
  },
  sendBtn: {
    backgroundColor: '#6366F1', width: 38, height: 38,
    borderRadius: 19, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 6,
    elevation: 4,
  },
  sendBtnDisabled: { backgroundColor: isDark ? '#334155' : '#D1D5DB', shadowOpacity: 0 },
});
