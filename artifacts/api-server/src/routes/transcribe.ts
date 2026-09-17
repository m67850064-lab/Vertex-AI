import { Router, type Request, type Response } from "express";
import multer from "multer";
import { logger } from "../lib/logger";

const router = Router();
const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
const TRANSCRIPTION_TIMEOUT_MS = 12_000;

type TranscriptionProviderKind =
  | "gemini"
  | "groq"
  | "mistral"
  | "openrouter";

interface TranscriptionProvider {
  name: string;
  kind: TranscriptionProviderKind;
  endpoint: string;
  keyEnvNames: readonly string[];
  models: readonly string[];
}

const PROVIDER_ROTATION: readonly TranscriptionProvider[] = [
  {
    name: "Gemini",
    kind: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    keyEnvNames: ["VITE_GEMINI_API_KEY", "GEMINI_API_KEY", "EXPO_PUBLIC_GEMINI_API_KEY"],
    models: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
  },
  {
    name: "Groq Whisper",
    kind: "groq",
    endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
    keyEnvNames: ["VITE_GROQ_API_KEY", "GROQ_API_KEY", "EXPO_PUBLIC_GROQ_API_KEY"],
    models: ["whisper-large-v3-turbo", "whisper-large-v3"],
  },
  {
    name: "Mistral Voxtral",
    kind: "mistral",
    endpoint: "https://api.mistral.ai/v1/audio/transcriptions",
    keyEnvNames: ["VITE_MISTRAL_API_KEY", "MISTRAL_API_KEY", "EXPO_PUBLIC_MISTRAL_API_KEY"],
    models: ["voxtral-mini-latest", "voxtral-mini-2507"],
  },
  {
    name: "OpenRouter",
    kind: "openrouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    keyEnvNames: ["VITE_OPENROUTER_API_KEY", "OPENROUTER_API_KEY", "EXPO_PUBLIC_OPENROUTER_API_KEY"],
    models: ["google/gemini-2.5-flash", "openai/gpt-4o-mini-audio-preview"],
  },
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = /^audio\/(aac|m4a|mp4|mpeg|mp3|wav|webm|x-m4a)$/i;
    if (allowed.test(file.mimetype) || /\.(aac|m4a|mp3|mp4|wav|webm)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported audio type."));
    }
  },
});

function getProviderKeys(provider: TranscriptionProvider): string[] {
  const keys = provider.keyEnvNames.flatMap((name) =>
    (process.env[name] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  return [...new Set(keys)];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return `request timed out after ${TRANSCRIPTION_TIMEOUT_MS}ms`;
    }
    return error.message || error.name;
  }
  return String(error);
}

function getAudioFormat(file: Express.Multer.File): string {
  const extension = file.originalname.split(".").pop()?.toLowerCase();
  if (extension === "mp3" || extension === "wav" || extension === "webm") {
    return extension;
  }
  return "m4a";
}

function createAudioForm(
  file: Express.Multer.File,
  model: string,
): FormData {
  const audioBytes = new Uint8Array(file.buffer.length);
  audioBytes.set(file.buffer);

  const body = new FormData();
  body.append(
    "file",
    new Blob([audioBytes.buffer], { type: file.mimetype || "audio/m4a" }),
    file.originalname || "voice.m4a",
  );
  body.append("model", model);
  body.append("response_format", "json");
  return body;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TRANSCRIPTION_TIMEOUT_MS,
  );

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getResponseError(response: globalThis.Response): Promise<Error> {
  const detail = await response.text().catch(() => "");
  return new Error(
    `HTTP ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ""}`,
  );
}

function readTranscript(data: unknown): string {
  const result = data as {
    text?: unknown;
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: unknown }>;
      };
    }>;
  };

  if (typeof result.text === "string") return result.text.trim();

  const choiceText = result.choices?.[0]?.message?.content;
  if (typeof choiceText === "string") return choiceText.trim();

  const candidateText = result.candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
  return candidateText ?? "";
}

async function transcribeWithGemini(
  provider: TranscriptionProvider,
  apiKey: string,
  model: string,
  file: Express.Multer.File,
): Promise<string> {
  const response = await fetchWithTimeout(
    `${provider.endpoint}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Transcribe this audio exactly. Return only the spoken words, " +
                  "with natural punctuation. Do not summarize, explain, or invent words.",
              },
              {
                inlineData: {
                  mimeType: file.mimetype || "audio/m4a",
                  data: file.buffer.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 512,
        },
      }),
    },
  );

  if (!response.ok) throw await getResponseError(response);
  const text = readTranscript(await response.json());
  if (!text) throw new Error("Gemini returned an empty transcript.");
  return text;
}

async function transcribeWithMultipartProvider(
  provider: TranscriptionProvider,
  apiKey: string,
  model: string,
  file: Express.Multer.File,
): Promise<string> {
  const response = await fetchWithTimeout(provider.endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: createAudioForm(file, model),
  });

  if (!response.ok) throw await getResponseError(response);
  const text = readTranscript(await response.json());
  if (!text) throw new Error(`${provider.name} returned an empty transcript.`);
  return text;
}

async function transcribeWithOpenRouter(
  provider: TranscriptionProvider,
  apiKey: string,
  model: string,
  file: Express.Multer.File,
): Promise<string> {
  const response = await fetchWithTimeout(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://vertex-ai-chat.app",
      "X-Title": "Vertex AI Chat",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "Transcribe the attached audio exactly. Return only the spoken words.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this audio." },
            {
              type: "input_audio",
              input_audio: {
                data: file.buffer.toString("base64"),
                format: getAudioFormat(file),
              },
            },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 512,
    }),
  });

  if (!response.ok) throw await getResponseError(response);
  const text = readTranscript(await response.json());
  if (!text) throw new Error("OpenRouter returned an empty transcript.");
  return text;
}

async function transcribeWithProvider(
  provider: TranscriptionProvider,
  apiKey: string,
  model: string,
  file: Express.Multer.File,
): Promise<string> {
  if (provider.kind === "gemini") {
    return transcribeWithGemini(provider, apiKey, model, file);
  }
  if (provider.kind === "openrouter") {
    return transcribeWithOpenRouter(provider, apiKey, model, file);
  }
  return transcribeWithMultipartProvider(provider, apiKey, model, file);
}

async function transcribeWithLocalServer(
  url: string,
  file: Express.Multer.File,
): Promise<string> {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    body: createAudioForm(file, "local"),
  });

  if (!response.ok) throw await getResponseError(response);
  const text = readTranscript(await response.json());
  if (!text) throw new Error("Local transcription server returned an empty transcript.");
  return text;
}

router.post(
  "/transcribe",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Audio file is required." });
        return;
      }

      let attemptCount = 0;
      let configuredKeyCount = 0;
      let lastError: unknown = new Error("All transcription providers failed.");

      for (const provider of PROVIDER_ROTATION) {
        const keys = getProviderKeys(provider);
        configuredKeyCount += keys.length;

        if (keys.length === 0) {
          logger.warn(
            { provider: provider.name, keyEnv: provider.keyEnvNames[0] },
            "Transcription provider skipped because no key is configured",
          );
          continue;
        }

        for (const model of provider.models) {
          for (const [keyIndex, key] of keys.entries()) {
            attemptCount += 1;
            try {
              const text = await transcribeWithProvider(provider, key, model, req.file);
              res.json({
                text,
                provider: provider.name,
                model,
              });
              return;
            } catch (error) {
              lastError = error;
              logger.warn(
                {
                  provider: provider.name,
                  model,
                  keyIndex: keyIndex + 1,
                  keyCount: keys.length,
                  error: getErrorMessage(error),
                },
                "Transcription attempt failed; trying the next provider/model/key",
              );
            }
          }
        }
      }

      const localUrl = process.env.LOCAL_TRANSCRIPTION_URL?.trim();
      if (localUrl) {
        try {
          const text = await transcribeWithLocalServer(localUrl, req.file);
          res.json({ text, provider: "Local transcription server" });
          return;
        } catch (error) {
          lastError = error;
          logger.warn(
            { error: getErrorMessage(error) },
            "Local transcription fallback failed",
          );
        }
      } else {
        logger.warn(
          "All remote transcription providers failed and LOCAL_TRANSCRIPTION_URL is not configured",
        );
      }

      const message =
        configuredKeyCount === 0
          ? "No transcription provider API keys are configured."
          : `All transcription attempts failed (${attemptCount} total): ${getErrorMessage(lastError)}`;
      res.status(502).json({ error: message });
    } catch (error) {
      const message = getErrorMessage(error) || "Transcription failed.";
      logger.warn({ error: message }, "Voice transcription failed");
      res.status(500).json({ error: message });
    }
  },
);

export default router;