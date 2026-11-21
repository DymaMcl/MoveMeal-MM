import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Role } from '../auth/auth.service.js';
import { DatabaseService } from '../database/database.service.js';
import { SettingsService, type SystemSettings } from '../settings/settings.service.js';
import { BlogService, type BlogStatus } from '../social/blog.service.js';
import { CommunityService, parseCursor } from '../social/community.service.js';

export interface AdminUser {
  id: string;
  email: string;
  role: Role;
  displayName: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  blockedAt: string | null;
  blockedReason: string | null;
}

export type ModerationFilter = 'pending' | 'reported' | 'removed' | 'all';
export type Audience = 'all' | 'user' | 'nutritionist';

const USER_COLUMNS = `u.id, u.email, u.role, u.created_at, u.blocked_at, u.blocked_reason,
  sp.display_name,
  (select max(s.created_at) from sessions s where s.user_id = u.id) as last_active`;

interface UserRow {
  id: string;
  email: string;
  role: Role;
  created_at: Date;
  blocked_at: Date | null;
  blocked_reason: string | null;
  display_name: string | null;
  last_active: Date | null;
}

const MODERATION_PAGE = 20;

/**
 * Panoul administratorului. Administratorul gestioneaza conturile, rolurile, continutul
 * (comunitate si blog) si parametrii, dar nu are acces la datele de sanatate ale utilizatorilor
 * (profil, jurnal, masuratori).
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly settingsService: SettingsService,
    private readonly community: CommunityService,
    private readonly blog: BlogService,
  ) {}

  // ------------------------------------------------------------- statistici

  async stats() {
    const q = <T extends object>(sql: string) => this.db.auth.query<T>(sql).then((r) => r.rows);
    const [u] = await q<Record<string, string>>(
      `select count(*) as total,
              count(*) filter (where role = 'user') as users,
              count(*) filter (where role = 'nutritionist') as nutritionists,
              count(*) filter (where role = 'admin') as admins,
              count(*) filter (where blocked_at is not null) as blocked,
              count(*) filter (where created_at > now() - interval '7 days') as new_week,
              count(*) filter (where created_at > now() - interval '1 day') as new_day,
              (select count(distinct user_id) from sessions
               where created_at > now() - interval '7 days') as active_week,
              (select count(distinct user_id) from sessions
               where created_at > now() - interval '1 day') as active_day
       from users`,
    );
    const appointments = await q<{ status: string; n: string }>(
      'select status, count(*) as n from appointments group by status',
    );
    const [content] = await q<Record<string, string>>(
      `select (select count(*) from posts) as posts,
              (select count(*) from posts where visibility = 'public' and status = 'published') as public_posts,
              (select count(*) from posts where status = 'pending') as pending,
              (select count(*) from posts where status = 'removed') as removed,
              (select count(distinct post_id) from post_reports where resolved_at is null) as reported,
              (select count(*) from posts where created_at > now() - interval '7 days') as posts_week,
              (select coalesce(sum(like_count), 0) from posts) as post_likes,
              (select count(*) from blog_posts where status = 'published') as articles,
              (select count(*) from blog_posts where status = 'draft') as drafts,
              (select coalesce(sum(view_count), 0) from blog_posts) as article_views,
              (select coalesce(sum(like_count), 0) from blog_posts) as article_likes`,
    );
    const ai = await q<{ kind: string; day: string; week: string }>(
      `select kind,
              count(*) filter (where created_at > now() - interval '1 day') as day,
              count(*) filter (where created_at > now() - interval '7 days') as week
       from ai_usage group by kind`,
    );
    const moderation = await q<{ verdict: string; n: string }>(
      `select verdict, count(*) as n from moderation_events
       where created_at > now() - interval '7 days' group by verdict`,
    );
    const rejectReasons = await q<{ reason: string; n: string }>(
      `select reason, count(*) as n from moderation_events
       where verdict = 'rejected' and created_at > now() - interval '30 days'
       group by reason order by n desc`,
    );
    // Ultimele 14 zile (ora Moldovei): conturi noi si conturi active pe zi.
    const series = await q<{ day: string; signups: string; active: string }>(
      `select to_char(d, 'YYYY-MM-DD') as day,
              (select count(*) from users
               where (created_at at time zone 'Europe/Chisinau')::date = d) as signups,
              (select count(distinct user_id) from sessions
               where (created_at at time zone 'Europe/Chisinau')::date = d) as active
       from generate_series(
         (now() at time zone 'Europe/Chisinau')::date - 13,
         (now() at time zone 'Europe/Chisinau')::date, interval '1 day') as d
       order by d`,
    );
    const topArticles = await q<{
      id: string;
      title: string;
      view_count: number;
      like_count: number;
    }>(
      `select id, title, view_count, like_count from blog_posts where status = 'published'
       order by view_count desc, like_count desc limit 5`,
    );

    const n = (v: string | undefined) => Number(v ?? 0);
    const byStatus = Object.fromEntries(appointments.map((r) => [r.status, Number(r.n)]));
    const aiBy = (kind: string) => ai.find((r) => r.kind === kind);
    const modBy = Object.fromEntries(moderation.map((r) => [r.verdict, Number(r.n)]));
    return {
      users: {
        total: n(u.total),
        users: n(u.users),
        nutritionists: n(u.nutritionists),
        admins: n(u.admins),
        blocked: n(u.blocked),
        newToday: n(u.new_day),
        newThisWeek: n(u.new_week),
        activeToday: n(u.active_day),
        activeThisWeek: n(u.active_week),
      },
      appointments: {
        requested: byStatus.requested ?? 0,
        confirmed: byStatus.confirmed ?? 0,
        rejected: byStatus.rejected ?? 0,
        cancelled: byStatus.cancelled ?? 0,
      },
      content: {
        posts: n(content.posts),
        publicPosts: n(content.public_posts),
        pending: n(content.pending),
        removed: n(content.removed),
        reported: n(content.reported),
        postsThisWeek: n(content.posts_week),
        postLikes: n(content.post_likes),
        articles: n(content.articles),
        drafts: n(content.drafts),
        articleViews: n(content.article_views),
        articleLikes: n(content.article_likes),
      },
      ai: {
        chatToday: n(aiBy('chat')?.day),
        chatWeek: n(aiBy('chat')?.week),
        photoToday: n(aiBy('photo')?.day),
        photoWeek: n(aiBy('photo')?.week),
      },
      moderation: {
        approved: modBy.approved ?? 0,
        rejected: modBy.rejected ?? 0,
        pending: modBy.pending ?? 0,
        reasons: rejectReasons.map((r) => ({ reason: r.reason, count: Number(r.n) })),
      },
      series: series.map((r) => ({ day: r.day, signups: n(r.signups), active: n(r.active) })),
      topArticles: topArticles.map((a) => ({
        id: a.id,
        title: a.title,
        views: a.view_count,
        likes: a.like_count,
      })),
    };
  }

  // ------------------------------------------------------------- conturi

  async users(query: { q?: string; role?: Role; status?: 'active' | 'blocked'; page?: number }) {
    const pageSize = 30;
    const page = Math.max(0, query.page ?? 0);
    const { rows } = await this.db.auth.query<UserRow & { total: string }>(
      `select ${USER_COLUMNS}, count(*) over () as total
       from users u left join social_profiles sp on sp.user_id = u.id
       where ($1::text is null or u.email ilike '%' || $1 || '%' or sp.display_name ilike '%' || $1 || '%')
         and ($2::text is null or u.role = $2)
         and ($3::text is null or ($3 = 'blocked') = (u.blocked_at is not null))
       order by u.created_at desc
       limit $4 offset $5`,
      [
        query.q?.trim() || null,
        query.role ?? null,
        query.status ?? null,
        pageSize,
        page * pageSize,
      ],
    );
    return {
      total: Number(rows[0]?.total ?? 0),
      page,
      pageSize,
      items: rows.map(toAdminUser),
    };
  }

  /** Fisa contului: activitatea si continutul (fara datele de sanatate). */
  async userDetail(userId: string) {
    const user = await this.findUser(userId);
    const { rows } = await this.db.auth.query<Record<string, string>>(
      `select (select count(*) from sessions where user_id = $1 and expires_at > now()) as sessions,
              (select count(*) from posts where user_id = $1) as posts,
              (select count(*) from posts where user_id = $1 and visibility = 'public') as public_posts,
              (select count(*) from posts where user_id = $1 and status = 'removed') as removed_posts,
              (select count(*) from post_reports r join posts p on p.id = r.post_id
               where p.user_id = $1) as reports_against,
              (select count(*) from post_reports where reporter_id = $1) as reports_made,
              (select count(*) from moderation_events where user_id = $1 and verdict = 'rejected') as rejected_uploads,
              (select count(*) from blog_posts where author_id = $1) as articles,
              (select count(*) from ai_usage where user_id = $1 and kind = 'chat'
               and created_at > now() - interval '7 days') as ai_chat,
              (select count(*) from ai_usage where user_id = $1 and kind = 'photo'
               and created_at > now() - interval '7 days') as ai_photo,
              (select count(*) from appointments where user_id = $1 or nutritionist_id = $1) as appointments,
              (select failed_logins from users where id = $1) as failed_logins,
              (select locked_until from users where id = $1) as locked_until`,
      [userId],
    );
    const r = rows[0];
    return {
      user,
      activity: {
        activeSessions: Number(r.sessions),
        posts: Number(r.posts),
        publicPosts: Number(r.public_posts),
        removedPosts: Number(r.removed_posts),
        reportsAgainst: Number(r.reports_against),
        reportsMade: Number(r.reports_made),
        rejectedUploads: Number(r.rejected_uploads),
        articles: Number(r.articles),
        aiChatWeek: Number(r.ai_chat),
        aiPhotoWeek: Number(r.ai_photo),
        appointments: Number(r.appointments),
        failedLogins: Number(r.failed_logins),
        lockedUntil: r.locked_until ? new Date(r.locked_until).toISOString() : null,
      },
    };
  }

  async setRole(adminId: string, userId: string, role: Role): Promise<AdminUser> {
    if (adminId === userId) throw new BadRequestException('Nu iti poti schimba propriul rol.');
    const before = await this.findUser(userId);
    await this.db.auth.query('update users set role = $2 where id = $1', [userId, role]);
    if (role === 'nutritionist') {
      // Profilul public al nutritionistului, completat apoi de acesta in panoul propriu.
      await this.db.asUser(userId, (c) =>
        c.query(
          `insert into nutritionist_profiles (user_id, display_name) values (app_user_id(), $1)
           on conflict do nothing`,
          [(before.displayName ?? before.email.split('@')[0]).slice(0, 80).padEnd(2, '_')],
        ),
      );
    }
    await this.log(adminId, 'role_changed', userId, { from: before.role, to: role });
    return this.findUser(userId);
  }

  async block(adminId: string, userId: string, reason: string): Promise<AdminUser> {
    if (adminId === userId) throw new BadRequestException('Nu iti poti bloca propriul cont.');
    await this.findUser(userId);
    await this.db.auth.query(
      'update users set blocked_at = now(), blocked_reason = $2 where id = $1',
      [userId, reason.trim()],
    );
    // Sesiunile active sunt inchise imediat.
    await this.db.auth.query('delete from sessions where user_id = $1', [userId]);
    await this.log(adminId, 'account_blocked', userId, { reason: reason.trim() });
    return this.findUser(userId);
  }

  async unblock(adminId: string, userId: string): Promise<AdminUser> {
    await this.findUser(userId);
    await this.db.auth.query(
      `update users set blocked_at = null, blocked_reason = null, failed_logins = 0,
         locked_until = null
       where id = $1`,
      [userId],
    );
    await this.log(adminId, 'account_unblocked', userId);
    return this.findUser(userId);
  }

  /** Deconecteaza contul de pe toate dispozitivele (de exemplu dupa o suspiciune de acces). */
  async logoutEverywhere(adminId: string, userId: string): Promise<{ closed: number }> {
    await this.findUser(userId);
    const { rowCount } = await this.db.auth.query('delete from sessions where user_id = $1', [
      userId,
    ]);
    await this.log(adminId, 'sessions_revoked', userId, { closed: rowCount ?? 0 });
    return { closed: rowCount ?? 0 };
  }

  /** Ridica blocarea temporara dupa prea multe parole gresite. */
  async unlockLogin(adminId: string, userId: string): Promise<AdminUser> {
    await this.findUser(userId);
    await this.db.auth.query(
      'update users set failed_logins = 0, locked_until = null where id = $1',
      [userId],
    );
    await this.log(adminId, 'login_unlocked', userId);
    return this.findUser(userId);
  }

  // ------------------------------------------------------------- moderare

  async moderationQueue(filter: ModerationFilter, cursorText?: string) {
    const cursor = parseCursor(cursorText);
    const { rows } = await this.db.auth.query<{
      id: string;
      user_id: string;
      media_id: string | null;
      kind: string;
      caption: string;
      visibility: string;
      status: string;
      moderation: Record<string, unknown>;
      removed_reason: string | null;
      like_count: number;
      created_at: Date;
      email: string;
      display_name: string | null;
      reports: { reason: string; note: string; createdAt: string }[] | null;
    }>(
      `select p.id, p.user_id, p.media_id, p.kind, p.caption, p.visibility, p.status, p.moderation,
              p.removed_reason, p.like_count, p.created_at, u.email, sp.display_name,
              (select json_agg(json_build_object('reason', r.reason, 'note', r.note,
                        'createdAt', r.created_at) order by r.created_at desc)
               from post_reports r where r.post_id = p.id and r.resolved_at is null) as reports
       from posts p
       join users u on u.id = p.user_id
       left join social_profiles sp on sp.user_id = p.user_id
       where (case $1
                when 'pending' then p.status = 'pending'
                when 'reported' then exists (select 1 from post_reports r
                                             where r.post_id = p.id and r.resolved_at is null)
                when 'removed' then p.status = 'removed'
                else p.visibility = 'public' end)
         and ($2::timestamptz is null or (p.created_at, p.id) < ($2::timestamptz, $3::uuid))
       order by p.created_at desc, p.id desc
       limit ${MODERATION_PAGE}`,
      [filter, cursor?.at ?? null, cursor?.id ?? null],
    );
    const items = rows.map((r) => ({
      id: r.id,
      author: { id: r.user_id, email: r.email, name: r.display_name ?? r.email.split('@')[0] },
      mediaId: r.media_id,
      kind: r.kind,
      caption: r.caption,
      visibility: r.visibility,
      status: r.status,
      moderation: r.moderation,
      removedReason: r.removed_reason,
      likeCount: r.like_count,
      reports: r.reports ?? [],
      createdAt: r.created_at.toISOString(),
    }));
    const last = items.at(-1);
    return {
      items,
      nextCursor: items.length === MODERATION_PAGE && last ? `${last.createdAt}|${last.id}` : null,
    };
  }

  async approvePost(adminId: string, postId: string) {
    const post = await this.findPost(postId);
    await this.db.auth.query(
      `update posts set status = 'published', removed_reason = null where id = $1`,
      [postId],
    );
    await this.resolveReports(postId);
    await this.log(adminId, 'post_approved', post.user_id, { postId });
    if (post.status !== 'published') await this.community.notifyAuthor(postId, 'post_approved');
  }

  async removePost(adminId: string, postId: string, reason: string) {
    const post = await this.findPost(postId);
    await this.db.auth.query(
      `update posts set status = 'removed', removed_reason = $2 where id = $1`,
      [postId, reason.trim()],
    );
    await this.resolveReports(postId);
    await this.log(adminId, 'post_removed', post.user_id, { postId, reason: reason.trim() });
    await this.community.notifyAuthor(postId, 'post_removed', reason.trim());
  }

  /** Raportarile nu sunt intemeiate: se inchid, iar postarea ascunsa automat revine in lenta. */
  async dismissReports(adminId: string, postId: string) {
    const post = await this.findPost(postId);
    await this.resolveReports(postId);
    if (post.status === 'pending' && post.moderation?.verdict === 'approved') {
      await this.db.auth.query(`update posts set status = 'published' where id = $1`, [postId]);
    }
    await this.log(adminId, 'reports_dismissed', post.user_id, { postId });
  }

  async deletePost(adminId: string, postId: string) {
    const post = await this.findPost(postId);
    // Fotografia sterge si postarea (cascada); sfaturile text nu au fotografie.
    if (post.media_id) {
      await this.db.auth.query('delete from media where id = $1', [post.media_id]);
    } else {
      await this.db.auth.query('delete from posts where id = $1', [postId]);
    }
    await this.log(adminId, 'post_deleted', post.user_id, { postId });
  }

  private async resolveReports(postId: string) {
    await this.db.auth.query(
      'update post_reports set resolved_at = now() where post_id = $1 and resolved_at is null',
      [postId],
    );
  }

  private async findPost(postId: string) {
    const { rows } = await this.db.auth.query<{
      user_id: string;
      media_id: string | null;
      status: string;
      moderation: { verdict?: string } | null;
    }>('select user_id, media_id, status, moderation from posts where id = $1', [postId]);
    if (!rows[0]) throw new NotFoundException('Postarea nu exista.');
    return rows[0];
  }

  // ------------------------------------------------------------- blog

  /** Toate articolele (ciorne, publicate, arhivate), de la toti autorii. */
  articles(adminId: string, cursor?: string) {
    return this.blog.authored(adminId, true, cursor);
  }

  async moderateArticle(
    adminId: string,
    id: string,
    change: { pinned?: boolean; status?: BlogStatus },
  ) {
    await this.blog.moderate(id, change);
    await this.log(adminId, 'article_changed', null, { articleId: id, ...change });
  }

  async deleteArticle(adminId: string, id: string) {
    const article = await this.blog.editable(adminId, 'admin', id);
    await this.blog.remove(adminId, 'admin', id);
    await this.log(adminId, 'article_deleted', article.author.id || null, { title: article.title });
  }

  // ------------------------------------------------------------- anunturi

  /** Notificare trimisa tuturor conturilor active (sau unui singur rol). */
  async announce(adminId: string, title: string, body: string, audience: Audience) {
    const { rowCount } = await this.db.auth.query(
      `insert into notifications (user_id, kind, payload)
       select id, 'announcement', $1 from users
       where blocked_at is null and ($2 = 'all' or role = $2)`,
      [JSON.stringify({ title: title.trim(), body: body.trim() }), audience],
    );
    await this.log(adminId, 'announcement', null, {
      title: title.trim(),
      body: body.trim(),
      audience,
      recipients: rowCount ?? 0,
    });
    return { recipients: rowCount ?? 0 };
  }

  // ------------------------------------------------------------- jurnal si parametri

  async auditLog(page = 0, action?: string) {
    const { rows } = await this.db.auth.query<{
      id: string;
      action: string;
      details: Record<string, unknown>;
      created_at: Date;
      admin_email: string | null;
      target_email: string | null;
    }>(
      `select l.id, l.action, l.details, l.created_at,
              a.email as admin_email, t.email as target_email
       from admin_log l
       left join users a on a.id = l.admin_id
       left join users t on t.id = l.target_user_id
       where ($2::text is null or l.action = $2)
       order by l.created_at desc
       limit 50 offset $1`,
      [Math.max(0, page) * 50, action ?? null],
    );
    return rows.map((r) => ({
      id: String(r.id),
      action: r.action,
      details: r.details,
      createdAt: r.created_at.toISOString(),
      adminEmail: r.admin_email,
      targetEmail: r.target_email,
    }));
  }

  settings(): Promise<SystemSettings> {
    return this.settingsService.get();
  }

  async updateSettings(adminId: string, changes: Partial<SystemSettings>): Promise<SystemSettings> {
    const before = await this.settingsService.get();
    const after = await this.settingsService.update(changes);
    const changed = Object.fromEntries(
      (Object.keys(changes) as (keyof SystemSettings)[])
        .filter((k) => changes[k] !== undefined && before[k] !== after[k])
        .map((k) => [k, { from: before[k], to: after[k] }]),
    );
    if (Object.keys(changed).length) await this.log(adminId, 'settings_changed', null, changed);
    return after;
  }

  private async findUser(userId: string): Promise<AdminUser> {
    const { rows } = await this.db.auth.query<UserRow>(
      `select ${USER_COLUMNS} from users u left join social_profiles sp on sp.user_id = u.id
       where u.id = $1`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException('Contul nu a fost gasit.');
    return toAdminUser(rows[0]);
  }

  private async log(
    adminId: string,
    action: string,
    targetUserId: string | null,
    details: Record<string, unknown> = {},
  ) {
    await this.db.auth.query(
      `insert into admin_log (admin_id, action, target_user_id, details) values ($1, $2, $3, $4)`,
      [adminId, action, targetUserId, JSON.stringify(details)],
    );
  }
}

function toAdminUser(r: UserRow): AdminUser {
  return {
    id: r.id,
    email: r.email,
    role: r.role,
    displayName: r.display_name,
    createdAt: r.created_at.toISOString(),
    lastActiveAt: r.last_active?.toISOString() ?? null,
    blockedAt: r.blocked_at?.toISOString() ?? null,
    blockedReason: r.blocked_reason,
  };
}
