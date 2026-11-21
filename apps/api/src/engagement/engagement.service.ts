import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ContentLanguage } from '@movemeal/shared';
import { addDaysIso, isEditableDay, todayIso } from '../common/dates.js';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { NewsDto } from './engagement.dto.js';
import { TrophiesService } from './trophies.service.js';

export interface FollowState {
  following: boolean;
  followers: number;
}

export interface FollowUser {
  id: string;
  name: string;
  avatarId: string | null;
}

export interface NewsItem {
  id: string;
  kind: 'feature' | 'challenge';
  title: string;
  body: string;
  createdAt: string;
  unread: boolean;
}

export interface StepsDay {
  day: string;
  steps: number;
  source: 'manual' | 'device';
}

type Localized = Partial<Record<ContentLanguage, string>>;

/** Textul in limba ceruta; altfel romana, apoi prima limba disponibila. */
const pick = (text: Localized, language: ContentLanguage) =>
  text[language] ?? text.ro ?? Object.values(text)[0] ?? '';

@Injectable()
export class EngagementService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
    private readonly trophies: TrophiesService,
  ) {}

  // ------------------------------------------------------------------ abonari

  async follow(userId: string, targetId: string, value: boolean): Promise<FollowState> {
    if (userId === targetId) throw new BadRequestException('Nu te poti abona la tine insuti.');
    const { inserted, state, name } = await this.db.asUser(userId, async (c) => {
      const exists = await c.query('select user_active($1) as active', [targetId]);
      if (!exists.rows[0]?.active) throw new NotFoundException('Profilul nu exista.');
      let added = false;
      if (value) {
        const res = await c.query(
          `insert into follows (follower_id, followee_id) values (app_user_id(), $1)
           on conflict do nothing`,
          [targetId],
        );
        added = (res.rowCount ?? 0) > 0;
      } else {
        await c.query(
          'delete from follows where follower_id = app_user_id() and followee_id = $1',
          [targetId],
        );
      }
      const me = await c.query<{ name: string }>(
        `select coalesce(np.display_name, sp.display_name, p.name, 'MoveMeal') as name
         from (select app_user_id() as id) u
         left join social_profiles sp on sp.user_id = u.id
         left join nutritionist_profiles np on np.user_id = u.id
         left join profiles p on p.user_id = u.id`,
      );
      return {
        inserted: added,
        state: await this.stateIn(c, targetId),
        name: me.rows[0]?.name ?? 'MoveMeal',
      };
    });
    if (inserted) {
      await this.notifications.notifyOnce(targetId, 'new_follower', { userId, name }, { userId });
    }
    return state;
  }

  private async stateIn(c: import('pg').PoolClient, targetId: string): Promise<FollowState> {
    const { rows } = await c.query<{ following: boolean; followers: number }>(
      `select exists (select 1 from follows where follower_id = app_user_id() and followee_id = $1)
                as following,
              (select count(*)::int from follows f
               where f.followee_id = $1 and user_active(f.follower_id)) as followers`,
      [targetId],
    );
    return rows[0];
  }

  /** Urmaritorii sau abonarile unui utilizator (cei mai recenti primii). */
  async followList(
    userId: string,
    targetId: string,
    direction: 'followers' | 'following',
  ): Promise<FollowUser[]> {
    return this.db.asUser(userId, async (c) => {
      const other = direction === 'followers' ? 'follower_id' : 'followee_id';
      const self = direction === 'followers' ? 'followee_id' : 'follower_id';
      const { rows } = await c.query<{ id: string; name: string; avatar: string | null }>(
        `select f.${other} as id,
                coalesce(np.display_name, sp.display_name, 'MoveMeal') as name,
                sp.avatar_media_id as avatar
         from follows f
         left join social_profiles sp on sp.user_id = f.${other}
         left join nutritionist_profiles np on np.user_id = f.${other}
         where f.${self} = $1 and user_active(f.${other})
         order by f.created_at desc
         limit 200`,
        [targetId],
      );
      return rows.map((r) => ({ id: r.id, name: r.name, avatarId: r.avatar }));
    });
  }

  // ------------------------------------------------------------------ pasi

  /** Pasii din ultimele `days` zile (inclusiv azi). */
  async steps(userId: string, days = 7): Promise<StepsDay[]> {
    const from = addDaysIso(todayIso(), -(days - 1));
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{ day: string; steps: number; source: 'manual' | 'device' }>(
        `select to_char(day, 'YYYY-MM-DD') as day, steps, source from steps_log
         where user_id = app_user_id() and day >= $1 order by day`,
        [from],
      );
      return rows;
    });
  }

  async setSteps(
    userId: string,
    day: string,
    steps: number,
    source: 'manual' | 'device',
  ): Promise<{ day: StepsDay; trophies: string[] }> {
    if (!isEditableDay(day)) {
      throw new BadRequestException('Pasii se pot introduce doar pentru ultimele 14 zile.');
    }
    await this.db.asUser(userId, (c) =>
      c.query(
        `insert into steps_log (user_id, day, steps, source) values (app_user_id(), $1, $2, $3)
         on conflict (user_id, day) do update
           set steps = excluded.steps, source = excluded.source, updated_at = now()`,
        [day, steps, source],
      ),
    );
    const trophies = await this.trophies.evaluate(userId);
    return { day: { day, steps, source }, trophies };
  }

  // ------------------------------------------------------------------ noutati

  async news(userId: string, language: ContentLanguage): Promise<NewsItem[]> {
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{
        id: string;
        kind: 'feature' | 'challenge';
        title: Localized;
        body: Localized;
        created_at: Date;
        unread: boolean;
      }>(
        `select id, kind, title, body, created_at,
                created_at > coalesce(
                  (select seen_at from news_seen where user_id = app_user_id()), '-infinity')
                  as unread
         from news where published order by created_at desc limit 50`,
      );
      return rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: pick(r.title, language),
        body: pick(r.body, language),
        createdAt: r.created_at.toISOString(),
        unread: r.unread,
      }));
    });
  }

  /** Noutate publicata de administrator (acelasi text in toate limbile). */
  async createNews(userId: string, dto: NewsDto): Promise<NewsItem> {
    const title = dto.title.trim();
    const body = dto.body.trim();
    const localized = (text: string) => JSON.stringify({ ro: text, en: text, ru: text });
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{ id: string; created_at: Date }>(
        `insert into news (kind, title, body, created_by)
         values ($1, $2, $3, app_user_id()) returning id, created_at`,
        [dto.kind, localized(title), localized(body)],
      );
      return {
        id: rows[0].id,
        kind: dto.kind,
        title,
        body,
        createdAt: rows[0].created_at.toISOString(),
        unread: false,
      };
    });
  }

  async deleteNews(userId: string, id: string): Promise<void> {
    await this.db.asUser(userId, async (c) => {
      const { rowCount } = await c.query('delete from news where id = $1', [id]);
      if (!rowCount) throw new NotFoundException('Noutatea nu exista.');
    });
  }
}
