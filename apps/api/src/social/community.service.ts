import {
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Nutrients } from '@movemeal/shared';
import type pg from 'pg';
import { ModerationService, type ModerationResult } from '../ai/moderation.service.js';
import type { Role } from '../auth/auth.service.js';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { refreshGoalProgress, type GoalProgress } from './goal-progress.js';
import { decodeImage, MediaService } from './media.service.js';
import type { CreatePostDto, ReportDto, SocialProfileDto, UpdatePostDto } from './social.dto.js';

export const PAGE_SIZE = 20;
/** Dupa atatea raportari, postarea este ascunsa automat pana la verificarea unui administrator. */
export const AUTO_HIDE_REPORTS = 3;

export type PostKind = 'meal' | 'workout' | 'running' | 'cycling' | 'other';

export interface Author {
  id: string;
  name: string;
  avatarId: string | null;
  role: Role;
}

export interface PostView {
  id: string;
  author: Author;
  mediaId: string;
  kind: PostKind;
  caption: string;
  visibility: 'private' | 'public';
  status: 'published' | 'pending' | 'removed';
  meal: { dish: string; nutrients: Nutrients } | null;
  likeCount: number;
  saveCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  isMine: boolean;
  /** Doar pentru autor: motivul ascunderii de catre administrator. */
  removedReason: string | null;
  createdAt: string;
}

interface PostRow {
  id: string;
  user_id: string;
  media_id: string;
  kind: PostKind;
  caption: string;
  visibility: 'private' | 'public';
  status: 'published' | 'pending' | 'removed';
  removed_reason: string | null;
  meal_dish: string | null;
  meal_nutrients: Nutrients | null;
  like_count: number;
  save_count: number;
  created_at: Date;
  author_name: string;
  author_avatar: string | null;
  author_role: Role;
  liked: boolean;
  saved: boolean;
}

/** Interogarea comuna; politica RLS de pe „posts” filtreaza ce are voie sa vada utilizatorul. */
const POST_SELECT = `
  select p.id, p.user_id, p.media_id, p.kind, p.caption, p.visibility, p.status, p.removed_reason,
         p.meal_dish, p.meal_nutrients, p.like_count, p.save_count, p.created_at,
         coalesce(np.display_name, sp.display_name, 'MoveMeal') as author_name,
         sp.avatar_media_id as author_avatar,
         public_role(p.user_id) as author_role,
         exists (select 1 from post_likes l where l.post_id = p.id and l.user_id = app_user_id()) as liked,
         exists (select 1 from post_saves s where s.post_id = p.id and s.user_id = app_user_id()) as saved
  from posts p
  left join social_profiles sp on sp.user_id = p.user_id
  left join nutritionist_profiles np on np.user_id = p.user_id`;

export function toPostView(r: PostRow, me: string): PostView {
  const mine = r.user_id === me;
  return {
    id: r.id,
    author: { id: r.user_id, name: r.author_name, avatarId: r.author_avatar, role: r.author_role },
    mediaId: r.media_id,
    kind: r.kind,
    caption: r.caption,
    visibility: r.visibility,
    status: r.status,
    meal:
      r.meal_dish && r.meal_nutrients ? { dish: r.meal_dish, nutrients: r.meal_nutrients } : null,
    likeCount: r.like_count,
    saveCount: r.save_count,
    likedByMe: r.liked,
    savedByMe: r.saved,
    isMine: mine,
    removedReason: mine ? r.removed_reason : null,
    createdAt: r.created_at.toISOString(),
  };
}

/** Cursorul paginarii: momentul si id-ul ultimei postari primite. */
export function parseCursor(cursor?: string): { at: string; id: string } | null {
  if (!cursor) return null;
  const [at, id] = cursor.split('|');
  if (!at || !id || Number.isNaN(Date.parse(at)) || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new BadRequestException('Cursor invalid.');
  }
  return { at, id };
}

export function nextCursor<T extends { createdAt: string; id: string }>(items: T[], size: number) {
  const last = items.at(-1);
  return items.length === size && last ? `${last.createdAt}|${last.id}` : null;
}

function contentRejected(reason: string): HttpException {
  return new HttpException(
    {
      statusCode: 422,
      code: 'content_rejected',
      reason,
      message: 'Fotografia nu respecta regulile comunitatii.',
    },
    422,
  );
}

export interface SocialProfileView {
  id: string;
  displayName: string;
  bio: string;
  avatarId: string | null;
  role: Role;
  showProgress: boolean;
  /** null = ascuns de utilizator sau inca necalculat. */
  progress: { pct: number; kind: 'weight' | 'consistency'; goal: string } | null;
  stats: { posts: number; likes: number };
  isMe: boolean;
}

@Injectable()
export class CommunityService {
  constructor(
    private readonly db: DatabaseService,
    private readonly media: MediaService,
    private readonly moderation: ModerationService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------- profil

  /** Creeaza profilul public la prima folosire (numele din profilul personal). */
  private async ensureProfile(c: pg.PoolClient): Promise<void> {
    await c.query(
      `insert into social_profiles (user_id, display_name)
       select app_user_id(),
              left(coalesce((select name from profiles where user_id = app_user_id()), 'MoveMeal'), 40)
       on conflict (user_id) do nothing`,
    );
  }

  async myProfile(userId: string): Promise<{
    profile: SocialProfileView;
    progress: GoalProgress | null;
    savedCount: number;
  }> {
    return this.db.asUser(userId, async (c) => {
      await this.ensureProfile(c);
      const progress = await refreshGoalProgress(c);
      const profile = await this.profileIn(c, userId, userId);
      const saved = await c.query<{ n: number }>(
        `select (select count(*) from post_saves where user_id = app_user_id())
              + (select count(*) from blog_saves where user_id = app_user_id()) as n`,
      );
      return { profile: profile!, progress, savedCount: Number(saved.rows[0].n) };
    });
  }

  async updateProfile(userId: string, dto: SocialProfileDto) {
    return this.db.asUser(userId, async (c) => {
      await this.ensureProfile(c);
      await c.query(
        `update social_profiles set display_name = $1, bio = $2, show_progress = $3,
           updated_at = now()
         where user_id = app_user_id()`,
        [dto.displayName.trim(), dto.bio.trim(), dto.showProgress],
      );
      return (await this.profileIn(c, userId, userId))!;
    });
  }

  async setAvatar(userId: string, image: string, mimeType: string) {
    const data = decodeImage(image, mimeType);
    const check = await this.moderation.checkImage(image, mimeType, '');
    await this.recordModeration(userId, check);
    if (check.verdict === 'rejected') throw contentRejected(check.reason);
    return this.db.asUser(userId, async (c) => {
      await this.ensureProfile(c);
      const old = await c.query<{ avatar_media_id: string | null }>(
        'select avatar_media_id from social_profiles where user_id = app_user_id()',
      );
      const mediaId = await this.media.insert(c, data, mimeType);
      await c.query(
        'update social_profiles set avatar_media_id = $1, updated_at = now() where user_id = app_user_id()',
        [mediaId],
      );
      if (old.rows[0]?.avatar_media_id) {
        await c.query('delete from media where id = $1', [old.rows[0].avatar_media_id]);
      }
      return (await this.profileIn(c, userId, userId))!;
    });
  }

  async removeAvatar(userId: string) {
    return this.db.asUser(userId, async (c) => {
      await this.ensureProfile(c);
      await c.query(
        `delete from media where id = (
           select avatar_media_id from social_profiles where user_id = app_user_id())`,
      );
      return (await this.profileIn(c, userId, userId))!;
    });
  }

  async profile(userId: string, targetId: string): Promise<SocialProfileView> {
    return this.db.asUser(userId, async (c) => {
      if (userId === targetId) await this.ensureProfile(c);
      const view = await this.profileIn(c, userId, targetId);
      if (!view) throw new NotFoundException('Profilul nu exista.');
      return view;
    });
  }

  private async profileIn(
    c: pg.PoolClient,
    me: string,
    targetId: string,
  ): Promise<SocialProfileView | null> {
    const { rows } = await c.query<{
      display_name: string;
      bio: string;
      avatar_media_id: string | null;
      show_progress: boolean;
      goal: string | null;
      progress_pct: number | null;
      progress_kind: 'weight' | 'consistency' | null;
      role: Role | null;
      active: boolean;
      posts: number;
      likes: number;
    }>(
      `select coalesce(np.display_name, sp.display_name) as display_name, sp.bio,
              sp.avatar_media_id, sp.show_progress, sp.goal, sp.progress_pct, sp.progress_kind,
              public_role(sp.user_id) as role, user_active(sp.user_id) as active,
              (select count(*)::int from posts p where p.user_id = sp.user_id) as posts,
              (select coalesce(sum(p.like_count), 0)::int from posts p where p.user_id = sp.user_id) as likes
       from social_profiles sp
       left join nutritionist_profiles np on np.user_id = sp.user_id
       where sp.user_id = $1`,
      [targetId],
    );
    const r = rows[0];
    if (!r || (!r.active && me !== targetId)) return null;
    const isMe = me === targetId;
    return {
      id: targetId,
      displayName: r.display_name,
      bio: r.bio,
      avatarId: r.avatar_media_id,
      role: r.role ?? 'user',
      showProgress: r.show_progress,
      progress:
        (r.show_progress || isMe) && r.progress_pct !== null && r.progress_kind && r.goal
          ? { pct: r.progress_pct, kind: r.progress_kind, goal: r.goal }
          : null,
      // Pentru ceilalti, numarul postarilor vizibile lor (RLS ascunde postarile private).
      stats: { posts: r.posts, likes: r.likes },
      isMe,
    };
  }

  // ------------------------------------------------------------- postari

  async feed(userId: string, query: { cursor?: string; kind?: PostKind }) {
    const cursor = parseCursor(query.cursor);
    const items = await this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<PostRow>(
        `${POST_SELECT}
         where p.visibility = 'public' and p.status = 'published' and user_active(p.user_id)
           and ($1::text is null or p.kind = $1)
           and ($2::timestamptz is null or (p.created_at, p.id) < ($2::timestamptz, $3::uuid))
         order by p.created_at desc, p.id desc
         limit ${PAGE_SIZE}`,
        [query.kind ?? null, cursor?.at ?? null, cursor?.id ?? null],
      );
      return rows.map((r) => toPostView(r, userId));
    });
    return { items, nextCursor: nextCursor(items, PAGE_SIZE) };
  }

  /** Albumul unui utilizator: autorul isi vede toate postarile, ceilalti doar pe cele publice. */
  async userPosts(userId: string, targetId: string, cursorText?: string) {
    const cursor = parseCursor(cursorText);
    const items = await this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<PostRow>(
        `${POST_SELECT}
         where p.user_id = $1
           and ($2::timestamptz is null or (p.created_at, p.id) < ($2::timestamptz, $3::uuid))
         order by p.created_at desc, p.id desc
         limit ${PAGE_SIZE}`,
        [targetId, cursor?.at ?? null, cursor?.id ?? null],
      );
      return rows.map((r) => toPostView(r, userId));
    });
    return { items, nextCursor: nextCursor(items, PAGE_SIZE) };
  }

  async savedPosts(userId: string): Promise<PostView[]> {
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<PostRow>(
        `${POST_SELECT}
         join post_saves sv on sv.post_id = p.id and sv.user_id = app_user_id()
         order by sv.created_at desc
         limit 100`,
      );
      return rows.map((r) => toPostView(r, userId));
    });
  }

  async get(userId: string, postId: string): Promise<PostView> {
    return this.db.asUser(userId, (c) => this.getIn(c, userId, postId));
  }

  private async getIn(c: pg.PoolClient, userId: string, postId: string): Promise<PostView> {
    const { rows } = await c.query<PostRow>(`${POST_SELECT} where p.id = $1`, [postId]);
    if (!rows[0]) throw new NotFoundException('Postarea nu exista.');
    return toPostView(rows[0], userId);
  }

  async create(userId: string, dto: CreatePostDto): Promise<PostView> {
    const settings = await this.settings.get();
    if (dto.visibility === 'public' && !settings.communityEnabled) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'community_disabled',
        message: 'Comunitatea este dezactivata temporar.',
      });
    }
    const data = decodeImage(dto.image, dto.mimeType);
    const caption = (dto.caption ?? '').trim();

    const recent = await this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{ n: number }>(
        `select count(*)::int as n from posts
         where user_id = app_user_id() and created_at > now() - interval '24 hours'`,
      );
      return rows[0].n;
    });
    if (recent >= settings.postsDaily) {
      throw new HttpException(
        { statusCode: 429, code: 'posts_limit', message: 'Ai atins limita zilnica de postari.' },
        429,
      );
    }

    // Verificarea automata: continut pentru adulti, violenta etc. (si relevanta pentru lenta).
    const check = await this.moderation.checkImage(dto.image, dto.mimeType, caption);
    if (check.verdict === 'rejected') {
      await this.recordModeration(userId, check);
      throw contentRejected(check.reason);
    }
    if (check.verdict === 'approved' && !check.relevant && dto.visibility === 'public') {
      await this.recordModeration(userId, {
        verdict: 'rejected',
        reason: 'not_relevant',
        model: check.model,
      });
      throw contentRejected('not_relevant');
    }
    const status =
      dto.visibility === 'public' &&
      (check.verdict === 'unchecked' || settings.communityPremoderation)
        ? 'pending'
        : 'published';
    await this.recordModeration(userId, check, status === 'pending');

    return this.db.asUser(userId, async (c) => {
      await this.ensureProfile(c);
      let meal: { dish: string; total: Nutrients } | null = null;
      if (dto.foodPhotoId) {
        const { rows } = await c.query<{ dish: string; logged_total: Nutrients | null }>(
          'select dish, logged_total from food_photos where user_id = app_user_id() and id = $1',
          [dto.foodPhotoId],
        );
        if (rows[0]?.logged_total) meal = { dish: rows[0].dish, total: rows[0].logged_total };
      }
      const mediaId = await this.media.insert(c, data, dto.mimeType);
      const { rows } = await c.query<{ id: string }>(
        `insert into posts (user_id, media_id, kind, caption, visibility, status, moderation,
           food_photo_id, meal_dish, meal_nutrients)
         values (app_user_id(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning id`,
        [
          mediaId,
          dto.kind,
          caption,
          dto.visibility,
          status,
          JSON.stringify(moderationRecord(check)),
          meal ? dto.foodPhotoId : null,
          meal?.dish ?? null,
          meal ? JSON.stringify(meal.total) : null,
        ],
      );
      await refreshGoalProgress(c);
      return this.getIn(c, userId, rows[0].id);
    });
  }

  async update(userId: string, postId: string, dto: UpdatePostDto): Promise<PostView> {
    const settings = await this.settings.get();
    const current = await this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{
        status: string;
        visibility: string;
        caption: string;
        moderation: { verdict?: string; relevant?: boolean };
        mime: string;
        data: Buffer;
      }>(
        `select p.status, p.visibility, p.caption, p.moderation, m.mime, m.data
         from posts p join media m on m.id = p.media_id
         where p.id = $1 and p.user_id = app_user_id()`,
        [postId],
      );
      return rows[0];
    });
    if (!current) throw new NotFoundException('Postarea nu exista.');
    if (current.status === 'removed') {
      throw new ForbiddenException('Postarea a fost ascunsa de un administrator.');
    }
    const caption = dto.caption !== undefined ? dto.caption.trim() : current.caption;
    const visibility = dto.visibility ?? current.visibility;
    let moderation = current.moderation;
    // Textul nou sau publicarea in lenta se verifica din nou.
    const recheck =
      caption !== current.caption ||
      (visibility === 'public' &&
        current.visibility !== 'public' &&
        moderation.verdict !== 'approved');
    if (recheck) {
      const check = await this.moderation.checkImage(
        current.data.toString('base64'),
        current.mime,
        caption,
      );
      await this.recordModeration(userId, check);
      if (check.verdict === 'rejected') throw contentRejected(check.reason);
      moderation = moderationRecord(check);
    }
    if (
      visibility === 'public' &&
      moderation.verdict === 'approved' &&
      moderation.relevant === false
    ) {
      throw contentRejected('not_relevant');
    }
    let status = current.status;
    if (visibility === 'private') status = 'published';
    else if (current.visibility !== 'public' || recheck) {
      status =
        moderation.verdict !== 'approved' || settings.communityPremoderation
          ? 'pending'
          : 'published';
    }
    return this.db.asUser(userId, async (c) => {
      await c.query(
        `update posts set caption = $2, visibility = $3, status = $4, moderation = $5
         where id = $1 and user_id = app_user_id()`,
        [postId, caption, visibility, status, JSON.stringify(moderation)],
      );
      return this.getIn(c, userId, postId);
    });
  }

  async remove(userId: string, postId: string): Promise<void> {
    await this.db.asUser(userId, async (c) => {
      // Stergerea fotografiei sterge si postarea (cheie straina „on delete cascade”).
      const { rowCount } = await c.query(
        `delete from media where id = (
           select media_id from posts where id = $1 and user_id = app_user_id())`,
        [postId],
      );
      if (!rowCount) throw new NotFoundException('Postarea nu exista.');
    });
  }

  async like(userId: string, postId: string, value: boolean) {
    return this.toggle(userId, postId, 'post_likes', value);
  }

  async save(userId: string, postId: string, value: boolean) {
    return this.toggle(userId, postId, 'post_saves', value);
  }

  private async toggle(
    userId: string,
    postId: string,
    table: 'post_likes' | 'post_saves',
    value: boolean,
  ) {
    return this.db.asUser(userId, async (c) => {
      // Doar postarile pe care utilizatorul le poate vedea (politica RLS).
      const visible = await c.query('select 1 from posts where id = $1', [postId]);
      if (!visible.rowCount) throw new NotFoundException('Postarea nu exista.');
      if (value) {
        await c.query(
          `insert into ${table} (user_id, post_id) values (app_user_id(), $1) on conflict do nothing`,
          [postId],
        );
      } else {
        await c.query(`delete from ${table} where user_id = app_user_id() and post_id = $1`, [
          postId,
        ]);
      }
      const { rows } = await c.query<{ like_count: number; save_count: number }>(
        'select like_count, save_count from posts where id = $1',
        [postId],
      );
      return {
        value,
        likeCount: rows[0].like_count,
        saveCount: rows[0].save_count,
      };
    });
  }

  async report(userId: string, postId: string, dto: ReportDto): Promise<void> {
    await this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{ user_id: string }>(
        'select user_id from posts where id = $1',
        [postId],
      );
      if (!rows[0]) throw new NotFoundException('Postarea nu exista.');
      if (rows[0].user_id === userId) {
        throw new BadRequestException('Nu iti poti raporta propria postare.');
      }
      await c.query(
        `insert into post_reports (post_id, reporter_id, reason, note)
         values ($1, app_user_id(), $2, $3) on conflict do nothing`,
        [postId, dto.reason, (dto.note ?? '').trim()],
      );
    });
    // Mai multe raportari: postarea dispare din lenta pana o verifica un administrator.
    await this.db.auth.query(
      `update posts set status = 'pending'
       where id = $1 and status = 'published' and visibility = 'public'
         and (select count(*) from post_reports r where r.post_id = $1 and r.resolved_at is null) >= $2`,
      [postId, AUTO_HIDE_REPORTS],
    );
  }

  private async recordModeration(userId: string, check: ModerationResult, pending = false) {
    const verdict =
      check.verdict === 'rejected'
        ? 'rejected'
        : check.verdict === 'unchecked' || pending
          ? 'pending'
          : 'approved';
    await this.db.auth.query(
      'insert into moderation_events (user_id, verdict, reason) values ($1, $2, $3)',
      [userId, verdict, check.verdict === 'rejected' ? check.reason : null],
    );
  }

  /** Notificarea autorului dupa decizia administratorului. */
  async notifyAuthor(postId: string, kind: 'post_approved' | 'post_removed', reason?: string) {
    const { rows } = await this.db.auth.query<{ user_id: string }>(
      'select user_id from posts where id = $1',
      [postId],
    );
    if (rows[0]) {
      await this.notifications.notify(
        rows[0].user_id,
        kind,
        reason ? { reason, postId } : { postId },
      );
    }
  }
}

function moderationRecord(check: ModerationResult) {
  return check.verdict === 'approved'
    ? {
        verdict: 'approved',
        relevant: check.relevant,
        suggestedKind: check.suggestedKind,
        model: check.model,
        checkedAt: new Date().toISOString(),
      }
    : { verdict: check.verdict, checkedAt: new Date().toISOString() };
}
