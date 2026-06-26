import React from 'react';
import { View, Text, StyleSheet, Platform, Alert, ScrollView, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

const makeSubscript = (numStr: string): string => {
  const subs: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
  };
  return numStr.split('').map(c => subs[c] || c).join('');
};

const makeSuperscript = (numStr: string): string => {
  const sups: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
  };
  return numStr.split('').map(c => sups[c] || c).join('');
};

const ensureTableTags = (text: string): string => {
  if (!text) return text;
  
  // Normalize: strip existing <table_data> and </table_data> tags (case-insensitive) to prevent double wrapping
  let cleaned = text.replace(/<\/?table_data>/gi, '');
  
  const lines = cleaned.split('\n');
  const processedLines: string[] = [];
  let currentTableLines: string[] = [];
  
  const isTableLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.includes('|')) return false;
    // Skip code block fences and HTML tags
    if (trimmed.startsWith('```') || trimmed.startsWith('<')) return false;
    return true;
  };
  
  const isRealTable = (block: string[]) => {
    if (block.length < 2) return false;
    
    let hasHeaderIndicator = false;
    let hasNumberIndicator = false;
    let hasSeparatorIndicator = false;
    
    for (const line of block) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#|') || trimmed.includes('|Column') || trimmed.includes('Column|') || trimmed.includes('Column A|')) {
        hasHeaderIndicator = true;
      }
      if (/^\d+\s*\|/.test(trimmed)) {
        hasNumberIndicator = true;
      }
      if (/^[\s:|#-]+$/.test(trimmed.replace(/\|/g, ''))) {
        hasSeparatorIndicator = true;
      }
    }
    
    if (hasHeaderIndicator || hasNumberIndicator || hasSeparatorIndicator) {
      return true;
    }
    
    // Fallback: if all lines have the same number of pipes (>= 1) and are relatively short, it's likely a table
    const firstPipeCount = block[0].split('|').length - 1;
    if (firstPipeCount >= 1) {
      const allSamePipeCount = block.every(l => (l.split('|').length - 1) === firstPipeCount);
      const allShort = block.every(l => l.length < 150);
      if (allSamePipeCount && allShort) {
        return true;
      }
    }
    
    return false;
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isTableLine(line)) {
      currentTableLines.push(line);
    } else {
      if (currentTableLines.length > 0) {
        if (isRealTable(currentTableLines)) {
          processedLines.push('<table_data>');
          processedLines.push(...currentTableLines);
          processedLines.push('</table_data>');
        } else {
          processedLines.push(...currentTableLines);
        }
        currentTableLines = [];
      }
      processedLines.push(line);
    }
  }
  
  if (currentTableLines.length > 0) {
    if (isRealTable(currentTableLines)) {
      processedLines.push('<table_data>');
      processedLines.push(...currentTableLines);
      processedLines.push('</table_data>');
    } else {
      processedLines.push(...currentTableLines);
    }
  }
  
  return processedLines.join('\n');
};

export const preprocessLaTeX = (text: string): string => {
  if (!text) return text;
  
  // 1. Replace fractions \frac{a}{b} with a/b
  text = text.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2');
  text = text.replace(/\$\\frac\{([^{}]+)\}\{([^{}]+)\}\$/g, '$1/$2');
  
  // 2. Replace subscript expressions _{123} or _1
  text = text.replace(/_\{([0-9]+)\}/g, (match, p1) => makeSubscript(p1));
  text = text.replace(/_([0-9])/g, (match, p1) => makeSubscript(p1));
  
  // 3. Replace superscript expressions ^{123} or ^1
  text = text.replace(/\^\{([0-9]+)\}/g, (match, p1) => makeSuperscript(p1));
  text = text.replace(/\^([0-9])/g, (match, p1) => makeSuperscript(p1));
  
  // 4. Replace LaTeX escaped braces \{ and \}
  text = text.replace(/\\\{/g, '{').replace(/\\\}/g, '}');
  
  // 5. Strip any leftover inline math delimiters $ ... $
  text = text.replace(/\$([^\$\s][^\$]*[^\$\s])\$/g, '$1');
  text = text.replace(/\$([^\$\s])\$/g, '$1');
  
  return text;
};

export const renderFormattedText = (text: string, isDark: boolean, colors: any, defaultTextColor?: string) => {
  if (!text) return null;
  text = ensureTableTags(text);
  text = preprocessLaTeX(text);
  const textColor = defaultTextColor || colors.text;

  // Split by block-level elements
  const blockRegex = /(```[\s\S]*?```|<table_data>[\s\S]*?<\/table_data>|<callout>[\s\S]*?<\/callout>|^#{1,3}\s+[^\n]+)/gm;
  const blocks = text.split(blockRegex);

  const renderInlineText = (inlineText: string, keyPrefix: string) => {
    // Match **bold**, *italic*, and color tags — order matters: ** before *
    const inlineRegex = /(\*\*[^*]+?\*\*|\*[^*\n]+?\*|<blue>[\s\S]*?<\/blue>|<green>[\s\S]*?<\/green>|<red>[\s\S]*?<\/red>|Q\d+:|A\d+:)/g;
    const parts = inlineText.split(inlineRegex);

    return parts.map((part, index) => {
      if (!part) return null;
      const key = `${keyPrefix}-inline-${index}`;

      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return <Text key={key} style={{ fontWeight: 'bold', color: textColor }}>{part.slice(2, -2)}</Text>;
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**')) {
        return <Text key={key} style={{ fontStyle: 'italic', color: textColor }}>{part.slice(1, -1)}</Text>;
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
            {renderInlineText(innerText, `${blockKey}-callout`)}
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
            let cleanRow = row.trim();
            if (cleanRow.startsWith('|')) cleanRow = cleanRow.substring(1);
            if (cleanRow.endsWith('|')) cleanRow = cleanRow.substring(0, cleanRow.length - 1);
            const cols = cleanRow.split('|');
            return (
              <View key={rIndex} style={{ flexDirection: 'row', backgroundColor: rIndex === 0 ? (isDark ? '#27282c' : '#f3f4f6') : (isDark ? '#1e1f22' : '#ffffff'), borderBottomWidth: rIndex < rows.length - 1 ? 1 : 0, borderBottomColor: colors.border || '#e5e7eb' }}>
                {cols.map((col, cIndex) => (
                  <View key={cIndex} style={{ flex: 1, padding: 8, borderRightWidth: cIndex < cols.length - 1 ? 1 : 0, borderRightColor: colors.border || '#e5e7eb' }}>
                    <Text style={{ fontWeight: rIndex === 0 ? 'bold' : 'normal', color: textColor, fontSize: 13 }}>
                      {renderInlineText(col.trim(), `${blockKey}-row-${rIndex}-col-${cIndex}`)}
                    </Text>
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
        <Text key={blockKey} style={{ fontSize, fontWeight: 'bold', color: textColor, marginTop, marginBottom: 8, lineHeight: fontSize * 1.3 }}>
          {renderInlineText(innerText, `${blockKey}-header`)}
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
            <Text key={lIndex} style={{ fontSize: 15, lineHeight: 24, color: textColor, marginVertical: 2 }}>
              {renderInlineText(line, `${blockKey}-line-${lIndex}`)}
            </Text>
          );
        })}
      </View>
    );
  });
};
