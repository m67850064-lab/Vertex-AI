import { Router, type Request, type Response } from "express";
import multer from "multer";
import { logger } from "../lib/logger";
import { AI_SYSTEM_PROMPT } from "../lib/aiSystemPrompt";

const router = Router();

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 10_000;

type ProviderKind = "gemini" | "openai-compatible";

interface Provider {
  readonly name: string;
  readonly kind: ProviderKind;
  readonly endpoint: string;
  readonly envKey: string;
  readonly model: string;
  readonly headers?: Record<string, string>;
}

/**
 * This order is deliberately explicit. Do not sort, parallelize, or add
 * model/key rotation inside this list: one failed entry must move directly to
 * the next entry.
 */
const PROVIDERS: readonly Provider[] = [
  {
    name: "Gemini",
    kind: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    envKey: "VITE_GEMINI_API_KEY",
    model: "gemini-2.5-flash",
  },
  {
    name: "Groq",
    kind: "openai-compatible",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    envKey: "VITE_GROQ_API_KEY",
    model: "llama-3.3-70b-versatile",
  },
  {
    name: "Mistral",
    kind: "openai-compatible",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    envKey: "VITE_MISTRAL_API_KEY",
    model: "mistral-small-latest",
  },
  {
    name: "OpenRouter",
    kind: "openai-compatible",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    envKey: "VITE_OPENROUTER_API_KEY",
    model: "openrouter/auto",
    headers: {
      "HTTP-Referer": "https://vertex-ai-chat.app",
      "X-Title": "Vertex AI Chat",
    },
  },
];

const CONCISE_SYSTEM_PROMPT = [
  AI_SYSTEM_PROMPT,
  "Use the fewest words that fully answer the request.",
  "Answer only the user's request; do not repeat it or add unrelated context.",
  "Prefer one short paragraph or concise bullets.",
  "Do not invent facts, citations, links, or missing details.",
  "Ask at most one focused clarification question only when required to answer.",
  "For simple questions, answer in one or two sentences.",
].join(" ");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = /^(image\/(jpeg|png)|application\/pdf|text\/plain)$/i;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type."));
    }
  },
});

type GeminiPart = {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
};

type CompatibleContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

function getConfiguredKey(provider: Provider): string {
  return process.env[provider.envKey]?.trim() ?? "";
}

function createAbortableRequest(
  url: string,
  init: RequestInit,
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  return fetch(url, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
}

function ensureSuccessfulResponse(response: globalThis.Response): void {
  if (!response.ok) {
    throw new Error(`Provider returned HTTP ${response.status}`);
  }
}

function extractText(payload: unknown): string {
  const data = payload as {
    text?: unknown;
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: unknown }>;
      };
    }>;
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
  };

  if (typeof data.text === "string" && data.text.trim()) {
    return data.text.trim();
  }

  const GeminiText = data.candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
  if (GeminiText) return GeminiText;

  const compatibleText = data.choices?.[0]?.message?.content;
  if (typeof compatibleText === "string" && compatibleText.trim()) {
    return compatibleText.trim();
  }

  if (Array.isArray(compatibleText)) {
    const joined = compatibleText
      .map((part) => {
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }
        return "";
      })
      .join("")
      .trim();
    if (joined) return joined;
  }

  throw new Error("Provider returned an empty response.");
}

function buildGeminiParts(
  file: Express.Multer.File | undefined,
  text: string,
): GeminiPart[] {
  const parts: GeminiPart[] = [];

  if (text.trim()) {
    parts.push({ text: text.trim() });
  }

  if (file) {
    parts.push({
      inlineData: {
        data: file.buffer.toString("base64"),
        mimeType: file.mimetype,
      },
    });
  }

  return parts;
}

async function requestGemini(
  provider: Provider,
  apiKey: string,
  file: Express.Multer.File | undefined,
  text: string,
): Promise<string> {
  const response = await createAbortableRequest(
    `${provider.endpoint}/models/${provider.model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: CONCISE_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: buildGeminiParts(file, text),
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 768,
        },
      }),
    },
  );

  ensureSuccessfulResponse(response);
  return extractText(await response.json());
}

function buildCompatibleContent(
  file: Express.Multer.File | undefined,
  text: string,
): CompatibleContent {
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

  return `${prompt}\n\nAttached PDF: ${file.originalname || "document.pdf"}`;
}

async function requestCompatibleProvider(
  provider: Provider,
  apiKey: string,
  file: Express.Multer.File | undefined,
  text: string,
): Promise<string> {
  const response = await createAbortableRequest(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...provider.headers,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: CONCISE_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildCompatibleContent(file, text),
        },
      ],
      temperature: 0.2,
      max_tokens: 768,
    }),
  });

  ensureSuccessfulResponse(response);
  return extractText(await response.json());
}

async function requestProvider(
  provider: Provider,
  apiKey: string,
  file: Express.Multer.File | undefined,
  text: string,
): Promise<string> {
  if (provider.kind === "gemini") {
    return requestGemini(provider, apiKey, file, text);
  }

  return requestCompatibleProvider(provider, apiKey, file, text);
}

router.post(
  "/gemini",
  upload.single("file"),
  async (req: Request, res: Response) => {
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    const file = req.file;

    if (!file && !text.trim()) {
      res.status(400).json({ error: "No text or file provided." });
      return;
    }

    /**
     * Strict sequential fallback loop:
     * - exactly one key/model per provider
     * - no parallel requests
     * - every failure is caught internally
     * - only a successful provider returns early
     */
    for (const [providerIndex, provider] of PROVIDERS.entries()) {
      try {
        const apiKey = getConfiguredKey(provider);
        if (!apiKey) {
          throw new Error("Provider key is not configured.");
        }

        const responseText = await requestProvider(provider, apiKey, file, text);
        res.json({
          text: responseText,
          provider: provider.name,
          model: provider.model,
        });
        return;
      } catch {
        // Never log provider errors, response bodies, model details, or keys.
        logger.warn({ providerIndex });
      }
    }

    // This is reachable only after every provider entry has failed.
    res.status(502).json({
      error: "All AI providers failed. Please try again.",
    });
  },
);

export default router;