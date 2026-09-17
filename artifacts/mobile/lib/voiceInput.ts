import { Platform } from 'react-native';
import { getApiBaseUrl } from './apiConfig';

// ─── Web Speech Recognition ───────────────────────────────────────────────────

let recognition: any = null;

function getWebRecognition(): any {
  if (typeof window === 'undefined') return null;
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
  }
  return recognition;
}

export function isVoiceSupported(): boolean {
  if (Platform.OS === 'web') {
    return !!getWebRecognition();
  }
  // Native: recorded locally, then sent to the backend transcription rotation.
  return true;
}

// ─── Native recording (expo-av + backend transcription rotation) ──────────────

let nativeRecording: any = null;
const TRANSCRIPTION_TIMEOUT_MS = 12_000;

async function startNativeRecording(): Promise<void> {
  const { Audio } = await import('expo-av');
  const permission = await Audio.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Microphone permission is required for voice input.');
  }
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
  const rec = new Audio.Recording();
  await rec.prepareToRecordAsync({
    android: {
      extension: '.m4a',
      outputFormat: 2, // MPEG_4
      audioEncoder: 3, // AAC
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 64000,
    },
    ios: {
      extension: '.m4a',
      audioQuality: 127, // HIGH
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 64000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 128000,
    },
  });
  await rec.startAsync();
  nativeRecording = rec;
}

async function stopNativeRecording(): Promise<string | null> {
  if (!nativeRecording) return null;
  try {
    await nativeRecording.stopAndUnloadAsync();
    const uri = nativeRecording.getURI();
    nativeRecording = null;

    if (!uri) return null;

    // Send audio to the backend. All provider keys stay server-side and the
    // backend rotates Gemini, Groq Whisper, Mistral, and OpenRouter.
    const formData = new FormData();
    const filename = uri.split('/').pop() ?? 'audio.m4a';
    const ext = filename.split('.').pop() ?? 'm4a';
    const mimeType =
      ext === 'mp3'
        ? 'audio/mpeg'
        : ext === 'wav'
          ? 'audio/wav'
          : ext === 'webm'
            ? 'audio/webm'
            : 'audio/mp4';

    formData.append('file', { uri, name: filename, type: mimeType } as any);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${getApiBaseUrl()}/transcribe`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as { text?: unknown };
    return typeof json.text === 'string' && json.text.trim()
      ? json.text.trim()
      : null;
  } catch {
    nativeRecording = null;
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function startListening(onResult: (text: string) => void): Promise<void> {
  if (Platform.OS === 'web') {
    const rec = getWebRecognition();
    if (!rec) return;
    rec.lang = navigator.language || 'en-US';
    rec.onresult = (event: any) => {
      const transcript: string = event.results[0]?.[0]?.transcript ?? '';
      if (transcript.trim()) onResult(transcript.trim());
    };
    rec.onerror = () => {};
    rec.start();
  } else {
    await startNativeRecording();
  }
}

export async function stopListening(onResult: (text: string) => void): Promise<void> {
  if (Platform.OS === 'web') {
    const rec = getWebRecognition();
    if (rec) rec.stop();
  } else {
    const text = await stopNativeRecording();
    if (text) onResult(text);
  }
}

export function cancelListening(): void {
  if (Platform.OS === 'web') {
    const rec = getWebRecognition();
    if (rec) rec.abort();
  } else {
    if (nativeRecording) {
      nativeRecording.stopAndUnloadAsync().catch(() => {});
      nativeRecording = null;
    }
  }
}
