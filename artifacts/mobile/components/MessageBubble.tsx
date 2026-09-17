import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Icon } from './Icon';
import { useColors } from '@/hooks/useColors';
import { GeminiStar } from './GeminiStar';
import type { ChatMessage } from '@/context/ConversationContext';
import { MessageContent } from './MessageContent';
import { GeneratedImage } from './GeneratedImage';
import { PdfGenerationCard } from './PdfGenerationCard';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const colors = useColors();
  const isUser = message.role === 'user';
  const isTyping =
    message.role === 'model' &&
    message.text === '' &&
    !message.imagePrompt &&
    !message.pdfPrompt;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  if (isUser) {
    return (
      <Animated.View
        style={[
          styles.userRow,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.userBubbleGroup}>
          <View style={[styles.userBubble, { backgroundColor: colors.userBubble }]}>
            {message.attachment && (
              <View style={styles.userAttachment}>
                {message.attachment.type === 'image' ? (
                  <Image source={{ uri: message.attachment.uri }} style={styles.userAttachmentImage} />
                ) : (
                  <View style={[styles.userAttachmentDoc, { backgroundColor: colors.accent }]}>
                    <Icon name="file-text" size={16} color={colors.brand} />
                    <Text style={[styles.userAttachmentDocText, { color: colors.text }]} numberOfLines={1}>
                      {message.attachment.name}
                    </Text>
                  </View>
                )}
              </View>
            )}
            {!!message.text &&
              (message.text.includes('\n') ? (
                <MessageContent
                  text={message.text}
                  forceMultilineCode
                  textColor={colors.userBubbleText}
                />
              ) : (
                <Text style={[styles.userText, { color: colors.userBubbleText }]}>
                  {message.text}
                </Text>
              ))}
          </View>
          {/* Copy button below user bubble */}
          {!!message.text && <UserCopyButton text={message.text} />}
        </View>
      </Animated.View>
    );
  }

  // Model response
  return (
    <Animated.View
      style={[
        styles.modelRow,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.avatar}>
        <GeminiStar size={20} />
      </View>
      <View style={styles.modelContent}>
        {message.imagePrompt ? (
          <GeneratedImage prompt={message.imagePrompt} />
        ) : message.pdfPrompt ? (
          <>
            <PdfGenerationCard
              status={message.pdfStatus ?? 'generating'}
              error={message.pdfError}
            />
            {!!message.text && <MessageContent text={message.text} />}
            {!!message.text && <ResponseActions text={message.text} />}
          </>
        ) : isTyping ? (
          <TypingDots />
        ) : (
          <>
            <MessageContent text={message.text} />
            <ResponseActions text={message.text} />
          </>
        )}
      </View>
    </Animated.View>
  );
}

// ── User copy button ─────────────────────────────────────────────────────────

function UserCopyButton({ text }: { text: string }) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(text);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TouchableOpacity
      onPress={handleCopy}
      style={styles.userCopyBtn}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      activeOpacity={0.65}
    >
      <Icon
        name={copied ? 'check' : 'copy'}
        size={13}
        color={copied ? colors.brand : colors.textSubtle}
      />
      {copied && (
        <Text style={[styles.copiedLabel, { color: colors.brand }]}>Copied!</Text>
      )}
    </TouchableOpacity>
  );
}

// ── AI response action buttons ───────────────────────────────────────────────

function ResponseActions({ text }: { text: string }) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<'like' | 'dislike' | null>(null);

  const haptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(text);
    haptic();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLike = () => {
    haptic();
    setLiked((prev) => (prev === 'like' ? null : 'like'));
  };

  const handleDislike = () => {
    haptic();
    setLiked((prev) => (prev === 'dislike' ? null : 'dislike'));
  };

  return (
    <View style={styles.actionsRow}>
      {/* Copy */}
      <TouchableOpacity
        onPress={handleCopy}
        style={styles.actionBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.65}
      >
        <Icon
          name={copied ? 'check' : 'copy'}
          size={15}
          color={copied ? colors.brand : colors.textSubtle}
        />
        {copied && (
          <Text style={[styles.copiedLabel, { color: colors.brand }]}>Copied!</Text>
        )}
      </TouchableOpacity>

      {/* Like */}
      <TouchableOpacity
        onPress={handleLike}
        style={styles.actionBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.65}
      >
        <Icon
          name="thumbs-up"
          size={15}
          color={liked === 'like' ? colors.brand : colors.textSubtle}
        />
      </TouchableOpacity>

      {/* Dislike */}
      <TouchableOpacity
        onPress={handleDislike}
        style={styles.actionBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.65}
      >
        <Icon
          name="thumbs-down"
          size={15}
          color={liked === 'dislike' ? '#ef4444' : colors.textSubtle}
        />
      </TouchableOpacity>
    </View>
  );
}

// ── Typing dots ──────────────────────────────────────────────────────────────

function TypingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 350, useNativeDriver: true }),
          Animated.delay(Math.max(0, 700 - delay)),
        ])
      );

    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 200);
    const a3 = pulse(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={styles.dotsRow}>
      {([dot1, dot2, dot3] as Animated.Value[]).map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { opacity: dot, backgroundColor: '#8b5cf6' }]}
        />
      ))}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // User
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginHorizontal: 16,
    marginVertical: 4,
  },
  userBubbleGroup: {
    alignItems: 'flex-end',
    maxWidth: '80%',
    gap: 4,
  },
  userBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    borderBottomRightRadius: 6,
  },
  userText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  userAttachment: {
    marginBottom: 8,
  },
  userAttachmentImage: {
    width: 180,
    height: 180,
    borderRadius: 14,
    backgroundColor: '#000',
  },
  userAttachmentDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 240,
  },
  userAttachmentDocText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  userCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-end',
  },

  // Model
  modelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginVertical: 8,
    gap: 12,
  },
  avatar: {
    marginTop: 2,
    flexShrink: 0,
  },
  modelContent: {
    flex: 1,
    paddingRight: 8,
  },
  modelText: {
    fontSize: 15,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },

  // Action buttons (AI)
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  copiedLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },

  // Typing
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
