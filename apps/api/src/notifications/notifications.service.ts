import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

export type NotificationKind =
  | 'appointment_requested'
  | 'appointment_confirmed'
  | 'appointment_rejected'
  | 'appointment_rescheduled'
  | 'appointment_cancelled'
  | 'plan_adjusted'
  | 'access_granted'
  | 'access_revoked'
  | 'post_approved'
  | 'post_removed'
  | 'post_liked'
  | 'new_follower'
  | 'trophy'
  | 'announcement';

/**
 * Sectiunile ecranului de notificari: activitatea din comunitate, noutatile (anunturi si
 * trofee) si cele personale (programari, ajustari, acces).
 */
export type NotificationSection = 'community' | 'news' | 'personal';

export const SECTIONS: NotificationSection[] = ['community', 'news', 'personal'];

const SECTION_KINDS: Record<NotificationSection, NotificationKind[]> = {
  community: ['post_liked', 'new_follower', 'post_approved', 'post_removed'],
  news: ['trophy', 'announcement'],
  personal: [
    'appointment_requested',
    'appointment_confirmed',
    'appointment_rejected',
    'appointment_rescheduled',
    'appointment_cancelled',
    'plan_adjusted',
    'access_granted',
    'access_revoked',
  ],
};

export function sectionOf(kind: NotificationKind): NotificationSection {
  return (Object.keys(SECTION_KINDS) as NotificationSection[]).find((s) =>
    SECTION_KINDS[s].includes(kind),
  )!;
}

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  section: NotificationSection;
  payload: Record<string, unknown>;
  createdAt: string;
  read: boolean;
}

/** Notificarile din aplicatie (programari, comunitate, trofee, anunturi). */
@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  /** Scrie notificarea in contextul destinatarului (politica RLS permite doar randurile proprii). */
  async notify(
    userId: string,
    kind: NotificationKind,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await this.db.asUser(userId, (c) =>
      c.query('insert into notifications (user_id, kind, payload) values ($1, $2, $3)', [
        userId,
        kind,
        JSON.stringify(payload),
      ]),
    );
  }

  /**
   * Notifica o singura data pentru aceeasi cheie (de exemplu aceeasi persoana care apreciaza
   * aceeasi postare de mai multe ori nu trimite notificari repetate).
   */
  async notifyOnce(
    userId: string,
    kind: NotificationKind,
    payload: Record<string, unknown>,
    key: Record<string, unknown>,
  ): Promise<void> {
    await this.db.asUser(userId, async (c) => {
      const existing = await c.query(
        `select 1 from notifications
         where user_id = app_user_id() and kind = $1 and payload @> $2::jsonb limit 1`,
        [kind, JSON.stringify(key)],
      );
      if (existing.rowCount) return;
      await c.query('insert into notifications (user_id, kind, payload) values ($1, $2, $3)', [
        userId,
        kind,
        JSON.stringify(payload),
      ]);
    });
  }

  async list(userId: string): Promise<{
    items: NotificationItem[];
    unread: number;
    sections: Record<NotificationSection, number>;
  }> {
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{
        id: string;
        kind: NotificationKind;
        payload: Record<string, unknown>;
        created_at: Date;
        read_at: Date | null;
      }>(
        `select id, kind, payload, created_at, read_at from notifications
         where user_id = app_user_id() order by created_at desc limit 100`,
      );
      const unread = await c.query<{ kind: NotificationKind; n: number }>(
        `select kind, count(*)::int as n from notifications
         where user_id = app_user_id() and read_at is null group by kind`,
      );
      // Noutatile aplicatiei publicate dupa ultima vizita in sectiunea „Ce e nou?”.
      const news = await c.query<{ n: number }>(
        `select count(*)::int as n from news
         where published
           and created_at > coalesce((select seen_at from news_seen where user_id = app_user_id()),
                                     '-infinity')`,
      );
      const sections: Record<NotificationSection, number> = {
        community: 0,
        news: news.rows[0].n,
        personal: 0,
      };
      for (const r of unread.rows) sections[sectionOf(r.kind)] += r.n;
      return {
        items: rows.map((r) => ({
          id: r.id,
          kind: r.kind,
          section: sectionOf(r.kind),
          payload: r.payload,
          createdAt: r.created_at.toISOString(),
          read: r.read_at !== null,
        })),
        unread: sections.community + sections.news + sections.personal,
        sections,
      };
    });
  }

  /** Marcheaza ca citite notificarile unei sectiuni (fara sectiune: toate). */
  async markRead(userId: string, section?: NotificationSection): Promise<void> {
    await this.db.asUser(userId, async (c) => {
      const kinds = section ? SECTION_KINDS[section] : null;
      await c.query(
        `update notifications set read_at = now()
         where user_id = app_user_id() and read_at is null
           and ($1::text[] is null or kind = any($1))`,
        [kinds],
      );
      if (!section || section === 'news') {
        await c.query(
          `insert into news_seen (user_id, seen_at) values (app_user_id(), now())
           on conflict (user_id) do update set seen_at = now()`,
        );
      }
    });
  }

  /** Compatibilitate: toate notificarile ca citite. */
  async markAllRead(userId: string): Promise<void> {
    await this.markRead(userId);
  }
}
