const IMAGE_ACTIONS = /\b(draw|paint|illustrate|generate|create|make|render|design)\b/i;
const IMAGE_TERMS =
  /\b(image|picture|photo|illustration|artwork|wallpaper|portrait|landscape|sunset|scene|logo)\b/i;
const PDF_ACTIONS =
  /\b(generate|create|make|write|export|convert|save|bnao|banao|bana|banaye|banado)\b/i;

export type PdfImagePlacement = 'header' | 'body' | 'watermark';

export interface PdfImageRequest {
  uri: string;
  placement: PdfImagePlacement;
  alt: string;
}

export function getImageGenerationPrompt(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || !IMAGE_ACTIONS.test(trimmed)) return null;

  const isImageRequest =
    /\b(draw|paint|illustrate)\b/i.test(trimmed) ||
    IMAGE_TERMS.test(trimmed);
  if (!isImageRequest || /\b(pdf|document|code|script|component)\b/i.test(trimmed)) {
    return null;
  }

  const prompt = trimmed
    .replace(
      /^(please\s+)?(draw|paint|illustrate|generate|create|make|render|design)\s+/i,
      '',
    )
    .replace(/^(an?\s+)?(image|picture|photo|illustration|artwork)\s+(of\s+)?/i, '')
    .replace(/^an?\s+image\s+of\s+/i, '')
    .trim();

  return prompt || trimmed;
}

export function getPdfGenerationPrompt(input: string): string | null {
  const trimmed = input.trim();
  if (
    !trimmed ||
    !PDF_ACTIONS.test(trimmed) ||
    !/\bpdf\b/i.test(trimmed)
  ) {
    return null;
  }

  return trimmed;
}

/**
 * Extracts literal text for simple PDF requests so they do not make an
 * unnecessary model round trip. Complex requests still use the AI route.
 */
export function getInstantPdfContent(input: string): string | null {
  const trimmed = input.trim();
  if (!getPdfGenerationPrompt(trimmed)) return null;

  const patterns = [
    /\b(?:andar|inside)\b[\s\S]*?\b(?:likha(?:\s+hua)?\s+(?:hona\s+chahiye|ho)|should\s+(?:say|contain|include))\b\s*[:,-]?\s*(.+)$/i,
    /\b(?:it\s+)?should\s+(?:say|contain|include)\b\s*[:,-]?\s*(.+)$/i,
    /\b(?:write|say)\s+["“]?([\s\S]+?)["”]?\s+(?:inside|in)\s+(?:it|the\s+pdf|the\s+document)\s*$/i,
    /\b(?:with\s+(?:the\s+)?text|containing)\b\s*[:,-]?\s*(.+)$/i,
    /\b(?:write|say)\s+["“]?([\s\S]+?)["”]?\s*$/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    const content = match?.[1]
      ?.replace(/^[\s"'“”]+|[\s"'“”]+$/g, '')
      .trim();

    if (!content) continue;
    if (/^(?:a|an|the)\s+(?:report|essay|story|guide|letter|document)\b/i.test(content)) {
      continue;
    }

    return content;
  }

  return null;
}

export function getPdfRequestedTitle(input: string): string | null {
  const match = input.match(
    /\b(?:title|heading|document\s+title)\s*[:=-]\s*["“]?([^\n"”]+)["”]?/i,
  );
  const title = match?.[1]?.trim();
  return title || null;
}

export function getPdfImageRequests(input: string): PdfImageRequest[] {
  const imageUrlPattern = /https?:\/\/[^\s<>"'`]+/gi;
  const requests: PdfImageRequest[] = [];
  const hasImageInstruction =
    /\b(image|photo|picture|logo|watermark|header|banner)\b/i.test(input);

  for (const match of input.matchAll(imageUrlPattern)) {
    const rawUrl = match[0];
    const uri = rawUrl.replace(/[),.!?:;]+$/g, '');
    const surroundingText = input.slice(
      Math.max(0, (match.index ?? 0) - 120),
      Math.min(input.length, (match.index ?? 0) + rawUrl.length + 120),
    );
    const looksLikeImage =
      /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(uri);

    if (!hasImageInstruction && !looksLikeImage) continue;

    const placement: PdfImageRequest['placement'] =
      /\b(?:watermark|background)\b/i.test(surroundingText)
        ? 'watermark'
        : /\b(?:header|top|logo|banner)\b/i.test(surroundingText)
          ? 'header'
          : 'body';

    requests.push({
      uri,
      placement,
      alt: placement === 'header' ? 'Document header image' : 'Document image',
    });
  }

  return requests;
}