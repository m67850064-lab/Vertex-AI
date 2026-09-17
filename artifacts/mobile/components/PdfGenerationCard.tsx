import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface PdfGenerationCardProps {
  status: 'generating' | 'ready' | 'error';
  error?: string;
}

export function PdfGenerationCard({ status, error }: PdfGenerationCardProps) {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceLight }]}>
      {status === 'generating' ? (
        <>
          <ActivityIndicator color={colors.brand} />
          <Text style={[styles.title, { color: colors.text }]}>Creating PDF…</Text>
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            The native share sheet will open when it is ready.
          </Text>
        </>
      ) : status === 'ready' ? (
        <>
          <Text style={[styles.title, { color: colors.text }]}>PDF ready</Text>
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            The PDF was created and shared from your device.
          </Text>
        </>
      ) : (
        <>
          <Text style={[styles.title, { color: colors.destructive }]}>
            PDF creation failed
          </Text>
          <Text style={[styles.detail, { color: colors.textMuted }]}>
            {error || 'Please try again.'}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    gap: 6,
    marginVertical: 4,
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
});