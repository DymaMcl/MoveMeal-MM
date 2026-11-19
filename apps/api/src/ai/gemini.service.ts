import { HttpException, Injectable, Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
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

export interface GeminiResult<T> {
  data: T;
  /** Modelul care a raspuns (poate fi cel de rezerva). */
  model: string;
}

/**
 * Rezultatul unei incercari:
 * retry = acelasi model, dupa o pauza (supraincarcare temporara);
 * next = modelul urmator (modelul nu raspunde, nu exista sau raspunsul nu poate fi citit).
 */
type Attempt<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'retry' }
  | { kind: 'next' }
  | { kind: 'fail'; error: HttpException };

export const DEFAULT_CHAT_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_VISION_MODEL = 'gemini-3.8-flash';
/** Incercari pe acelasi model cand Google raspunde „ocupat” (429/500/503). */
const ATTEMPTS_PER_MODEL = 2;
const RETRY_DELAY_MS = 700;

/**
 * Clientul pentru Google Gemini (API REST generateContent). Cheia ramane pe server
 * (aplicatia mobila nu o cunoaste), iar raspunsul este cerut in format JSON cu o schema fixa,
 * ca serverul sa poata valida tot ce primeste de la model. Cand un model este supraincarcat,
 * cererea se repeta, apoi trece la modelul de rezerva.
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
    /** Modelul principal, apoi cele de rezerva. */
    models: string[];
    system: string;
    contents: GeminiContent[];
    schema: Record<string, unknown>;
    temperature?: number;
    maxOutputTokens?: number;
    /** Timpul maxim pentru o incercare. */
    timeoutMs?: number;
    /** Timpul maxim pentru toate incercarile. */
    totalTimeoutMs?: number;
  }): Promise<GeminiResult<T>> {
    if (!this.key) {
      throw aiError(503, 'ai_unavailable', 'Serviciul AI nu este configurat pe server.');
    }
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: request.contents,
      generationConfig: {
        temperature: request.temperature ?? 0.4,
        maxOutputTokens: request.maxOutputTokens ?? 1024,
        responseMimeType: 'application/json',
        responseJsonSchema: request.schema,
      },
    });
    const deadline = Date.now() + (request.totalTimeoutMs ?? 60_000);
    let busy = false;

    for (const model of [...new Set(request.models)]) {
      for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
        const left = deadline - Date.now();
        if (left < 2_000) break;
        const result = await this.attempt<T>(
          model,
          body,
          Math.min(request.timeoutMs ?? 30_000, left),
        );
        if (result.kind === 'ok') return { data: result.data, model };
        if (result.kind === 'fail') throw result.error;
        if (result.kind === 'next') break;
        busy = true;
        if (attempt < ATTEMPTS_PER_MODEL) await sleep(RETRY_DELAY_MS * attempt);
      }
    }
    throw busy
      ? aiError(503, 'ai_busy', 'Serviciul AI este foarte solicitat acum. Incearca peste un minut.')
      : aiError(503, 'ai_failed', 'Serviciul AI nu raspunde. Incearca din nou.');
  }

  private async attempt<T>(model: string, body: string, timeoutMs: number): Promise<Attempt<T>> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key! },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      this.logger.warn(`${model} nu raspunde (${(error as Error).name})`);
      return { kind: 'next' };
    }

    if (!res.ok) {
      // Se inregistreaza doar starea si mesajul Google, nu continutul trimis de utilizator.
      const detail = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      this.logger.warn(`${model} ${res.status}: ${(detail.error?.message ?? '').slice(0, 200)}`);
      if ([429, 500, 503, 504].includes(res.status)) return { kind: 'retry' };
      if (res.status === 401 || res.status === 403) {
        return {
          kind: 'fail',
          error: aiError(503, 'ai_unavailable', 'Cheia Gemini este invalida sau nu are acces.'),
        };
      }
      return { kind: 'next' };
    }

    const data = (await res.json().catch(() => ({}))) as GenerateResponse;
    const candidate = data.candidates?.[0];
    if (data.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') {
      return { kind: 'fail', error: aiError(422, 'ai_blocked', 'Cererea nu poate fi procesata.') };
    }
    const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    try {
      return { kind: 'ok', data: JSON.parse(stripFences(text)) as T };
    } catch {
      this.logger.warn(
        `${model}: raspuns invalid (finishReason ${candidate?.finishReason ?? '-'})`,
      );
      return { kind: 'next' };
    }
  }
}

/** Unele modele inconjoara JSON-ul cu ```json … ```. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return match ? match[1] : trimmed;
}
