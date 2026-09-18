const IMAGE_ACTIONS = /\b(draw|paint|illustrate|generate|create|make|render|design)\b/i;
const IMAGE_TERMS =
  /\b(image|picture|photo|illustration|artwork|wallpaper|portrait|landscape|sunset|scene|logo)\b/i;
const PDF_ACTIONS =
  /\b(generate|create|make|write|export|convert|save|bnao|banao|bana|banaye|banado)\b/i;

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

  return trimmed
    .replace(/\b(as|in|into)\s+(a\s+)?pdf\b/i, '')
    .replace(/\bpdf\s+(document|file)\b/i, 'document')
    .trim();
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
    /\b(?:write|say)\s+["“]?(.+?)["”]?\s+(?:inside|in)\s+(?:it|the\s+pdf|the\s+document)\s*$/i,
    /\b(?:with\s+(?:the\s+)?text|containing)\b\s*[:,-]?\s*(.+)$/i,
    /\b(?:write|say)\s+["“]?(.{1,160})["”]?\s*$/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    const content = match?.[1]
      ?.replace(/^[\s"'“”]+|[\s"'“”]+$/g, '')
      .trim();

    if (!content || content.length > 240) continue;
    if (/^(?:a|an|the)\s+(?:report|essay|story|guide|letter|document)\b/i.test(content)) {
      continue;
    }

    return content;
  }

  return null;
}