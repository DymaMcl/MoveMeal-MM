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
export type AiErrorCode =
  | 'ai_unavailable'
  | 'ai_busy'
  | 'ai_failed'
  | 'ai_blocked'
  | 'ai_limit'
  | 'not_food'
  | 'content_rejected';

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
/**
 * Modelul pentru imagini. Masurat pe fotografii reale (noiembrie 2026): recunoaste corect
 * alimentele in ~2 s; gemini-3.8-flash nu raspundea in 40 s din cauza supraincarcarii.
 */
export const DEFAULT_VISION_MODEL = 'gemini-3.5-flash';
/** Incercari pe acelasi model cand Google raspunde „ocupat” (429/500/503). */
const ATTEMPTS_PER_MODEL = 2;
const RETRY_DELAY_MS = 700;

export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

type ModelOutcome<T> = { ok: true; data: T } | { ok: false; busy: boolean };

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
    /**
     * Daca modelul principal nu a raspuns in acest timp, porneste in paralel si modelul urmator;
     * se foloseste primul raspuns valid. Fara valoare, modelele se incearca pe rand.
     */
    hedgeAfterMs?: number;
    /** Nivelul de „gandire” al modelelor Gemini 3 (mai mic = raspuns mai rapid). */
    thinking?: ThinkingLevel;
  }): Promise<GeminiResult<T>> {
    if (!this.key) {
      throw aiError(503, 'ai_unavailable', 'Serviciul AI nu este configurat pe server.');
    }
    const bodyFor = (model: string) =>
      JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: request.contents,
        generationConfig: {
          temperature: request.temperature ?? 0.4,
          maxOutputTokens: request.maxOutputTokens ?? 1024,
          responseMimeType: 'application/json',
          responseJsonSchema: request.schema,
          // Parametrul exista doar la modelele Gemini 3; celelalte l-ar respinge.
          ...(request.thinking && model.startsWith('gemini-3')
            ? { thinkingConfig: { thinkingLevel: request.thinking } }
            : {}),
        },
      });
    const deadline = Date.now() + (request.totalTimeoutMs ?? 60_000);
    const timeoutMs = request.timeoutMs ?? 30_000;
    const models = [...new Set(request.models)];
    const stop = new AbortController();

    return new Promise<GeminiResult<T>>((resolve, reject) => {
      let settled = false;
      let busy = false;
      let running = models.length;
      const timers: NodeJS.Timeout[] = [];
      const started = models.map(() => false);
      const finish = (action: () => void) => {
        if (settled) return;
        settled = true;
        timers.forEach(clearTimeout);
        stop.abort();
        action();
      };

      const start = (i: number) => {
        if (i >= models.length || started[i] || settled) return;
        started[i] = true;
        const model = models[i];
        this.runModel<T>(model, bodyFor(model), timeoutMs, deadline, stop.signal)
          .then((outcome) => {
            if (outcome.ok) return finish(() => resolve({ data: outcome.data, model }));
            if (outcome.busy) busy = true;
            // Modelul a esuat: urmatorul porneste imediat, fara sa mai astepte.
            start(i + 1);
          })
          .catch((error: unknown) => finish(() => reject(error)))
          .finally(() => {
            running--;
            if (running === 0 && !started.includes(false)) {
              finish(() =>
                reject(
                  busy
                    ? aiError(
                        503,
                        'ai_busy',
                        'Serviciul AI este foarte solicitat acum. Incearca peste un minut.',
                      )
                    : aiError(503, 'ai_failed', 'Serviciul AI nu raspunde. Incearca din nou.'),
                ),
              );
            }
          });
      };

      start(0);
      if (request.hedgeAfterMs !== undefined) {
        for (let i = 1; i < models.length; i++) {
          timers.push(setTimeout(() => start(i), request.hedgeAfterMs * i));
        }
      }
    });
  }

  /** Incercarile pe un singur model (repetate cand Google raspunde „ocupat”). */
  private async runModel<T>(
    model: string,
    body: string,
    timeoutMs: number,
    deadline: number,
    stop: AbortSignal,
  ): Promise<ModelOutcome<T>> {
    let busy = false;
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      const left = deadline - Date.now();
      if (left < 2_000 || stop.aborted) break;
      const result = await this.attempt<T>(model, body, Math.min(timeoutMs, left), stop);
      if (result.kind === 'ok') return { ok: true, data: result.data };
      if (result.kind === 'fail') throw result.error;
      if (result.kind === 'next') break;
      busy = true;
      if (attempt < ATTEMPTS_PER_MODEL) await sleep(RETRY_DELAY_MS * attempt);
    }
    return { ok: false, busy };
  }

  private async attempt<T>(
    model: string,
    body: string,
    timeoutMs: number,
    stop: AbortSignal,
  ): Promise<Attempt<T>> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key! },
        body,
        signal: AbortSignal.any([stop, AbortSignal.timeout(timeoutMs)]),
      });
    } catch (error) {
      // Oprit intentionat: alt model a raspuns deja.
      if (!stop.aborted) this.logger.warn(`${model} nu raspunde (${(error as Error).name})`);
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
      if (stop.aborted) return { kind: 'next' };
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
