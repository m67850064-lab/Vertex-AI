import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { parseMessageSegments } from '@/lib/codeBlockUtils';
import { CodeBlock } from './CodeBlock';
import { LinkifiedText } from './LinkifiedText';

interface MessageContentProps {
  text: string;
  forceMultilineCode?: boolean;
  textColor?: string;
}

export function MessageContent({
  text,
  forceMultilineCode = false,
  textColor,
}: MessageContentProps) {
  const colors = useColors();
  const segments = parseMessageSegments(text, forceMultilineCode);

  return (
    <View style={styles.container}>
      {segments.map((segment, index) =>
        segment.type === 'code' ? (
          <CodeBlock
            key={`code-${index}`}
            code={segment.content}
            language={segment.language ?? 'Plaintext'}
          />
        ) : (
          <LinkifiedText
            key={`text-${index}`}
            text={segment.content}
            textStyle={[styles.text, { color: textColor ?? colors.text }]}
          >
          </LinkifiedText>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  text: {
    fontSize: 15,
    lineHeight: 24,
    fontFamily: 'Inter_400Regular',
  },
});