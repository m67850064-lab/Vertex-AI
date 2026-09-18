import React from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;

interface TextSegment {
  type: 'text' | 'url';
  value: string;
}

function removeTrailingPunctuation(value: string): {
  url: string;
  trailing: string;
} {
  let url = value;
  let trailing = '';

  while (/[.,!?;:]$/.test(url)) {
    trailing = url.slice(-1) + trailing;
    url = url.slice(0, -1);
  }

  const pairedDelimiters: Array<[string, string]> = [
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
  ];

  for (const [opening, closing] of pairedDelimiters) {
    while (
      url.endsWith(closing) &&
      (url.match(new RegExp(`\\${closing}`, 'g')) ?? []).length >
        (url.match(new RegExp(`\\${opening}`, 'g')) ?? []).length
    ) {
      trailing = closing + trailing;
      url = url.slice(0, -1);
    }
  }

  return { url, trailing };
}

export function splitTextWithLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const matchedUrl = match[0];
    const start = match.index ?? 0;

    if (start > cursor) {
      segments.push({ type: 'text', value: text.slice(cursor, start) });
    }

    const { url, trailing } = removeTrailingPunctuation(matchedUrl);
    if (url) {
      segments.push({ type: 'url', value: url });
    } else {
      segments.push({ type: 'text', value: matchedUrl });
    }

    if (trailing) {
      segments.push({ type: 'text', value: trailing });
    }
    cursor = start + matchedUrl.length;
  }

  if (cursor < text.length) {
    segments.push({ type: 'text', value: text.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}

async function openUrlSafely(url: string): Promise<void> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) return;
    await Linking.openURL(url);
  } catch {
    // Unsupported or blocked URLs must never crash the chat screen.
  }
}

interface LinkifiedTextProps {
  text: string;
  textStyle?: StyleProp<TextStyle>;
}

export function LinkifiedText({ text, textStyle }: LinkifiedTextProps) {
  const colors = useColors();
  const segments = splitTextWithLinks(text);

  return (
    <Text style={textStyle}>
      {segments.map((segment, index) =>
        segment.type === 'url' ? (
          <Text
            key={`url-${index}`}
            accessibilityRole="link"
            accessibilityHint="Opens this link"
            onPress={() => {
              void openUrlSafely(segment.value);
            }}
            style={[styles.link, { color: colors.brand }]}
          >
            {segment.value}
          </Text>
        ) : (
          <React.Fragment key={`text-${index}`}>{segment.value}</React.Fragment>
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    textDecorationLine: 'underline',
  },
});