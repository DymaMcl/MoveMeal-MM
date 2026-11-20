import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { aiError } from './gemini.service.js';

export type AiKind = 'chat' | 'photo';

/**
 * Cererile AI permise implicit unui utilizator in ultimele 24 de ore (controlul costurilor).
 * Administratorul le poate modifica din aplicatie.
 */
export const AI_DAILY_LIMITS: Record<AiKind, number> = { chat: 60, photo: 15 };

@Injectable()
export class AiUsageService {
  constructor(
    private readonly db: DatabaseService,
    private readonly settings: SettingsService,
  ) {}

  async limits(): Promise<Record<AiKind, number>> {
    const s = await this.settings.get();
    return { chat: s.aiChatDaily, photo: s.aiPhotoDaily };
  }

  async remaining(userId: string): Promise<Record<AiKind, number>> {
    const limits = await this.limits();
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{ kind: AiKind; n: number }>(
        `select kind, count(*)::int as n from ai_usage
         where user_id = app_user_id() and created_at > now() - interval '24 hours'
         group by kind`,
      );
      const used = (kind: AiKind) => rows.find((r) => r.kind === kind)?.n ?? 0;
      return {
        chat: Math.max(0, limits.chat - used('chat')),
        photo: Math.max(0, limits.photo - used('photo')),
      };
    });
  }

  /**
   * Inregistreaza o cerere sau refuza daca limita a fost atinsa.
   * Returneaza functia care anuleaza inregistrarea (cand serviciul AI nu a raspuns).
   */
  async consume(userId: string, kind: AiKind): Promise<() => Promise<void>> {
    const limit = (await this.limits())[kind];
    const id = await this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{ n: number }>(
        `select count(*)::int as n from ai_usage
         where user_id = app_user_id() and kind = $1 and created_at > now() - interval '24 hours'`,
        [kind],
      );
      if (rows[0].n >= limit) {
        throw aiError(429, 'ai_limit', 'Ai atins limita zilnica de cereri AI.');
      }
      const inserted = await c.query<{ id: string }>(
        'insert into ai_usage (user_id, kind) values (app_user_id(), $1) returning id',
        [kind],
      );
      return inserted.rows[0].id;
    });
    return async () => {
      await this.db
        .asUser(userId, (c) => c.query('delete from ai_usage where id = $1', [id]))
        .catch(() => undefined);
    };
  }
}
