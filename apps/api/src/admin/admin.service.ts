import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Role } from '../auth/auth.service.js';
import { DatabaseService } from '../database/database.service.js';

export interface AdminUser {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  blockedAt: string | null;
  blockedReason: string | null;
}

export interface AdminSettings {
  freeConsultationDays: number;
}

/**
 * Panoul administratorului. Administratorul gestioneaza conturile, rolurile si parametrii,
 * dar nu are acces la datele personale (profil, jurnal, masuratori) ale utilizatorilor.
 */
@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  async stats() {
    const users = await this.db.auth.query<{
      total: string;
      users: string;
      nutritionists: string;
      admins: string;
      blocked: string;
      new_week: string;
      active_week: string;
    }>(
      `select count(*) as total,
              count(*) filter (where role = 'user') as users,
              count(*) filter (where role = 'nutritionist') as nutritionists,
              count(*) filter (where role = 'admin') as admins,
              count(*) filter (where blocked_at is not null) as blocked,
              count(*) filter (where created_at > now() - interval '7 days') as new_week,
              (select count(distinct user_id) from sessions
               where created_at > now() - interval '7 days') as active_week
       from users`,
    );
    const appointments = await this.db.auth.query<{ status: string; n: string }>(
      `select status, count(*) as n from appointments group by status`,
    );
    const u = users.rows[0];
    const byStatus = Object.fromEntries(appointments.rows.map((r) => [r.status, Number(r.n)]));
    return {
      users: {
        total: Number(u.total),
        users: Number(u.users),
        nutritionists: Number(u.nutritionists),
        admins: Number(u.admins),
        blocked: Number(u.blocked),
        newThisWeek: Number(u.new_week),
        activeThisWeek: Number(u.active_week),
      },
      appointments: {
        requested: byStatus.requested ?? 0,
        confirmed: byStatus.confirmed ?? 0,
        rejected: byStatus.rejected ?? 0,
        cancelled: byStatus.cancelled ?? 0,
      },
    };
  }

  async users(query: { q?: string; role?: Role; page?: number }) {
    const pageSize = 30;
    const page = Math.max(0, query.page ?? 0);
    const { rows } = await this.db.auth.query<{
      id: string;
      email: string;
      role: Role;
      created_at: Date;
      blocked_at: Date | null;
      blocked_reason: string | null;
      total: string;
    }>(
      `select id, email, role, created_at, blocked_at, blocked_reason, count(*) over () as total
       from users
       where ($1::text is null or email ilike '%' || $1 || '%')
         and ($2::text is null or role = $2)
       order by created_at desc
       limit $3 offset $4`,
      [query.q?.trim() || null, query.role ?? null, pageSize, page * pageSize],
    );
    return {
      total: Number(rows[0]?.total ?? 0),
      page,
      pageSize,
      items: rows.map(toAdminUser),
    };
  }

  async setRole(adminId: string, userId: string, role: Role): Promise<AdminUser> {
    if (adminId === userId) throw new BadRequestException('Nu iti poti schimba propriul rol.');
    const before = await this.find(userId);
    const { rows } = await this.db.auth.query(
      `update users set role = $2 where id = $1
       returning id, email, role, created_at, blocked_at, blocked_reason`,
      [userId, role],
    );
    if (role === 'nutritionist') {
      // Profilul public al nutritionistului, completat apoi de acesta in panoul propriu.
      await this.db.asUser(userId, (c) =>
        c.query(
          `insert into nutritionist_profiles (user_id, display_name) values (app_user_id(), $1)
           on conflict do nothing`,
          [before.email.split('@')[0].slice(0, 80).padEnd(2, '_')],
        ),
      );
    }
    await this.log(adminId, 'role_changed', userId, { from: before.role, to: role });
    return toAdminUser(rows[0]);
  }

  async block(adminId: string, userId: string, reason: string): Promise<AdminUser> {
    if (adminId === userId) throw new BadRequestException('Nu iti poti bloca propriul cont.');
    await this.find(userId);
    const { rows } = await this.db.auth.query(
      `update users set blocked_at = now(), blocked_reason = $2 where id = $1
       returning id, email, role, created_at, blocked_at, blocked_reason`,
      [userId, reason.trim()],
    );
    // Sesiunile active sunt inchise imediat.
    await this.db.auth.query('delete from sessions where user_id = $1', [userId]);
    await this.log(adminId, 'account_blocked', userId, { reason: reason.trim() });
    return toAdminUser(rows[0]);
  }

  async unblock(adminId: string, userId: string): Promise<AdminUser> {
    await this.find(userId);
    const { rows } = await this.db.auth.query(
      `update users set blocked_at = null, blocked_reason = null, failed_logins = 0,
         locked_until = null
       where id = $1
       returning id, email, role, created_at, blocked_at, blocked_reason`,
      [userId],
    );
    await this.log(adminId, 'account_unblocked', userId);
    return toAdminUser(rows[0]);
  }

  async auditLog(page = 0) {
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
       order by l.created_at desc
       limit 50 offset $1`,
      [Math.max(0, page) * 50],
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

  async settings(): Promise<AdminSettings> {
    const { rows } = await this.db.auth.query<{ key: string; value: unknown }>(
      'select key, value from system_settings',
    );
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { freeConsultationDays: Number(map.free_consultation_days ?? 30) };
  }

  async updateSettings(adminId: string, settings: AdminSettings): Promise<AdminSettings> {
    const before = await this.settings();
    await this.db.auth.query(
      `insert into system_settings (key, value) values ('free_consultation_days', $1)
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [JSON.stringify(settings.freeConsultationDays)],
    );
    await this.log(adminId, 'settings_changed', null, { before, after: settings });
    return this.settings();
  }

  private async find(userId: string) {
    const { rows } = await this.db.auth.query<{ email: string; role: Role }>(
      'select email, role from users where id = $1',
      [userId],
    );
    if (!rows[0]) throw new NotFoundException('Contul nu a fost gasit.');
    return rows[0];
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

function toAdminUser(r: {
  id: string;
  email: string;
  role: Role;
  created_at: Date;
  blocked_at: Date | null;
  blocked_reason: string | null;
}): AdminUser {
  return {
    id: r.id,
    email: r.email,
    role: r.role,
    createdAt: r.created_at.toISOString(),
    blockedAt: r.blocked_at?.toISOString() ?? null,
    blockedReason: r.blocked_reason,
  };
}
