import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export function getPollinationsImageUrl(prompt: string): string {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true`;
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
  title: string,
  content: string,
): Promise<void> {
  const html = buildPdfHtml(title, content);

  if (Platform.OS === 'web') {
    downloadHtmlForWeb(title, html);
    return;
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Native file sharing is unavailable on this device.');
  }

  const result = await Print.printToFileAsync({
    html,
  });

  await Sharing.shareAsync(result.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Save or share your PDF',
  });
}

function buildPdfHtml(title: string, content: string): string {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page { margin: 32px; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            padding: 32px;
            color: #1f2937;
          }
          h1 { font-size: 24px; margin: 0 0 20px; }
          p { font-size: 15px; line-height: 1.6; white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(content)}</p>
      </body>
    </html>
  `;
}

function downloadHtmlForWeb(title: string, html: string): void {
  if (typeof document === 'undefined') return;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${toSafeFilename(title)}.html`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toSafeFilename(value: string): string {
  const filename = value
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 64);

  return filename || 'vertex-ai-document';
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