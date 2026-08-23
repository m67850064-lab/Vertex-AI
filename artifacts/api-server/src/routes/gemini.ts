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
const GEMINI_KEY_ENV_NAMES = [
  "GEMINI_API_KEY_1",
  "GEMINI_API_KEY_2",
  "GEMINI_API_KEY_3",
  "GEMINI_API_KEY_4",
  "GEMINI_API_KEY",
  "EXPO_PUBLIC_GEMINI_API_KEY",
] as const;
const GEMINI_MODEL_SEQUENCE = [
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.5-flash",
] as const;

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

function getGeminiApiKeys(): string[] {
  const keys = GEMINI_KEY_ENV_NAMES.map((name) => process.env[name]?.trim()).filter(
    (value): value is string => Boolean(value),
  );

  return [...new Set(keys)];
}

function isModelUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("404") &&
    (normalized.includes("not found") ||
      normalized.includes("not supported") ||
      normalized.includes("does not exist"))
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

async function generateWithKeyAndModel(
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

router.post("/gemini", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const apiKeys = getGeminiApiKeys();
    if (apiKeys.length === 0) {
      res.status(500).json({ error: "Gemini API key not configured" });
      return;
    }

    const text = (req.body.text as string | undefined) ?? "";
    const file = req.file;

    if (!file && !text.trim()) {
      res.status(400).json({ error: "No text or file provided" });
      return;
    }

    let lastError: unknown = new Error("All Gemini keys and models failed");

    for (const modelName of GEMINI_MODEL_SEQUENCE) {
      for (const [keyIndex, apiKey] of apiKeys.entries()) {
        try {
          const responseText = await generateWithKeyAndModel(
            apiKey,
            modelName,
            file,
            text,
          );
          res.json({ text: responseText, provider: "Gemini" });
          return;
        } catch (error) {
          lastError = error;
          console.warn(
            `[Gemini] ${modelName} failed with key ${keyIndex + 1}/${apiKeys.length}; trying the next key/model`,
            { error: getErrorMessage(error) },
          );

          // Keep the loop moving for rate limits, high demand, quota exhaustion,
          // unavailable models, invalid keys, and transient provider failures.
          // A successful later key/model returns before an error reaches the client.
          if (!isModelUnavailableError(error)) {
            continue;
          }
        }
      }
    }

    res.status(502).json({
      error: `Gemini request failed after trying ${apiKeys.length} key(s) across ${GEMINI_MODEL_SEQUENCE.length} model(s): ${getErrorMessage(lastError)}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
