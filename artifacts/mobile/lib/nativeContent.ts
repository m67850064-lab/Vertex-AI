import { Alert, Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { PdfImagePlacement } from './contentRequests';

export function getPollinationsImageUrl(prompt: string): string {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true`;
}

export interface GeneratedPdfFile {
  uri: string;
  fileName: string;
  isWeb: boolean;
}

export interface PdfImageAsset {
  uri: string;
  mimeType?: string;
  placement?: PdfImagePlacement;
  alt?: string;
}

export async function saveImageToGallery(imageUrl: string): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Gallery saving is available on Android and iOS only.');
  }

  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission was not granted.');
  }

  const directory = FileSystem.documentDirectory;
  if (!directory) throw new Error('Local document storage is unavailable.');

  const localUri = `${directory}vertex-generated-${Date.now()}.jpg`;
  const downloaded = await FileSystem.downloadAsync(imageUrl, localUri);
  await MediaLibrary.saveToLibraryAsync(downloaded.uri);
}

export async function generateAndSharePdf(
  title: string | undefined,
  content: string,
  imageAssets: PdfImageAsset[] = [],
): Promise<GeneratedPdfFile> {
  const cleanContent = getSafePdfContent(content);
  const fileName = `${toSafeFilename(title || 'document')}.pdf`;
  const embeddedImages = await preparePdfImages(imageAssets);
  const html = buildPdfHtml(title, cleanContent, embeddedImages);

  if (Platform.OS === 'web') {
    const file = createWebPdfFile(title, html);
    downloadPdfFile(file);
    return file;
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Native file sharing is unavailable on this device.');
  }

  const result = await Print.printToFileAsync({
    html,
  });

  const file: GeneratedPdfFile = {
    uri: result.uri,
    fileName,
    isWeb: false,
  };
  await sharePdfFile(file);
  return file;
}

export async function downloadPdfFile(file: GeneratedPdfFile): Promise<void> {
  if (file.isWeb) {
    if (typeof document === 'undefined') return;

    const anchor = document.createElement('a');
    anchor.href = file.uri;
    anchor.download = file.fileName.replace(/\.pdf$/i, '.html');
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }

  await sharePdfFile(file);
}

export async function openPdfFile(file: GeneratedPdfFile): Promise<void> {
  if (file.isWeb) {
    if (typeof window === 'undefined') return;

    const opened = window.open(file.uri, '_blank', 'noopener,noreferrer');
    if (!opened) {
      await downloadPdfFile(file);
    }
    return;
  }

  try {
    const canOpen = await Linking.canOpenURL(file.uri);
    if (canOpen) {
      await Linking.openURL(file.uri);
      return;
    }
  } catch {
    // Fall back to the native share/save sheet below.
  }

  await sharePdfFile(file);
}

async function sharePdfFile(file: GeneratedPdfFile): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Native file sharing is unavailable on this device.');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Save or share your PDF',
  });
}

interface PreparedPdfImage {
  src: string;
  placement: PdfImagePlacement;
  alt: string;
}

function buildPdfHtml(
  title: string | undefined,
  content: string,
  images: PreparedPdfImage[],
): string {
  const headerImages = images
    .filter((image) => image.placement === 'header')
    .map((image) => renderImage(image, 'header-image'))
    .join('');
  const bodyImages = images
    .filter((image) => image.placement === 'body')
    .map((image) => renderImage(image, 'body-image'))
    .join('');
  const watermarks = images
    .filter((image) => image.placement === 'watermark')
    .map((image) => renderImage(image, 'watermark-image'))
    .join('');
  const titleHtml = title
    ? `<h1 class="document-title">${escapeHtml(title)}</h1>`
    : '';

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title || 'Document')}</title>
        <style>
          @page { size: auto; margin: 20mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            margin: 0;
            padding: 0;
            color: #1f2937;
            font-size: 15px;
            line-height: 1.6;
          }
          .document { position: relative; }
          .document-header,
          .document-title,
          .document-block,
          .document-table,
          .document-list,
          img {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .document-header { margin-bottom: 20px; }
          .document-title { font-size: 26px; line-height: 1.2; margin: 0 0 20px; }
          .document-block { margin: 0 0 14px; white-space: pre-wrap; }
          .document-block:last-child { margin-bottom: 0; }
          h2, h3 { page-break-after: avoid; break-after: avoid; }
          h2 { font-size: 21px; margin: 22px 0 10px; }
          h3 { font-size: 17px; margin: 18px 0 8px; }
          ul, ol { margin: 0 0 14px; padding-left: 24px; }
          li { margin: 3px 0; }
          blockquote {
            border-left: 3px solid #cbd5e1;
            margin: 0 0 14px;
            padding-left: 14px;
            color: #475569;
          }
          .table-wrap { overflow-x: auto; margin: 0 0 16px; }
          .document-table { border-collapse: collapse; width: 100%; }
          .document-table th,
          .document-table td {
            border: 1px solid #cbd5e1;
            padding: 7px 9px;
            text-align: left;
            vertical-align: top;
          }
          .document-table th { background: #f1f5f9; font-weight: 600; }
          .header-image,
          .body-image {
            display: block;
            max-width: 100%;
            height: auto;
            margin: 0 0 18px;
          }
          .header-image { max-height: 180px; object-fit: contain; }
          .body-image { margin-left: auto; margin-right: auto; }
          .watermark-image {
            position: fixed;
            z-index: -1;
            inset: 25% 15%;
            width: 70%;
            max-height: 50%;
            object-fit: contain;
            opacity: 0.12;
          }
          @media print {
            .table-wrap { overflow: visible; }
            a { color: inherit; text-decoration: none; }
          }
        </style>
      </head>
      <body>
        <main class="document">
          ${watermarks}
          ${headerImages ? `<header class="document-header">${headerImages}</header>` : ''}
          ${titleHtml}
          ${bodyImages}
          ${markdownToHtml(content)}
        </main>
      </body>
    </html>
  `;
}

function renderImage(image: PreparedPdfImage, className: string): string {
  return `<img class="${className}" src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" />`;
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let index = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(
      `<p class="document-block">${renderInlineMarkdown(paragraph.join('\n'))}</p>`,
    );
    paragraph = [];
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      blocks.push(`<h${level + 1}>${renderInlineMarkdown(heading[2])}</h${level + 1}>`);
      index += 1;
      continue;
    }

    if (isTableSeparator(lines[index + 1])) {
      flushParagraph();
      const headerCells = splitTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push(
        `<div class="table-wrap"><table class="document-table"><thead><tr>${headerCells
          .map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`)
          .join('')}</tr></thead><tbody>${rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`)
                .join('')}</tr>`,
          )
          .join('')}</tbody></table></div>`,
      );
      continue;
    }

    const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const listTag = ordered ? 'ol' : 'ul';
      const items: string[] = [];
      while (index < lines.length) {
        const itemMatch = lines[index]
          .trim()
          .match(ordered ? /^\d+[.)]\s+(.+)$/ : /^[-*+]\s+(.+)$/);
        if (!itemMatch) break;
        items.push(`<li>${renderInlineMarkdown(itemMatch[1])}</li>`);
        index += 1;
      }
      blocks.push(`<${listTag} class="document-list">${items.join('')}</${listTag}>`);
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushParagraph();
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(`<blockquote>${renderInlineMarkdown(quoteLines.join('\n'))}</blockquote>`);
      continue;
    }

    paragraph.push(line);
    index += 1;
  }

  flushParagraph();
  return blocks.join('\n');
}

function renderInlineMarkdown(value: string): string {
  let html = escapeHtml(value);
  html = html.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi,
    (_match, alt: string, uri: string) =>
      `<img class="body-image" src="${escapeHtml(uri)}" alt="${escapeHtml(alt)}" />`,
  );
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^\*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  return html;
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string | undefined): boolean {
  return !!line && /^\s*\|?[\s:-]+(?:\|[\s:-]+)+\|?\s*$/.test(line);
}

async function preparePdfImages(assets: PdfImageAsset[]): Promise<PreparedPdfImage[]> {
  return Promise.all(
    assets.map(async (asset) => ({
      src: await embedImage(asset),
      placement: asset.placement ?? 'body',
      alt: asset.alt || 'Document image',
    })),
  );
}

async function embedImage(asset: PdfImageAsset): Promise<string> {
  if (asset.uri.startsWith('data:')) return asset.uri;

  if (Platform.OS === 'web') {
    try {
      const response = await fetch(asset.uri);
      if (response.ok) {
        const blob = await response.blob();
        return await blobToDataUri(blob);
      }
    } catch {
      // The original URI is still a valid HTML image fallback.
    }
    return asset.uri;
  }

  try {
    const mimeType = asset.mimeType || guessImageMimeType(asset.uri);
    const localUri =
      asset.uri.startsWith('file://') || asset.uri.startsWith('content://')
        ? asset.uri
        : `${FileSystem.cacheDirectory || FileSystem.documentDirectory}pdf-image-${Date.now()}.img`;
    const downloadedUri =
      localUri === asset.uri
        ? localUri
        : (await FileSystem.downloadAsync(asset.uri, localUri)).uri;
    const base64 = await FileSystem.readAsStringAsync(downloadedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return asset.uri;
  }
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function guessImageMimeType(uri: string): string {
  if (/\.png(?:[?#]|$)/i.test(uri)) return 'image/png';
  if (/\.webp(?:[?#]|$)/i.test(uri)) return 'image/webp';
  if (/\.gif(?:[?#]|$)/i.test(uri)) return 'image/gif';
  if (/\.svg(?:[?#]|$)/i.test(uri)) return 'image/svg+xml';
  return 'image/jpeg';
}

function createWebPdfFile(title: string, html: string): GeneratedPdfFile {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  return {
    uri: url,
    fileName: `${toSafeFilename(title)}.pdf`,
    isWeb: true,
  };
}

function toSafeFilename(value: string): string {
  const filename = value
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 64);

  return filename || 'vertex-ai-document';
}

function getSafePdfContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed || isPdfErrorMessage(trimmed)) {
    throw new Error('The PDF content was unavailable, so no file was created.');
  }
  return trimmed;
}

function isPdfErrorMessage(content: string): boolean {
  return /^(?:maaf|sorry|unable|could not|cannot|i can(?:not|'t))[\s\S]*\b(?:pdf|document|file)\b/i.test(
    content,
  );
}

export async function writeAndShareCode(
  code: string,
  filename: string,
  mimeType: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Native file downloads are available on Android and iOS only.');
  }

  const directory = FileSystem.documentDirectory;
  if (!directory) throw new Error('Local document storage is unavailable.');

  const fileUri = `${directory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, code, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Native file sharing is unavailable on this device.');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType,
    dialogTitle: `Save ${filename}`,
  });
}

export function showNativeError(message: string): void {
  Alert.alert('Action unavailable', message);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}