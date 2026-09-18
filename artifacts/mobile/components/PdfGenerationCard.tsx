import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Icon } from './Icon';
import type { GeneratedPdfFile } from '@/lib/nativeContent';

interface PdfGenerationCardProps {
  status: 'generating' | 'ready' | 'error';
  error?: string;
  file?: GeneratedPdfFile;
  onDownload?: () => Promise<void>;
  onOpen?: () => Promise<void>;
}

export function PdfGenerationCard({
  status,
  error,
  file,
  onDownload,
  onOpen,
}: PdfGenerationCardProps) {
  const colors = useColors();
  const isWeb = Platform.OS === 'web';
  const [action, setAction] = useState<'download' | 'open' | null>(null);
  const isReady = status === 'ready' && !!file;

  const runAction = async (
    name: 'download' | 'open',
    handler?: () => Promise<void>,
  ) => {
    if (!handler || action) return;
    setAction(name);
    try {
      await handler();
    } catch (actionError) {
      Alert.alert(
        name === 'download' ? 'Download failed' : 'Could not open PDF',
        actionError instanceof Error ? actionError.message : 'Please try again.',
      );
    } finally {
      setAction(null);
    }
  };

  if (status === 'generating') {
    return (
      <View style={[styles.card, { backgroundColor: colors.surfaceLight }]}>
        <ActivityIndicator color={colors.brand} />
        <Text style={[styles.title, { color: colors.text }]}>Creating PDF...</Text>
        <Text style={[styles.detail, { color: colors.textMuted }]}>
          {isWeb
            ? 'A browser HTML download will start when it is ready.'
            : 'The native share sheet will open when it is ready.'}
        </Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.card, { backgroundColor: colors.surfaceLight }]}>
        <Text style={[styles.title, { color: colors.destructive }]}>
          PDF creation failed
        </Text>
        <Text style={[styles.detail, { color: colors.textMuted }]}>
          {error || 'Please try again.'}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      disabled={!isReady || !!action}
      onPress={() => {
        void runAction('open', onOpen);
      }}
      accessibilityRole="button"
      accessibilityLabel="Open generated PDF"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surfaceLight },
        pressed && isReady && styles.pressed,
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          {isWeb ? 'PDF Ready' : 'PDF Ready'}
        </Text>
        <Text style={[styles.detail, { color: colors.textMuted }]}>
          {isWeb
            ? 'Tap to open. Use Print → Save as PDF in your browser.'
            : 'Tap to open in your device viewer.'}
        </Text>
      </View>
      <Pressable
        disabled={!isReady || !!action}
        onPress={(event) => {
          event.stopPropagation();
          void runAction('download', onDownload);
        }}
        accessibilityRole="button"
        accessibilityLabel="Download PDF"
        hitSlop={8}
        style={({ pressed }) => [
          styles.downloadButton,
          { backgroundColor: colors.accent },
          pressed && styles.pressed,
        ]}
      >
        {action === 'download' ? (
          <ActivityIndicator size="small" color={colors.accentForeground} />
        ) : (
          <Icon name="download" size={19} color={colors.accentForeground} />
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginVertical: 4,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  detail: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  downloadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  pressed: {
    opacity: 0.72,
  },
});