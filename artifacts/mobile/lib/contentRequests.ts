const IMAGE_ACTIONS = /\b(draw|paint|illustrate|generate|create|make|render|design)\b/i;
const IMAGE_TERMS =
  /\b(image|picture|photo|illustration|artwork|wallpaper|portrait|landscape|sunset|scene|logo)\b/i;
const PDF_ACTIONS = /\b(generate|create|make|write|export|convert|save)\b/i;

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