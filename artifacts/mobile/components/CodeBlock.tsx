import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import {
  getFileInfo,
  type CodeLanguage,
} from '@/lib/codeBlockUtils';
import { writeAndShareCode } from '@/lib/nativeContent';

interface CodeBlockProps {
  code: string;
  language: CodeLanguage;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { extension, mimeType } = getFileInfo(language);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await writeAndShareCode(
        code,
        `vertex-snippet-${Date.now()}.${extension}`,
        mimeType,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the file.';
      Alert.alert('Download failed', message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.codeBackground }]}>
      <View style={[styles.header, { backgroundColor: colors.codeHeader }]}>
        <Text style={[styles.language, { color: colors.codeText }]}>{language}</Text>
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleCopy} style={styles.action} activeOpacity={0.7}>
            <Text style={[styles.actionText, { color: colors.codeText }]}>
              {copied ? 'Copied!' : 'Copy'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDownload}
            style={styles.action}
            activeOpacity={0.7}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={colors.codeText} />
            ) : (
              <Text style={[styles.actionText, { color: colors.codeText }]}>Download</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text selectable style={[styles.code, { color: colors.codeText }]}>
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 6,
  },
  header: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  language: {
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  action: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  code: {
    padding: 14,
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
  },
});