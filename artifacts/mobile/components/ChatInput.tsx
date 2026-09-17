import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from './Icon';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { isVoiceSupported, startListening, cancelListening } from '@/lib/voiceInput';
import { pickDocument, pickImage, takePhoto, showFileError, type ChatAttachment } from '@/lib/fileUpload';

interface ChatInputProps {
  onSend: (text: string, attachment?: ChatAttachment) => void;
  onStop?: () => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, onStop, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const menuAnim = useRef(new Animated.Value(0)).current;
  const menuHeight = useRef(new Animated.Value(0)).current;

  const canSend =
    (!!text.trim() || !!attachment) && !disabled && !transcribing;
  const bottomPadding = Platform.OS === 'web' ? 16 : Math.max(insets.bottom, 12);

  useEffect(() => {
    if (recording) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => { pulseLoop.current?.stop(); };
  }, [recording]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(menuAnim, {
        toValue: menuOpen ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(menuHeight, {
        toValue: menuOpen ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();
  }, [menuOpen]);

  // Stop mic immediately (cancel, no transcript)
  const stopMicNow = useCallback(() => {
    cancelListening();
    setRecording(false);
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  const handleSend = useCallback(() => {
    // If mic is active, stop it before sending
    if (recording) {
      stopMicNow();
    }

    if (!canSend) return;

    const trimmed = text.trim();
    setText('');
    const file = attachment;
    setAttachment(null);
    setMenuOpen(false);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onSend(trimmed, file ?? undefined);
  }, [canSend, text, attachment, onSend, recording, stopMicNow]);

  const handleStop = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onStop?.();
  }, [onStop]);

  const handleMicPress = useCallback(async () => {
    if (transcribing) return;

    if (!isVoiceSupported()) {
      Alert.alert('Not supported', 'Voice input is not available on this device.');
      return;
    }

    if (recording) {
      // Stop and get transcript
      setRecording(false);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      const { stopListening } = await import('@/lib/voiceInput');
      setTranscribing(true);
      try {
        await stopListening((transcript) => {
          setText((prev) => (prev ? prev + ' ' + transcript : transcript));
        });
      } finally {
        setTranscribing(false);
      }
    } else {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      setRecording(true);
      try {
        await startListening((transcript) => {
          setText((prev) => (prev ? prev + ' ' + transcript : transcript));
          setRecording(false);
        });
      } catch {
        setRecording(false);
      }
    }
  }, [recording, transcribing]);

  const handlePlusPress = () => {
    setMenuOpen((prev) => !prev);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleDocumentUpload = async () => {
    try {
      const file = await pickDocument();
      if (file) setAttachment(file);
    } catch (err) {
      showFileError(err);
    }
  };

  const handleImageUpload = async () => {
    try {
      const file = await pickImage();
      if (file) setAttachment(file);
    } catch (err) {
      showFileError(err);
    }
  };

  const handleCameraCapture = async () => {
    setMenuOpen(false);
    try {
      const file = await takePhoto();
      if (file) setAttachment(file);
    } catch (err) {
      showFileError(err);
    }
  };

  const clearAttachment = () => {
    setAttachment(null);
  };

  const menuTranslateY = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return (
    <View
      style={[
        styles.wrapper,
        { paddingBottom: bottomPadding, backgroundColor: colors.background },
      ]}
    >
      {/* Attachment preview */}
      {attachment && (
        <View style={[styles.previewRow, { backgroundColor: colors.surface }]}>
          {attachment.type === 'image' ? (
            <Image source={{ uri: attachment.uri }} style={styles.previewThumb} />
          ) : (
            <View style={[styles.previewIcon, { backgroundColor: colors.accent }]}>
              <Icon name="file-text" size={18} color={colors.brand} />
            </View>
          )}
          <Text style={[styles.previewName, { color: colors.text }]} numberOfLines={1}>
            {attachment.name}
          </Text>
          <TouchableOpacity onPress={clearAttachment} style={styles.clearAttachmentBtn}>
            <Icon name="x" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Upload toggle menu — single scrollable row */}
      <Animated.View
        style={[
          styles.menu,
          {
            height: menuHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 46] }),
            opacity: menuAnim,
            transform: [{ translateY: menuTranslateY }],
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.menuScroll}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={handleDocumentUpload}
            style={[styles.menuBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Icon name="file-text" size={16} color={colors.brand} />
            <Text style={[styles.menuBtnText, { color: colors.text }]}>Document</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleImageUpload}
            style={[styles.menuBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Icon name="image" size={16} color={colors.brand} />
            <Text style={[styles.menuBtnText, { color: colors.text }]}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCameraCapture}
            style={[styles.menuBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Icon name="camera" size={16} color={colors.brand} />
            <Text style={[styles.menuBtnText, { color: colors.text }]}>Camera</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Input pill */}
      <View
        style={[
          styles.inputPill,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor: '#000',
          },
        ]}
      >
        {/* Plus toggle on the left side */}
        <TouchableOpacity
          onPress={handlePlusPress}
          style={styles.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Animated.View style={{ transform: [{ rotate: menuOpen ? '45deg' : '0deg' }] }}>
            <Icon name="plus" size={22} color={colors.textMuted} />
          </Animated.View>
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.text }]}
           placeholder={
             recording
               ? 'Listening...'
               : transcribing
                 ? 'Transcribing...'
                 : 'Ask anything...'
           }
          placeholderTextColor={recording ? '#ef4444' : colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={4000}
          onSubmitEditing={Platform.OS === 'web' ? handleSend : undefined}
          blurOnSubmit={Platform.OS === 'web'}
          returnKeyType={Platform.OS === 'web' ? 'send' : 'default'}
           editable={!recording && !transcribing}
        />

        {/* Mic button — hidden while AI is generating */}
         {!disabled && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              onPress={handleMicPress}
               disabled={transcribing}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
             >
               {transcribing ? (
                 <ActivityIndicator size="small" color={colors.brand} />
               ) : (
                 <Icon
                   name={recording ? 'stop-circle' : 'mic-outline'}
                   size={22}
                   color={recording ? '#ef4444' : colors.textMuted}
                 />
               )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Send / Stop button */}
        {disabled ? (
          /* Stop button — shown while AI is generating */
          <TouchableOpacity
            onPress={handleStop}
            style={[styles.sendBtn, { backgroundColor: colors.brand }]}
            activeOpacity={0.8}
          >
            <Icon name="square" size={14} color="#fff" />
          </TouchableOpacity>
        ) : (
          /* Normal send button */
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            style={[
              styles.sendBtn,
              { backgroundColor: canSend ? colors.brand : colors.surfaceHover },
            ]}
            activeOpacity={0.8}
          >
            <Icon name="arrow-up" size={17} color={canSend ? '#fff' : colors.textSubtle} />
          </TouchableOpacity>
        )}
      </View>

      {/* Disclaimer */}
      <Text style={[styles.disclaimer, { color: colors.textSubtle }]}>
        Vertex AI can make mistakes. Verify important information.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 8,
    gap: 10,
  },
  previewThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#000',
  },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  clearAttachmentBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    overflow: 'hidden',
  },
  menuScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  menuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  menuBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 28,
    borderWidth: 1,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    maxHeight: 120,
    paddingTop: Platform.OS === 'android' ? 6 : 8,
    paddingBottom: Platform.OS === 'android' ? 6 : 8,
    paddingHorizontal: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  disclaimer: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
