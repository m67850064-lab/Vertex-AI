import { Router, type Request, type Response } from "express";
import multer from "multer";
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AI_SYSTEM_PROMPT } from "../lib/aiSystemPrompt";

const router = Router();

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const PROVIDER_TIMEOUT_MS = 10_000;

type ProviderKind = "gemini" | "openai-compatible";

interface ProviderConfig {
  name: string;
  kind: ProviderKind;
  endpoint: string;
  keyEnvNames: readonly string[];
  models: readonly string[];
  headers?: Record<string, string>;
}

const GEMINI_MODEL_SEQUENCE = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
] as const;

/**
 * Ordered failover rotation. The VITE_* names are the canonical names for
 * this route; the existing aliases keep already-configured server deployments
 * working without copying or exposing any secret values.
 */
const PROVIDER_ROTATION: readonly ProviderConfig[] = [
  {
    name: "Gemini",
    kind: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    keyEnvNames: ["VITE_GEMINI_API_KEY", "GEMINI_API_KEY", "EXPO_PUBLIC_GEMINI_API_KEY"],
    models: GEMINI_MODEL_SEQUENCE,
  },
  {
    name: "Groq",
    kind: "openai-compatible",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    keyEnvNames: ["VITE_GROQ_API_KEY", "GROQ_API_KEY", "EXPO_PUBLIC_GROQ_API_KEY"],
    models: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"],
  },
  {
    name: "Mistral",
    kind: "openai-compatible",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    keyEnvNames: ["VITE_MISTRAL_API_KEY", "MISTRAL_API_KEY", "EXPO_PUBLIC_MISTRAL_API_KEY"],
    models: ["mistral-small-latest", "mistral-medium-latest"],
  },
  {
    name: "OpenRouter",
    kind: "openai-compatible",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    keyEnvNames: ["VITE_OPENROUTER_API_KEY", "OPENROUTER_API_KEY", "EXPO_PUBLIC_OPENROUTER_API_KEY"],
    models: ["openrouter/auto"],
    headers: {
      "HTTP-Referer": "https://vertex-ai-chat.app",
      "X-Title": "Vertex AI Chat",
    },
  },
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = /^(image\/(jpeg|png)|application\/pdf|text\/plain)$/i;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Only JPG, PNG, PDF and TXT are allowed."));
    }
  },
});

function getProviderKeys(provider: ProviderConfig): string[] {
  const keys = provider.keyEnvNames.flatMap((name) =>
    (process.env[name] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  return [...new Set(keys)];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readProviderError(response: globalThis.Response): Promise<string> {
  const body = await response.text().catch(() => "");
  if (!body) return `HTTP ${response.status}`;

  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string } | string;
      message?: string;
    };
    const detail =
      typeof parsed.error === "string"
        ? parsed.error
        : parsed.error?.message ?? parsed.message;
    return `HTTP ${response.status}${detail ? `: ${detail}` : ""}`;
  } catch {
    return `HTTP ${response.status}: ${body.slice(0, 300)}`;
  }
}

async function withTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`request timed out after ${PROVIDER_TIMEOUT_MS}ms`)),
      PROVIDER_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function buildRequestParts(
  file: Express.Multer.File | undefined,
  text: string,
  apiKey: string,
): Promise<Part[]> {
  const parts: Part[] = [];

  if (file) {
    if (file.mimetype.startsWith("image/")) {
      parts.push({
        inlineData: {
          data: file.buffer.toString("base64"),
          mimeType: file.mimetype,
        },
      } as Part);
    } else {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gemini-upload-"));
      const extension = file.mimetype === "text/plain" ? ".txt" : ".pdf";
      const tmpPath = path.join(tmpDir, `upload${extension}`);
      await fs.writeFile(tmpPath, file.buffer);

      try {
        const fileManager = new GoogleAIFileManager(apiKey);
        const uploadResult = await fileManager.uploadFile(tmpPath, {
          mimeType: file.mimetype,
          displayName: file.originalname || `upload${extension}`,
        });
        parts.push({
          fileData: {
            fileUri: uploadResult.file.uri,
            mimeType: file.mimetype,
          },
        } as Part);
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  if (text.trim()) {
    parts.unshift({ text } as Part);
  }

  return parts;
}

async function generateWithGemini(
  apiKey: string,
  modelName: string,
  file: Express.Multer.File | undefined,
  text: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const parts = await buildRequestParts(file, text, apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent({
    contents: [
      { role: "user", parts: [{ text: AI_SYSTEM_PROMPT }] },
      { role: "model", parts: [{ text: "Understood." }] },
      { role: "user", parts },
    ],
  });

  return result.response.text();
}

function buildCompatibleUserContent(
  file: Express.Multer.File | undefined,
  text: string,
): string | { type: string; text?: string; image_url?: { url: string } }[] {
  const prompt = text.trim() || "Please analyze the attached file.";
  if (!file) return prompt;

  if (file.mimetype.startsWith("image/")) {
    return [
      { type: "text", text: prompt },
      {
        type: "image_url",
        image_url: {
          url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
        },
      },
    ];
  }

  if (file.mimetype === "text/plain") {
    return `${prompt}\n\nAttached text:\n${file.buffer.toString("utf8")}`;
  }

  return `${prompt}\n\nAn attached PDF named "${file.originalname || "document.pdf"}" was provided.`;
}

async function generateWithCompatibleProvider(
  provider: ProviderConfig,
  apiKey: string,
  modelName: string,
  file: Express.Multer.File | undefined,
  text: string,
): Promise<string> {
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...provider.headers,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildCompatibleUserContent(file, text),
        },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    throw new Error(await readProviderError(response));
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const responseText = data.choices?.[0]?.message?.content;
  if (typeof responseText !== "string" || !responseText.trim()) {
    throw new Error("empty response");
  }

  return responseText.trim();
}

async function generateWithProvider(
  provider: ProviderConfig,
  apiKey: string,
  modelName: string,
  file: Express.Multer.File | undefined,
  text: string,
): Promise<string> {
  if (provider.kind === "gemini") {
    return generateWithGemini(apiKey, modelName, file, text);
  }

  return generateWithCompatibleProvider(provider, apiKey, modelName, file, text);
}

router.post("/gemini", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const text = (req.body.text as string | undefined) ?? "";
    const file = req.file;

    if (!file && !text.trim()) {
      res.status(400).json({ error: "No text or file provided" });
      return;
    }

    let lastError: unknown = new Error("All configured providers and models failed");
    let configuredKeyCount = 0;
    let attemptCount = 0;

    for (const provider of PROVIDER_ROTATION) {
      const apiKeys = getProviderKeys(provider);
      configuredKeyCount += apiKeys.length;

      if (apiKeys.length === 0) {
        console.warn(
          `[Failover] ${provider.name} skipped: no configured key in ${provider.keyEnvNames[0]}`,
        );
        continue;
      }

      // Model-first ordering ensures every configured key gets the primary
      // model before moving to that provider's next official model.
      for (const modelName of provider.models) {
        for (const [keyIndex, apiKey] of apiKeys.entries()) {
          attemptCount += 1;
          try {
            const responseText = await withTimeout(
              generateWithProvider(provider, apiKey, modelName, file, text),
            );
            res.json({
              text: responseText,
              provider: provider.name,
              model: modelName,
            });
            return;
          } catch (error) {
            lastError = error;
            console.warn(
              `[Failover] ${provider.name}/${modelName} failed for key ${keyIndex + 1}/${apiKeys.length}; trying the next attempt`,
              { error: getErrorMessage(error) },
            );
          }
        }
      }
    }

    if (configuredKeyCount === 0) {
      res.status(500).json({
        error: "No configured provider API keys found",
      });
      return;
    }

    res.status(502).json({
      error: `All configured provider attempts failed (${attemptCount} total): ${getErrorMessage(lastError)}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
