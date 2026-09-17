export type CodeLanguage =
  | 'Python'
  | 'JavaScript'
  | 'HTML'
  | 'CSS'
  | 'JSON'
  | 'C++'
  | 'TypeScript'
  | 'Plaintext';

export interface MessageSegment {
  type: 'text' | 'code';
  content: string;
  language?: CodeLanguage;
}

const LANGUAGE_ALIASES: Record<string, CodeLanguage> = {
  py: 'Python',
  python: 'Python',
  js: 'JavaScript',
  javascript: 'JavaScript',
  jsx: 'JavaScript',
  html: 'HTML',
  xml: 'HTML',
  css: 'CSS',
  json: 'JSON',
  cpp: 'C++',
  'c++': 'C++',
  cxx: 'C++',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TypeScript',
  text: 'Plaintext',
  plaintext: 'Plaintext',
  txt: 'Plaintext',
};

export function parseMessageSegments(
  text: string,
  forceMultilineCode = false,
): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const fencedPattern = /```([^\n`]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fencedPattern.exec(text)) !== null) {
    const before = text.slice(cursor, match.index);
    if (before) {
      segments.push({ type: 'text', content: before });
    }

    segments.push({
      type: 'code',
      content: match[2].trimEnd(),
      language: detectLanguage(match[2], match[1]),
    });
    cursor = match.index + match[0].length;
  }

  const remainder = text.slice(cursor);
  if (remainder) {
    if (
      remainder.includes('\n') &&
      (forceMultilineCode || looksLikeCode(remainder))
    ) {
      segments.push({
        type: 'code',
        content: remainder.trim(),
        language: detectLanguage(remainder),
      });
    } else {
      segments.push({ type: 'text', content: remainder });
    }
  }

  return segments.length > 0
    ? segments
    : [{ type: 'text', content: text }];
}

export function detectLanguage(
  code: string,
  hint?: string,
): CodeLanguage {
  const normalizedHint = hint?.trim().toLowerCase();
  if (normalizedHint && LANGUAGE_ALIASES[normalizedHint]) {
    return LANGUAGE_ALIASES[normalizedHint];
  }

  const trimmed = code.trim();
  try {
    JSON.parse(trimmed);
    return 'JSON';
  } catch {
    // Continue with syntax-based detection.
  }

  if (/<(!doctype|html|head|body|div|section|component)\b/i.test(trimmed)) {
    return 'HTML';
  }
  if (/(^|\n)\s*[.#][\w-]+\s*\{|@media\b|@import\b/.test(trimmed)) {
    return 'CSS';
  }
  if (
    /\b(interface|type)\s+\w+/.test(trimmed) ||
    /:\s*(string|number|boolean|unknown|any)\b/.test(trimmed)
  ) {
    return 'TypeScript';
  }
  if (/#include\s*<|std::|cout\s*<<|cin\s*>>/.test(trimmed)) {
    return 'C++';
  }
  if (/(^|\n)\s*(def |class |from |import |print\()/.test(trimmed)) {
    return 'Python';
  }
  if (
    /\b(const|let|var|function|async|await|console\.log)\b/.test(trimmed) ||
    /=>/.test(trimmed)
  ) {
    return 'JavaScript';
  }
  return 'Plaintext';
}

export function getFileInfo(language: CodeLanguage): {
  extension: string;
  mimeType: string;
} {
  switch (language) {
    case 'Python':
      return { extension: 'py', mimeType: 'text/x-python' };
    case 'JavaScript':
      return { extension: 'js', mimeType: 'text/javascript' };
    case 'TypeScript':
      return { extension: 'ts', mimeType: 'text/typescript' };
    case 'HTML':
      return { extension: 'html', mimeType: 'text/html' };
    case 'CSS':
      return { extension: 'css', mimeType: 'text/css' };
    case 'JSON':
      return { extension: 'json', mimeType: 'application/json' };
    case 'C++':
      return { extension: 'cpp', mimeType: 'text/x-c++src' };
    default:
      return { extension: 'txt', mimeType: 'text/plain' };
  }
}

function looksLikeCode(value: string): boolean {
  return (
    /[{};]/.test(value) ||
    /(^|\n)\s*(import|export|const|let|def|class|function|SELECT|<!DOCTYPE)\b/.test(
      value,
    ) ||
    /=>|<\/?[a-z][^>]*>/i.test(value)
  );
}