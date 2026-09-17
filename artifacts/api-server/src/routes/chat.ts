/**
 * POST /api/chat — text-only AI with deterministic provider fallback.
 *
 * Every provider gets its own 8-second timeout. A failed provider (including
 * network, auth, rate-limit, missing-model, and server errors) is logged and
 * the request continues with the next provider in priority order.
 */
import { Router, type Request, type Response as ExpressResponse } from "express";
import { logger } from "../lib/logger";
import { AI_SYSTEM_PROMPT } from "../lib/aiSystemPrompt";

const router = Router();

const GEMINI_MODEL = "gemini-2.5-flash";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const MISTRAL_MODEL = "mistral-small-latest";
const OPENROUTER_MODEL = "openrouter/auto";

const PROVIDER_TIMEOUT_MS = 8_000;

interface ChatMessage {
  role: "user" | "assistant" | "model";
  content: string;
}

interface Provider {
  name: string;
  model: string;
  key: string | undefined;
  call: (prompt: string, history: ChatMessage[]) => Promise<string>;
}

function getEnvironmentKey(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return `request timed out after ${PROVIDER_TIMEOUT_MS}ms`;
    }
    return error.message || error.name;
  }
  return String(error);
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

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<Record<string, any>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(await readProviderError(response));
    }
    return (await response.json()) as Record<string, any>;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeHistory(history: ChatMessage[]): ChatMessage[] {
  return history
    .filter(
      (message) =>
        typeof message?.content === "string" && message.content.trim().length > 0,
    )
    .slice(-10)
    .map((message) => ({
      role:
        message.role === "assistant" || message.role === "model"
          ? message.role
          : "user",
      content: message.content,
    }));
}

async function callGemini(
  prompt: string,
  history: ChatMessage[],
  key: string,
): Promise<string> {
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [
    { role: "user", parts: [{ text: AI_SYSTEM_PROMPT }] },
    { role: "model", parts: [{ text: "Understood." }] },
    ...history.map((message) => ({
      role:
        message.role === "assistant" || message.role === "model"
          ? ("model" as const)
          : ("user" as const),
      parts: [{ text: message.content }],
    })),
    { role: "user", parts: [{ text: prompt }] },
  ];

  const data = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    },
  );

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("empty response");
  }
  return text.trim();
}

async function callOpenAiCompatible(
  url: string,
  model: string,
  key: string,
  prompt: string,
  history: ChatMessage[],
  extraHeaders?: Record<string, string>,
): Promise<string> {
  const messages = [
    { role: "system", content: AI_SYSTEM_PROMPT },
    ...history.map((message) => ({
      role:
        message.role === "assistant" || message.role === "model"
          ? "assistant"
          : "user",
      content: message.content,
    })),
    { role: "user", content: prompt },
  ];

  const data = await fetchJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("empty response");
  }
  return text.trim();
}

function buildProviders(): Provider[] {
  const geminiKey = getEnvironmentKey(
    "GEMINI_API_KEY",
    "VITE_GEMINI_API_KEY",
    "EXPO_PUBLIC_GEMINI_API_KEY",
  );
  const groqKey = getEnvironmentKey(
    "GROQ_API_KEY",
    "VITE_GROQ_API_KEY",
    "EXPO_PUBLIC_GROQ_API_KEY",
  );
  const mistralKey = getEnvironmentKey(
    "MISTRAL_API_KEY",
    "VITE_MISTRAL_API_KEY",
    "EXPO_PUBLIC_MISTRAL_API_KEY",
  );
  const openRouterKey = getEnvironmentKey(
    "OPENROUTER_API_KEY",
    "VITE_OPENROUTER_API_KEY",
    "EXPO_PUBLIC_OPENROUTER_API_KEY",
  );

  return [
    {
      name: "Gemini",
      model: GEMINI_MODEL,
      key: geminiKey,
      call: (prompt, history) =>
        geminiKey
          ? callGemini(prompt, history, geminiKey)
          : Promise.reject(new Error("API key not configured")),
    },
    {
      name: "Groq",
      model: GROQ_MODEL,
      key: groqKey,
      call: (prompt, history) =>
        groqKey
          ? callOpenAiCompatible(
              "https://api.groq.com/openai/v1/chat/completions",
              GROQ_MODEL,
              groqKey,
              prompt,
              history,
            )
          : Promise.reject(new Error("API key not configured")),
    },
    {
      name: "Mistral",
      model: MISTRAL_MODEL,
      key: mistralKey,
      call: (prompt, history) =>
        mistralKey
          ? callOpenAiCompatible(
              "https://api.mistral.ai/v1/chat/completions",
              MISTRAL_MODEL,
              mistralKey,
              prompt,
              history,
            )
          : Promise.reject(new Error("API key not configured")),
    },
    {
      name: "OpenRouter",
      model: OPENROUTER_MODEL,
      key: openRouterKey,
      call: (prompt, history) =>
        openRouterKey
          ? callOpenAiCompatible(
              "https://openrouter.ai/api/v1/chat/completions",
              OPENROUTER_MODEL,
              openRouterKey,
              prompt,
              history,
              {
                "HTTP-Referer": "https://vertex-ai-chat.app",
                "X-Title": "Vertex AI Chat",
              },
            )
          : Promise.reject(new Error("API key not configured")),
    },
  ];
}

async function generateWithFallback(
  prompt: string,
  history: ChatMessage[],
): Promise<{ text: string; provider: string }> {
  const providers = buildProviders();
  const primaryError = new Error("Gemini: API key not configured");

  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    const label = `Provider ${index + 1} (${provider.name} - ${provider.model})`;

    try {
      if (!provider.key) {
        throw new Error("API key not configured");
      }

      logger.info(
        { provider: provider.name, model: provider.model },
        `[Fallback Log] ${label} starting`,
      );
      const text = await provider.call(prompt, history);
      logger.info(
        { provider: provider.name, model: provider.model },
        `[Fallback Log] ${label} succeeded`,
      );
      return { text, provider: provider.name };
    } catch (error) {
      const message = getErrorMessage(error);
      if (index === 0) {
        primaryError.message = `Gemini: ${message}`;
      }
      logger.warn(
        { provider: provider.name, model: provider.model, error: message },
        `[Fallback Log] ${label} failed. Switching to the next provider.`,
      );
    }
  }

  throw primaryError;
}

router.post("/chat", async (req: Request, res: ExpressResponse) => {
  try {
    const { prompt, history = [] } = req.body as {
      prompt?: string;
      history?: ChatMessage[];
    };

    if (!prompt?.trim()) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const result = await generateWithFallback(
      prompt.trim(),
      Array.isArray(history) ? normalizeHistory(history) : [],
    );
    res.json(result);
  } catch (error) {
    const message = getErrorMessage(error);
    logger.error({ error: message }, "[Fallback Log] All providers failed");
    res.status(500).json({ error: message });
  }
});

export default router;