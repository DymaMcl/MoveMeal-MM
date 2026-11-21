import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type pg from 'pg';
import { APP_TIME_ZONE } from '../common/dates.js';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export type AppointmentStatus = 'requested' | 'confirmed' | 'rejected' | 'cancelled';

export interface NutritionistCard {
  id: string;
  displayName: string;
  title: string;
  bio: string;
  qualifications: string;
  experienceYears: number;
  services: string;
  priceMdl: number;
  slotMinutes: number;
  /** Fotografia de profil (aceeasi ca in comunitate); null = initialele. */
  avatarId: string | null;
}

export interface Slot {
  startsAt: string;
  /** Ziua si ora locala (Europe/Chisinau). */
  day: string;
  time: string;
}

export interface Appointment {
  id: string;
  userId: string;
  nutritionistId: string;
  nutritionistName: string;
  clientName: string;
  startsAt: string;
  day: string;
  time: string;
  durationMin: number;
  status: AppointmentStatus;
  free: boolean;
  userNote: string;
  nutritionistNote: string;
  /** Consultatia a avut deja loc (sau intervalul a trecut). */
  past: boolean;
}

/** Cu cat timp inainte se poate solicita cel mai tarziu o programare. */
const MIN_NOTICE_HOURS = 2;
export const BOOKING_DAYS = 21;

const ACTIVE = `('requested', 'confirmed')`;

export const APPOINTMENT_COLUMNS = `
  a.id, a.user_id, a.nutritionist_id, coalesce(np.display_name, '') as nutritionist_name,
  a.client_name, a.starts_at, a.duration_min, a.status, a.free, a.user_note, a.nutritionist_note,
  to_char(a.starts_at at time zone '${APP_TIME_ZONE}', 'YYYY-MM-DD') as day,
  to_char(a.starts_at at time zone '${APP_TIME_ZONE}', 'HH24:MI') as time,
  a.starts_at + make_interval(mins => a.duration_min) < now() as past`;

export const APPOINTMENT_FROM = `
  appointments a left join nutritionist_profiles np on np.user_id = a.nutritionist_id`;

interface AppointmentRow {
  id: string;
  user_id: string;
  nutritionist_id: string;
  nutritionist_name: string;
  client_name: string;
  starts_at: Date;
  duration_min: number;
  status: AppointmentStatus;
  free: boolean;
  user_note: string;
  nutritionist_note: string;
  day: string;
  time: string;
  past: boolean;
}

export function toAppointment(r: AppointmentRow): Appointment {
  return {
    id: r.id,
    userId: r.user_id,
    nutritionistId: r.nutritionist_id,
    nutritionistName: r.nutritionist_name,
    clientName: r.client_name,
    startsAt: r.starts_at.toISOString(),
    day: r.day,
    time: r.time,
    durationMin: r.duration_min,
    status: r.status,
    free: r.free,
    userNote: r.user_note,
    nutritionistNote: r.nutritionist_note,
    past: r.past,
  };
}

interface NutritionistRow {
  user_id: string;
  display_name: string;
  title: string;
  bio: string;
  qualifications: string;
  experience_years: number;
  services: string;
  price_mdl: number;
  slot_minutes: number;
  avatar_id?: string | null;
}

export function toNutritionist(r: NutritionistRow): NutritionistCard {
  return {
    id: r.user_id,
    displayName: r.display_name,
    title: r.title,
    bio: r.bio,
    qualifications: r.qualifications,
    experienceYears: r.experience_years,
    services: r.services,
    priceMdl: r.price_mdl,
    slotMinutes: r.slot_minutes,
    avatarId: r.avatar_id ?? null,
  };
}

@Injectable()
export class ConsultationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  // ------------------------------------------------------------------ nutritionisti

  /** Nutritionistii activi (rolul este verificat in tabela conturilor). */
  async nutritionists(): Promise<NutritionistCard[]> {
    const { rows } = await this.db.auth.query<NutritionistRow>(
      `select np.*, sp.avatar_media_id as avatar_id from nutritionist_profiles np
       join users u on u.id = np.user_id
       left join social_profiles sp on sp.user_id = np.user_id
       where u.role = 'nutritionist' and u.blocked_at is null
       order by np.display_name`,
    );
    return rows.map(toNutritionist);
  }

  async nutritionist(id: string): Promise<NutritionistCard> {
    const found = (await this.nutritionists()).find((n) => n.id === id);
    if (!found) throw new NotFoundException('Nutritionistul nu a fost gasit.');
    return found;
  }

  /**
   * Intervalele libere din urmatoarele zile, calculate din programul saptamanal, zilele libere
   * si programarile active (fara a dezvalui cine le-a facut).
   */
  async slotsIn(
    c: pg.PoolClient,
    nutritionistId: string,
    slotMinutes: number,
    days = BOOKING_DAYS,
  ): Promise<Slot[]> {
    const { rows } = await c.query<{ starts_at: Date; day: string; time: string }>(
      `with days as (
         select ((now() at time zone '${APP_TIME_ZONE}')::date + i) as day
         from generate_series(0, $2::int - 1) i
       ),
       busy as (
         select * from nutritionist_busy($1, now(), now() + make_interval(days => $2::int + 1))
       ),
       candidates as (
         select g.ts at time zone '${APP_TIME_ZONE}' as starts_at,
                to_char(g.ts, 'YYYY-MM-DD') as day, to_char(g.ts, 'HH24:MI') as time
         from days d
         join nutritionist_hours h
           on h.nutritionist_id = $1 and h.weekday = extract(isodow from d.day)::int - 1
         cross join lateral generate_series(
           d.day + h.start_time,
           d.day + h.end_time - make_interval(mins => $3::int),
           make_interval(mins => $3::int)
         ) g(ts)
         where not exists (
           select 1 from nutritionist_days_off o where o.nutritionist_id = $1 and o.day = d.day
         )
       )
       select distinct c.starts_at, c.day, c.time from candidates c
       where c.starts_at > now() + make_interval(hours => $4::int)
         and not exists (
           select 1 from busy b
           where b.starts_at < c.starts_at + make_interval(mins => $3::int)
             and b.starts_at + make_interval(mins => b.duration_min) > c.starts_at
         )
       order by c.starts_at`,
      [nutritionistId, days, slotMinutes, MIN_NOTICE_HOURS],
    );
    return rows.map((r) => ({ startsAt: r.starts_at.toISOString(), day: r.day, time: r.time }));
  }

  async slots(userId: string, nutritionistId: string): Promise<Slot[]> {
    const n = await this.nutritionist(nutritionistId);
    return this.db.asUser(userId, (c) => this.slotsIn(c, n.id, n.slotMinutes));
  }

  // ------------------------------------------------------------------ oferta

  /** Prima consultatie gratuita: valabila un numar de zile de la inregistrare, o singura data. */
  async offer(userId: string) {
    const { rows } = await this.db.auth.query<{ created_at: Date; days: number }>(
      `select u.created_at,
              coalesce((select (value #>> '{}')::int from system_settings
                        where key = 'free_consultation_days'), 30) as days
       from users u where u.id = $1`,
      [userId],
    );
    const { created_at: createdAt, days } = rows[0];
    const expiresAt = new Date(createdAt.getTime() + days * 24 * 3600 * 1000);
    // Oferta este consumata de o programare gratuita solicitata sau confirmata
    // (o programare respinsa sau anulata nu o consuma).
    const used = await this.db.asUser(userId, (c) =>
      c.query(
        `select 1 from appointments where user_id = app_user_id() and free and status in ${ACTIVE}`,
      ),
    );
    const usedFree = (used.rowCount ?? 0) > 0;
    return {
      days,
      expiresAt: expiresAt.toISOString(),
      used: usedFree,
      eligible: !usedFree && expiresAt > new Date(),
    };
  }

  // ------------------------------------------------------------------ programari

  async book(
    userId: string,
    input: { nutritionistId: string; startsAt: string; note?: string; shareData?: boolean },
  ): Promise<Appointment> {
    const n = await this.nutritionist(input.nutritionistId);
    if (n.id === userId) throw new BadRequestException('Nu te poti programa la tine insuti.');
    const offer = await this.offer(userId);
    const requested = new Date(input.startsAt).getTime();

    const appointment = await this.db.asUser(userId, async (c) => {
      const active = await c.query(
        `select 1 from appointments
         where user_id = app_user_id() and status in ${ACTIVE}
           and starts_at + make_interval(mins => duration_min) > now()`,
      );
      if (active.rowCount) {
        throw new ConflictException('Ai deja o programare activa. Anuleaz-o pentru a alege alta.');
      }
      const slots = await this.slotsIn(c, n.id, n.slotMinutes);
      if (!slots.some((s) => new Date(s.startsAt).getTime() === requested)) {
        throw new ConflictException('Intervalul ales nu mai este liber.');
      }
      const profile = await c.query<{ name: string }>(
        'select name from profiles where user_id = app_user_id()',
      );
      const email = await this.db.auth.query<{ email: string }>(
        'select email from users where id = $1',
        [userId],
      );
      const clientName = profile.rows[0]?.name ?? email.rows[0].email.split('@')[0].slice(0, 60);

      let inserted: { id: string };
      try {
        const { rows } = await c.query<{ id: string }>(
          `insert into appointments
             (user_id, nutritionist_id, starts_at, duration_min, free, client_name, user_note)
           values (app_user_id(), $1, $2, $3, $4, $5, $6)
           returning id`,
          [
            n.id,
            new Date(requested),
            n.slotMinutes,
            // Gratuita doar daca oferta este valabila si consultatia are loc pana la termen.
            offer.eligible && requested <= new Date(offer.expiresAt).getTime(),
            clientName,
            (input.note ?? '').trim(),
          ],
        );
        inserted = rows[0];
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new ConflictException('Intervalul ales nu mai este liber.');
        }
        throw error;
      }
      if (input.shareData) {
        await c.query(
          `insert into nutritionist_access (user_id, nutritionist_id) values (app_user_id(), $1)
           on conflict do nothing`,
          [n.id],
        );
      }
      return this.findIn(c, inserted.id);
    });

    await this.notifications.notify(n.id, 'appointment_requested', {
      appointmentId: appointment.id,
      clientName: appointment.clientName,
      day: appointment.day,
      time: appointment.time,
    });
    return appointment;
  }

  async mine(userId: string): Promise<Appointment[]> {
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<AppointmentRow>(
        `select ${APPOINTMENT_COLUMNS} from ${APPOINTMENT_FROM}
         where a.user_id = app_user_id() order by a.starts_at desc limit 50`,
      );
      return rows.map(toAppointment);
    });
  }

  async cancel(userId: string, id: string): Promise<Appointment> {
    const appointment = await this.db.asUser(userId, async (c) => {
      const { rowCount } = await c.query(
        `update appointments set status = 'cancelled', updated_at = now()
         where id = $1 and user_id = app_user_id() and status in ${ACTIVE} and starts_at > now()`,
        [id],
      );
      if (!rowCount) throw new NotFoundException('Programarea nu poate fi anulata.');
      return this.findIn(c, id);
    });
    await this.notifications.notify(appointment.nutritionistId, 'appointment_cancelled', {
      appointmentId: id,
      clientName: appointment.clientName,
      day: appointment.day,
      time: appointment.time,
    });
    return appointment;
  }

  async findIn(c: pg.PoolClient, id: string): Promise<Appointment> {
    const { rows } = await c.query<AppointmentRow>(
      `select ${APPOINTMENT_COLUMNS} from ${APPOINTMENT_FROM} where a.id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Programarea nu a fost gasita.');
    return toAppointment(rows[0]);
  }

  // ------------------------------------------------------------------ acordul de acces

  /** Nutritionistii care au acordul utilizatorului sa ii vada planul si progresul. */
  async access(userId: string): Promise<string[]> {
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{ nutritionist_id: string }>(
        'select nutritionist_id from nutritionist_access where user_id = app_user_id()',
      );
      return rows.map((r) => r.nutritionist_id);
    });
  }

  async setAccess(userId: string, nutritionistId: string, granted: boolean): Promise<string[]> {
    await this.nutritionist(nutritionistId);
    const changed = await this.db.asUser(userId, async (c) => {
      const res = granted
        ? await c.query(
            `insert into nutritionist_access (user_id, nutritionist_id) values (app_user_id(), $1)
             on conflict do nothing`,
            [nutritionistId],
          )
        : await c.query(
            'delete from nutritionist_access where user_id = app_user_id() and nutritionist_id = $1',
            [nutritionistId],
          );
      return (res.rowCount ?? 0) > 0;
    });
    if (changed) {
      await this.notifications.notify(
        nutritionistId,
        granted ? 'access_granted' : 'access_revoked',
      );
    }
    return this.access(userId);
  }
}
