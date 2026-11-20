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
  | 'announcement';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  createdAt: string;
  read: boolean;
}

/** Notificarile din aplicatie (programari, ajustari facute de nutritionist). */
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

  async list(userId: string): Promise<{ items: NotificationItem[]; unread: number }> {
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{
        id: string;
        kind: NotificationKind;
        payload: Record<string, unknown>;
        created_at: Date;
        read_at: Date | null;
      }>(
        `select id, kind, payload, created_at, read_at from notifications
         where user_id = app_user_id() order by created_at desc limit 50`,
      );
      const unread = await c.query<{ n: string }>(
        `select count(*) as n from notifications where user_id = app_user_id() and read_at is null`,
      );
      return {
        items: rows.map((r) => ({
          id: r.id,
          kind: r.kind,
          payload: r.payload,
          createdAt: r.created_at.toISOString(),
          read: r.read_at !== null,
        })),
        unread: Number(unread.rows[0].n),
      };
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db.asUser(userId, (c) =>
      c.query(
        `update notifications set read_at = now() where user_id = app_user_id() and read_at is null`,
      ),
    );
  }
}
