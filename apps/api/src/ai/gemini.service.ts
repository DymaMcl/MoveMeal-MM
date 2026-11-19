import { HttpException, Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '../config.js';

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

/** Codurile de eroare trimise aplicatiei mobile (aceasta afiseaza mesajul tradus). */
export type AiErrorCode = 'ai_unavailable' | 'ai_busy' | 'ai_failed' | 'ai_blocked' | 'ai_limit';

export function aiError(status: number, code: AiErrorCode, message: string): HttpException {
  return new HttpException({ statusCode: status, code, message }, status);
}

interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export const DEFAULT_CHAT_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_VISION_MODEL = 'gemini-3.8-flash';

/**
 * Clientul pentru Google Gemini (API REST generateContent). Cheia ramane pe server
 * (aplicatia mobila nu o cunoaste), iar raspunsul este cerut in format JSON cu o schema fixa,
 * ca serverul sa poata valida tot ce primeste de la model.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger('Gemini');
  private readonly key: string | undefined;
  private readonly baseUrl: string;
  readonly chatModel: string;
  readonly visionModel: string;

  constructor() {
    loadEnv();
    this.key = process.env.GEMINI_API_KEY?.trim() || undefined;
    this.baseUrl = (
      process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta'
    ).replace(/\/$/, '');
    this.chatModel = process.env.GEMINI_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL;
    this.visionModel = process.env.GEMINI_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL;
  }

  /** Serviciul este configurat (exista cheia API). */
  get available(): boolean {
    return Boolean(this.key);
  }

  async json<T>(request: {
    model: string;
    system: string;
    contents: GeminiContent[];
    schema: Record<string, unknown>;
    temperature?: number;
    maxOutputTokens?: number;
    timeoutMs?: number;
  }): Promise<T> {
    if (!this.key) {
      throw aiError(503, 'ai_unavailable', 'Serviciul AI nu este configurat pe server.');
    }
    const body = {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: request.contents,
      generationConfig: {
        temperature: request.temperature ?? 0.4,
        maxOutputTokens: request.maxOutputTokens ?? 1024,
        responseMimeType: 'application/json',
        responseJsonSchema: request.schema,
      },
    };

    let res: Response;
    try {
      res = await fetch(
        `${this.baseUrl}/models/${encodeURIComponent(request.model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(request.timeoutMs ?? 30_000),
        },
      );
    } catch (error) {
      this.logger.warn(`Gemini nu raspunde: ${(error as Error).name}`);
      throw aiError(503, 'ai_failed', 'Serviciul AI nu raspunde. Incearca din nou.');
    }

    if (res.status === 429) {
      throw aiError(503, 'ai_busy', 'Serviciul AI este ocupat. Incearca peste un minut.');
    }
    if (!res.ok) {
      // Se inregistreaza doar starea si mesajul Google, nu continutul trimis de utilizator.
      const detail = await res.text().catch(() => '');
      this.logger.warn(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
      throw aiError(502, 'ai_failed', 'Serviciul AI a returnat o eroare.');
    }

    const data = (await res.json().catch(() => ({}))) as GenerateResponse;
    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    if (data.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') {
      throw aiError(422, 'ai_blocked', 'Cererea nu poate fi procesata.');
    }
    try {
      return JSON.parse(stripFences(text)) as T;
    } catch {
      this.logger.warn(`Raspuns Gemini invalid (finishReason ${candidate?.finishReason ?? '-'})`);
      throw aiError(502, 'ai_failed', 'Raspunsul serviciului AI nu a putut fi citit.');
    }
  }
}

/** Unele modele inconjoara JSON-ul cu ```json … ```. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return match ? match[1] : trimmed;
}
