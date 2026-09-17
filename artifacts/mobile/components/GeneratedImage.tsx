import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import {
  getPollinationsImageUrl,
  saveImageToGallery,
} from '@/lib/nativeContent';

interface GeneratedImageProps {
  prompt: string;
}

export function GeneratedImage({ prompt }: GeneratedImageProps) {
  const colors = useColors();
  const imageUrl = useMemo(() => getPollinationsImageUrl(prompt), [prompt]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (saving || Platform.OS === 'web') return;
    setSaving(true);
    try {
      await saveImageToGallery(imageUrl);
      setSaved(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the image.';
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  if (failed) {
    return (
      <View style={[styles.fallback, { backgroundColor: colors.surfaceLight }]}>
        <Text style={[styles.fallbackTitle, { color: colors.text }]}>
          Image could not be loaded
        </Text>
        <Text style={[styles.fallbackText, { color: colors.textMuted }]}>
          Check your connection and try the image request again.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.imageFrame}>
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
          onLoadStart={() => setLoading(true)}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
          accessibilityLabel={`Generated image: ${prompt}`}
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Creating image…
            </Text>
          </View>
        )}
      </View>
      {Platform.OS !== 'web' && (
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveButton, { backgroundColor: colors.accent }]}
          activeOpacity={0.75}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.accentForeground} />
          ) : (
            <Text style={[styles.saveText, { color: colors.accentForeground }]}>
              {saved ? 'Saved to Gallery' : 'Save to Gallery'}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
  },
  imageFrame: {
    width: '100%',
    minHeight: 220,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  saveButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  saveText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  fallback: {
    borderRadius: 14,
    padding: 16,
    marginVertical: 4,
  },
  fallbackTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  fallbackText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
  },
});