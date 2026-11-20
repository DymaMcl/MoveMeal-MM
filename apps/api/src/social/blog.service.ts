import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type pg from 'pg';
import type { Role } from '../auth/auth.service.js';
import { DatabaseService } from '../database/database.service.js';
import { nextCursor, parseCursor, type Author } from './community.service.js';
import { decodeImage } from './media.service.js';
import type { BlogPostDto } from './social.dto.js';

export type BlogCategory = 'nutrition' | 'training' | 'health' | 'recipes' | 'motivation';
export type BlogStatus = 'draft' | 'published' | 'archived';

export interface ArticleCard {
  id: string;
  title: string;
  summary: string;
  category: BlogCategory;
  coverId: string | null;
  author: Author & { title: string };
  status: BlogStatus;
  pinned: boolean;
  readMinutes: number;
  likeCount: number;
  viewCount: number;
  saveCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  isMine: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Article extends ArticleCard {
  body: string;
}

interface ArticleRow {
  id: string;
  author_id: string | null;
  title: string;
  summary: string;
  body?: string;
  category: BlogCategory;
  cover_media_id: string | null;
  status: BlogStatus;
  pinned: boolean;
  read_minutes: number;
  like_count: number;
  view_count: number;
  save_count: number;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  author_name: string;
  author_title: string | null;
  author_avatar: string | null;
  author_role: Role | null;
  liked: boolean;
  saved: boolean;
}

export const BLOG_PAGE = 15;

/** Coloanele comune; `body` doar pentru articolul deschis (lista ramane usoara). */
function articleSelect(withBody: boolean, me = 'app_user_id()') {
  return `
  select b.id, b.author_id, b.title, b.summary, ${withBody ? 'b.body,' : ''} b.category,
         b.cover_media_id, b.status, b.pinned, b.read_minutes, b.like_count, b.view_count,
         b.save_count, b.published_at, b.created_at, b.updated_at,
         coalesce(np.display_name, sp.display_name, 'MoveMeal') as author_name,
         np.title as author_title, sp.avatar_media_id as author_avatar,
         public_role(b.author_id) as author_role,
         exists (select 1 from blog_likes l where l.post_id = b.id and l.user_id = ${me}) as liked,
         exists (select 1 from blog_saves s where s.post_id = b.id and s.user_id = ${me}) as saved
  from blog_posts b
  left join social_profiles sp on sp.user_id = b.author_id
  left join nutritionist_profiles np on np.user_id = b.author_id`;
}

export function toArticle(r: ArticleRow, me: string): Article {
  return {
    id: r.id,
    title: r.title,
    summary: r.summary,
    body: r.body ?? '',
    category: r.category,
    coverId: r.cover_media_id,
    author: {
      id: r.author_id ?? '',
      name: r.author_name,
      title: r.author_title ?? '',
      avatarId: r.author_avatar,
      role: r.author_role ?? 'admin',
    },
    status: r.status,
    pinned: r.pinned,
    readMinutes: r.read_minutes,
    likeCount: r.like_count,
    viewCount: r.view_count,
    saveCount: r.save_count,
    likedByMe: r.liked,
    savedByMe: r.saved,
    isMine: r.author_id === me,
    publishedAt: r.published_at?.toISOString() ?? null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

function card(article: Article): ArticleCard {
  const { body: _body, ...rest } = article;
  return rest;
}

/** Aproximativ 200 de cuvinte pe minut. */
export function readMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(120, Math.max(1, Math.round(words / 200)));
}

/** Articolele scrise de nutritionisti si administratori. */
@Injectable()
export class BlogService {
  constructor(private readonly db: DatabaseService) {}

  async list(userId: string, query: { cursor?: string; category?: BlogCategory; q?: string }) {
    const cursor = parseCursor(query.cursor);
    const search = query.q?.trim() || null;
    return this.db.asUser(userId, async (c) => {
      // Articolele fixate apar separat, doar pe prima pagina fara filtre.
      const pinned =
        !cursor && !query.category && !search
          ? (
              await c.query<ArticleRow>(
                `${articleSelect(false)}
                 where b.status = 'published' and b.pinned
                 order by b.published_at desc limit 5`,
              )
            ).rows.map((r) => card(toArticle(r, userId)))
          : [];
      const { rows } = await c.query<ArticleRow>(
        `${articleSelect(false)}
         where b.status = 'published'
           and ($1::text is null or b.category = $1)
           and ($2::text is null or b.title ilike '%' || $2 || '%' or b.summary ilike '%' || $2 || '%')
           and ($3::boolean or not b.pinned)
           and ($4::timestamptz is null or (b.published_at, b.id) < ($4::timestamptz, $5::uuid))
         order by b.published_at desc, b.id desc
         limit ${BLOG_PAGE}`,
        [
          query.category ?? null,
          search,
          Boolean(query.category || search),
          cursor?.at ?? null,
          cursor?.id ?? null,
        ],
      );
      const items = rows.map((r) => card(toArticle(r, userId)));
      const last = items.at(-1);
      return {
        pinned,
        items,
        nextCursor:
          items.length === BLOG_PAGE && last?.publishedAt ? `${last.publishedAt}|${last.id}` : null,
      };
    });
  }

  /** Deschiderea articolului; fiecare cititor este numarat o singura data (fara autor). */
  async get(userId: string, id: string): Promise<Article> {
    return this.db.asUser(userId, async (c) => {
      const article = await this.getIn(c, userId, id);
      if (article.status === 'published' && !article.isMine) {
        const inserted = await c.query(
          `insert into blog_views (user_id, post_id) values (app_user_id(), $1)
           on conflict do nothing`,
          [id],
        );
        if (inserted.rowCount) article.viewCount += 1;
      }
      return article;
    });
  }

  private async getIn(c: pg.PoolClient, userId: string, id: string): Promise<Article> {
    const { rows } = await c.query<ArticleRow>(`${articleSelect(true)} where b.id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException('Articolul nu exista.');
    return toArticle(rows[0], userId);
  }

  async saved(userId: string): Promise<ArticleCard[]> {
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<ArticleRow>(
        `${articleSelect(false)}
         join blog_saves sv on sv.post_id = b.id and sv.user_id = app_user_id()
         where b.status = 'published'
         order by sv.created_at desc limit 100`,
      );
      return rows.map((r) => card(toArticle(r, userId)));
    });
  }

  async toggle(userId: string, id: string, table: 'blog_likes' | 'blog_saves', value: boolean) {
    return this.db.asUser(userId, async (c) => {
      const visible = await c.query(
        `select 1 from blog_posts where id = $1 and status = 'published'`,
        [id],
      );
      if (!visible.rowCount) throw new NotFoundException('Articolul nu exista.');
      if (value) {
        await c.query(
          `insert into ${table} (user_id, post_id) values (app_user_id(), $1) on conflict do nothing`,
          [id],
        );
      } else {
        await c.query(`delete from ${table} where user_id = app_user_id() and post_id = $1`, [id]);
      }
      const { rows } = await c.query<{ like_count: number; save_count: number }>(
        'select like_count, save_count from blog_posts where id = $1',
        [id],
      );
      return { value, likeCount: rows[0].like_count, saveCount: rows[0].save_count };
    });
  }

  // ------------------------------------------------------------- autori

  /** Articolele proprii (toate starile) sau, pentru administrator, toate articolele. */
  async authored(
    userId: string,
    all: boolean,
    cursorText?: string,
  ): Promise<{ items: ArticleCard[]; nextCursor: string | null }> {
    const cursor = parseCursor(cursorText);
    const { rows } = await this.db.auth.query<ArticleRow>(
      `${articleSelect(false, '$1::uuid')}
       where ($2::boolean or b.author_id = $1)
         and ($3::timestamptz is null or (b.created_at, b.id) < ($3::timestamptz, $4::uuid))
       order by b.created_at desc, b.id desc
       limit ${BLOG_PAGE}`,
      [userId, all, cursor?.at ?? null, cursor?.id ?? null],
    );
    const items = rows.map((r) => card(toArticle(r, userId)));
    return { items, nextCursor: nextCursor(items, BLOG_PAGE) };
  }

  /** Articolul pentru editare (autorul sau administratorul). */
  async editable(userId: string, role: Role, id: string): Promise<Article> {
    const { rows } = await this.db.auth.query<ArticleRow>(
      `${articleSelect(true, '$1::uuid')} where b.id = $2`,
      [userId, id],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('Articolul nu exista.');
    if (row.author_id !== userId && role !== 'admin') {
      throw new ForbiddenException('Poti modifica doar articolele tale.');
    }
    return toArticle(row, userId);
  }

  async create(userId: string, dto: BlogPostDto): Promise<Article> {
    const cover = dto.coverImage
      ? decodeImage(dto.coverImage, dto.coverMimeType ?? 'image/jpeg')
      : null;
    // Scrierea trece prin politica RLS: doar nutritionistii si administratorii pot publica.
    const id = await this.db.asUser(userId, async (c) => {
      const coverId = cover
        ? (
            await c.query<{ id: string }>(
              `insert into media (owner_id, mime, data, bytes) values (app_user_id(), $1, $2, $3)
               returning id`,
              [dto.coverMimeType ?? 'image/jpeg', cover, cover.length],
            )
          ).rows[0].id
        : null;
      const { rows } = await c.query<{ id: string }>(
        `insert into blog_posts (author_id, title, summary, body, category, cover_media_id, status,
           read_minutes, published_at)
         values (app_user_id(), $1, $2, $3, $4, $5, $6, $7,
           case when $6 = 'published' then now() end)
         returning id`,
        [
          dto.title.trim(),
          dto.summary.trim(),
          dto.body.trim(),
          dto.category,
          coverId,
          dto.status,
          readMinutes(dto.body),
        ],
      );
      return rows[0].id;
    });
    return this.editable(userId, 'admin', id);
  }

  async update(userId: string, role: Role, id: string, dto: BlogPostDto): Promise<Article> {
    const current = await this.editable(userId, role, id);
    const cover = dto.coverImage
      ? decodeImage(dto.coverImage, dto.coverMimeType ?? 'image/jpeg')
      : null;
    const client = await this.db.auth.connect();
    try {
      await client.query('begin');
      let coverId = current.coverId;
      if (cover || dto.removeCover) {
        if (current.coverId)
          await client.query('delete from media where id = $1', [current.coverId]);
        coverId = null;
      }
      if (cover) {
        const { rows } = await client.query<{ id: string }>(
          `insert into media (owner_id, mime, data, bytes) values ($1, $2, $3, $4) returning id`,
          [current.author.id || userId, dto.coverMimeType ?? 'image/jpeg', cover, cover.length],
        );
        coverId = rows[0].id;
      }
      await client.query(
        `update blog_posts set title = $2, summary = $3, body = $4, category = $5,
           cover_media_id = $6, status = $7, read_minutes = $8, updated_at = now(),
           published_at = case when $7 = 'published' then coalesce(published_at, now()) else published_at end
         where id = $1`,
        [
          id,
          dto.title.trim(),
          dto.summary.trim(),
          dto.body.trim(),
          dto.category,
          coverId,
          dto.status,
          readMinutes(dto.body),
        ],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    return this.editable(userId, role, id);
  }

  async remove(userId: string, role: Role, id: string): Promise<void> {
    const current = await this.editable(userId, role, id);
    await this.db.auth.query('delete from blog_posts where id = $1', [id]);
    if (current.coverId)
      await this.db.auth.query('delete from media where id = $1', [current.coverId]);
  }

  /** Administratorul: fixarea in partea de sus si arhivarea / republicarea. */
  async moderate(id: string, change: { pinned?: boolean; status?: BlogStatus }): Promise<void> {
    const { rowCount } = await this.db.auth.query(
      `update blog_posts set
         pinned = coalesce($2, pinned),
         status = coalesce($3, status),
         published_at = case when $3 = 'published' then coalesce(published_at, now()) else published_at end,
         updated_at = now()
       where id = $1`,
      [id, change.pinned ?? null, change.status ?? null],
    );
    if (!rowCount) throw new NotFoundException('Articolul nu exista.');
  }
}
