import { Global, Injectable, Module } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

/** Parametrii sistemului, modificati de administrator din aplicatie. */
export interface SystemSettings {
  freeConsultationDays: number;
  aiChatDaily: number;
  aiPhotoDaily: number;
  communityEnabled: boolean;
  /** Postarile publice apar in lenta doar dupa aprobarea unui administrator. */
  communityPremoderation: boolean;
  postsDaily: number;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  freeConsultationDays: 30,
  aiChatDaily: 60,
  aiPhotoDaily: 15,
  communityEnabled: true,
  communityPremoderation: false,
  postsDaily: 10,
};

const KEYS: Record<keyof SystemSettings, string> = {
  freeConsultationDays: 'free_consultation_days',
  aiChatDaily: 'ai_chat_daily',
  aiPhotoDaily: 'ai_photo_daily',
  communityEnabled: 'community_enabled',
  communityPremoderation: 'community_premoderation',
  postsDaily: 'posts_daily',
};

/** Valorile sunt citite din baza de date si pastrate cateva secunde (se citesc la fiecare cerere AI). */
const CACHE_MS = 5_000;

@Injectable()
export class SettingsService {
  private cache: { value: SystemSettings; at: number } | null = null;

  constructor(private readonly db: DatabaseService) {}

  async get(): Promise<SystemSettings> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const { rows } = await this.db.auth.query<{ key: string; value: unknown }>(
      'select key, value from system_settings',
    );
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const value = { ...DEFAULT_SETTINGS };
    for (const [field, key] of Object.entries(KEYS) as [keyof SystemSettings, string][]) {
      if (!map.has(key)) continue;
      const raw = map.get(key);
      (value as Record<string, unknown>)[field] =
        typeof DEFAULT_SETTINGS[field] === 'boolean' ? raw === true : Number(raw);
    }
    this.cache = { value, at: Date.now() };
    return value;
  }

  async update(changes: Partial<SystemSettings>): Promise<SystemSettings> {
    for (const [field, value] of Object.entries(changes) as [keyof SystemSettings, unknown][]) {
      if (value === undefined || !(field in KEYS)) continue;
      await this.db.auth.query(
        `insert into system_settings (key, value) values ($1, $2)
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
        [KEYS[field], JSON.stringify(value)],
      );
    }
    this.cache = null;
    return this.get();
  }
}

@Global()
@Module({ providers: [SettingsService], exports: [SettingsService] })
export class SettingsModule {}
