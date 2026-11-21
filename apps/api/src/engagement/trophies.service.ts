import { Injectable } from '@nestjs/common';
import { DAILY_STEPS_GOAL, longestStreak, TROPHIES, type TrophyId } from '@movemeal/shared';
import type pg from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export interface TrophyStatus {
  id: TrophyId;
  earned: boolean;
  awardedAt: string | null;
  /** Cat s-a realizat din prag (limitat la prag). */
  progress: number;
  goal: number;
}

/**
 * Trofeele pentru provocari. Progresul se calculeaza din datele utilizatorului (pasi, jurnal,
 * antrenamente, postari); trofeul nou obtinut se salveaza o singura data si genereaza o
 * notificare in sectiunea „Ce e nou?”.
 */
@Injectable()
export class TrophiesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Progresul fiecarei provocari pentru utilizatorul curent (in tranzactia lui). */
  private async progressIn(c: pg.PoolClient): Promise<Record<TrophyId, number>> {
    const steps = await c.query<{ day: string }>(
      `select to_char(day, 'YYYY-MM-DD') as day from steps_log
       where user_id = app_user_id() and steps >= $1`,
      [DAILY_STEPS_GOAL],
    );
    const logged = await c.query<{ day: string }>(
      `select distinct to_char(day, 'YYYY-MM-DD') as day from food_log where user_id = app_user_id()`,
    );
    const workouts = await c.query<{ n: number }>(
      `select count(distinct day)::int as n from workout_logs where user_id = app_user_id()`,
    );
    const posts = await c.query<{ n: number }>(
      `select count(*)::int as n from posts
       where user_id = app_user_id() and visibility = 'public' and status = 'published'`,
    );
    return {
      steps_10k_3: longestStreak(steps.rows.map((r) => r.day)),
      log_streak_7: longestStreak(logged.rows.map((r) => r.day)),
      workouts_10: workouts.rows[0].n,
      first_post: posts.rows[0].n,
    };
  }

  /**
   * Verifica provocarile si acorda trofeele noi. Intoarce trofeele acordate acum.
   * Erorile nu opresc actiunea care a declansat verificarea.
   */
  async evaluate(userId: string): Promise<TrophyId[]> {
    try {
      const awarded = await this.db.asUser(userId, async (c) => {
        const progress = await this.progressIn(c);
        const earned = TROPHIES.filter((t) => progress[t.id] >= t.goal).map((t) => t.id);
        if (!earned.length) return [];
        const { rows } = await c.query<{ trophy_id: TrophyId }>(
          `insert into user_trophies (user_id, trophy_id)
           select app_user_id(), unnest($1::text[])
           on conflict do nothing
           returning trophy_id`,
          [earned],
        );
        return rows.map((r) => r.trophy_id);
      });
      for (const trophyId of awarded) {
        await this.notifications.notify(userId, 'trophy', { trophyId });
      }
      return awarded;
    } catch {
      return [];
    }
  }

  /** Trofeele unui utilizator: pentru sine, si progresul celor neobtinute. */
  async list(viewerId: string, targetId: string): Promise<TrophyStatus[]> {
    if (viewerId === targetId) await this.evaluate(viewerId);
    return this.db.asUser(viewerId, async (c) => {
      const { rows } = await c.query<{ trophy_id: TrophyId; awarded_at: Date }>(
        'select trophy_id, awarded_at from user_trophies where user_id = $1',
        [targetId],
      );
      const awarded = new Map(rows.map((r) => [r.trophy_id, r.awarded_at]));
      const progress = viewerId === targetId ? await this.progressIn(c) : null;
      return TROPHIES.map((t) => {
        const at = awarded.get(t.id);
        return {
          id: t.id,
          earned: !!at,
          awardedAt: at ? at.toISOString() : null,
          // Progresul altor utilizatori nu se afiseaza (doar trofeele obtinute).
          progress: at ? t.goal : Math.min(t.goal, progress?.[t.id] ?? 0),
          goal: t.goal,
        };
      });
    });
  }
}
