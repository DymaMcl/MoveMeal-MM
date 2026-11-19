import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MIN_CALORIES } from '@movemeal/shared';
import type pg from 'pg';
import { addDaysIso, todayIso } from '../common/dates.js';
import {
  APPOINTMENT_COLUMNS,
  APPOINTMENT_FROM,
  ConsultationsService,
  toAppointment,
  toNutritionist,
  type Appointment,
} from '../consultations/consultations.service.js';
import { DatabaseService } from '../database/database.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NutritionService } from '../nutrition/nutrition.service.js';
import { ProfileService } from '../profile/profile.service.js';
import type { HourDto, NutritionistProfileDto } from './nutritionist.dto.js';

/** Tinta maxima acceptata de baza de date. */
const MAX_CALORIES = 6000;

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

@Injectable()
export class NutritionistService {
  constructor(
    private readonly db: DatabaseService,
    private readonly consultations: ConsultationsService,
    private readonly notifications: NotificationsService,
    private readonly profiles: ProfileService,
    private readonly nutrition: NutritionService,
  ) {}

  // ------------------------------------------------------------------ profil public

  async profile(nutritionistId: string) {
    return this.db.asUser(nutritionistId, (c) => this.profileIn(c, nutritionistId));
  }

  async updateProfile(nutritionistId: string, dto: NutritionistProfileDto) {
    return this.db.asUser(nutritionistId, async (c) => {
      await this.profileIn(c, nutritionistId);
      await c.query(
        `update nutritionist_profiles set
           display_name = $1, title = $2, bio = $3, qualifications = $4, experience_years = $5,
           services = $6, price_mdl = $7, slot_minutes = $8, updated_at = now()
         where user_id = app_user_id()`,
        [
          dto.displayName.trim(),
          dto.title.trim(),
          dto.bio.trim(),
          dto.qualifications.trim(),
          dto.experienceYears,
          dto.services.trim(),
          dto.priceMdl,
          dto.slotMinutes,
        ],
      );
      return this.profileIn(c, nutritionistId);
    });
  }

  /** Profilul public; daca lipseste (rol acordat recent) este creat cu valori implicite. */
  private async profileIn(c: pg.PoolClient, nutritionistId: string) {
    const email = await this.db.auth.query<{ email: string }>(
      'select email from users where id = $1',
      [nutritionistId],
    );
    await c.query(
      `insert into nutritionist_profiles (user_id, display_name) values (app_user_id(), $1)
       on conflict do nothing`,
      [email.rows[0].email.split('@')[0].slice(0, 80).padEnd(2, '_')],
    );
    const { rows } = await c.query(
      'select * from nutritionist_profiles where user_id = app_user_id()',
    );
    return toNutritionist(rows[0]);
  }

  // ------------------------------------------------------------------ program

  async schedule(nutritionistId: string) {
    return this.db.asUser(nutritionistId, async (c) => {
      const hours = await c.query<{ weekday: number; start: string; end: string }>(
        `select weekday, to_char(start_time, 'HH24:MI') as start, to_char(end_time, 'HH24:MI') as end
         from nutritionist_hours where nutritionist_id = app_user_id()
         order by weekday, start_time`,
      );
      const daysOff = await c.query<{ day: string }>(
        `select to_char(day, 'YYYY-MM-DD') as day from nutritionist_days_off
         where nutritionist_id = app_user_id() and day >= $1 order by day`,
        [todayIso()],
      );
      const profile = await this.profileIn(c, nutritionistId);
      const slots = await this.consultations.slotsIn(c, nutritionistId, profile.slotMinutes, 14);
      return {
        hours: hours.rows,
        daysOff: daysOff.rows.map((r) => r.day),
        freeSlots: slots.length,
      };
    });
  }

  async setHours(nutritionistId: string, hours: HourDto[]) {
    for (const h of hours) {
      if (toMinutes(h.end) <= toMinutes(h.start)) {
        throw new BadRequestException('Ora de sfarsit trebuie sa fie dupa ora de inceput.');
      }
    }
    for (let wd = 0; wd < 7; wd++) {
      const day = hours
        .filter((h) => h.weekday === wd)
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
      for (let i = 1; i < day.length; i++) {
        if (toMinutes(day[i].start) < toMinutes(day[i - 1].end)) {
          throw new BadRequestException('Intervalele din aceeasi zi nu se pot suprapune.');
        }
      }
    }
    await this.db.asUser(nutritionistId, async (c) => {
      await c.query('delete from nutritionist_hours where nutritionist_id = app_user_id()');
      for (const h of hours) {
        await c.query(
          `insert into nutritionist_hours (nutritionist_id, weekday, start_time, end_time)
           values (app_user_id(), $1, $2, $3)`,
          [h.weekday, h.start, h.end],
        );
      }
    });
    return this.schedule(nutritionistId);
  }

  async setDayOff(nutritionistId: string, day: string, off: boolean) {
    if (off && day < todayIso()) throw new BadRequestException('Ziua a trecut deja.');
    await this.db.asUser(nutritionistId, (c) =>
      off
        ? c.query(
            `insert into nutritionist_days_off (nutritionist_id, day) values (app_user_id(), $1)
             on conflict do nothing`,
            [day],
          )
        : c.query(
            'delete from nutritionist_days_off where nutritionist_id = app_user_id() and day = $1',
            [day],
          ),
    );
    return this.schedule(nutritionistId);
  }

  // ------------------------------------------------------------------ programari

  async appointments(nutritionistId: string): Promise<Appointment[]> {
    return this.db.asUser(nutritionistId, async (c) => {
      const { rows } = await c.query(
        `select ${APPOINTMENT_COLUMNS} from ${APPOINTMENT_FROM}
         where a.nutritionist_id = app_user_id() and a.starts_at > now() - interval '60 days'
         order by a.starts_at`,
      );
      return rows.map(toAppointment);
    });
  }

  async decide(
    nutritionistId: string,
    id: string,
    action: 'confirm' | 'reject',
    note = '',
  ): Promise<Appointment> {
    const appointment = await this.db.asUser(nutritionistId, async (c) => {
      const allowed = action === 'confirm' ? `('requested')` : `('requested', 'confirmed')`;
      const { rowCount } = await c.query(
        `update appointments set status = $2, nutritionist_note = $3, updated_at = now()
         where id = $1 and nutritionist_id = app_user_id() and status in ${allowed}
           and starts_at > now()`,
        [id, action === 'confirm' ? 'confirmed' : 'rejected', note.trim()],
      );
      if (!rowCount) throw new NotFoundException('Programarea nu poate fi modificata.');
      return this.consultations.findIn(c, id);
    });
    await this.notifications.notify(
      appointment.userId,
      action === 'confirm' ? 'appointment_confirmed' : 'appointment_rejected',
      {
        appointmentId: id,
        day: appointment.day,
        time: appointment.time,
        nutritionistName: appointment.nutritionistName,
        note: appointment.nutritionistNote,
      },
    );
    return appointment;
  }

  /** Muta programarea intr-un alt interval liber; programarea devine confirmata. */
  async reschedule(
    nutritionistId: string,
    id: string,
    startsAt: string,
    note = '',
  ): Promise<Appointment> {
    const target = new Date(startsAt).getTime();
    const { appointment, previous } = await this.db.asUser(nutritionistId, async (c) => {
      const before = await this.consultations.findIn(c, id);
      if (
        before.nutritionistId !== nutritionistId ||
        !['requested', 'confirmed'].includes(before.status) ||
        before.past
      ) {
        throw new NotFoundException('Programarea nu poate fi modificata.');
      }
      const profile = await this.profileIn(c, nutritionistId);
      const slots = await this.consultations.slotsIn(c, nutritionistId, profile.slotMinutes);
      if (!slots.some((s) => new Date(s.startsAt).getTime() === target)) {
        throw new ConflictException('Intervalul ales nu este liber.');
      }
      await c.query(
        `update appointments set starts_at = $2, duration_min = $3, status = 'confirmed',
           nutritionist_note = $4, updated_at = now()
         where id = $1`,
        [id, new Date(target), profile.slotMinutes, note.trim()],
      );
      return { appointment: await this.consultations.findIn(c, id), previous: before };
    });
    await this.notifications.notify(appointment.userId, 'appointment_rescheduled', {
      appointmentId: id,
      day: appointment.day,
      time: appointment.time,
      previousDay: previous.day,
      previousTime: previous.time,
      nutritionistName: appointment.nutritionistName,
      note: appointment.nutritionistNote,
    });
    return appointment;
  }

  /** Intervalele libere proprii (pentru reprogramare). */
  async freeSlots(nutritionistId: string) {
    return this.db.asUser(nutritionistId, async (c) => {
      const profile = await this.profileIn(c, nutritionistId);
      return this.consultations.slotsIn(c, nutritionistId, profile.slotMinutes);
    });
  }

  // ------------------------------------------------------------------ clienti (cu acord)

  /** Clientii care si-au dat acordul; datele lor sunt filtrate de politicile RLS. */
  async clients(nutritionistId: string) {
    return this.db.asUser(nutritionistId, async (c) => {
      const { rows } = await c.query<{
        user_id: string;
        granted_at: Date;
        name: string | null;
        goal: string | null;
        weight_kg: number | null;
        last_weigh_in: string | null;
      }>(
        `select a.user_id, a.granted_at, p.name, p.goal, p.weight_kg,
                (select to_char(max(m.day), 'YYYY-MM-DD') from body_measurements m
                 where m.user_id = a.user_id) as last_weigh_in
         from nutritionist_access a
         left join profiles p on p.user_id = a.user_id
         where a.nutritionist_id = app_user_id()
         order by p.name nulls last`,
      );
      return rows.map((r) => ({
        id: r.user_id,
        name: r.name ?? '—',
        goal: r.goal,
        weightKg: r.weight_kg,
        lastWeighIn: r.last_weigh_in,
        grantedAt: r.granted_at.toISOString(),
      }));
    });
  }

  async client(nutritionistId: string, clientId: string) {
    return this.db.asUser(nutritionistId, async (c) => {
      const current = await this.requireClient(c, clientId);
      const today = todayIso();
      const weights = await c.query<{ day: string; weight_kg: number }>(
        `select to_char(day, 'YYYY-MM-DD') as day, weight_kg from body_measurements
         where user_id = $1 and day >= $2 order by day`,
        [clientId, addDaysIso(today, -55)],
      );
      const log = await c.query<{ day: string; kcal: number; protein: number }>(
        `select to_char(day, 'YYYY-MM-DD') as day, round(sum(kcal)) as kcal,
                round(sum(protein)) as protein
         from food_log where user_id = $1 and day between $2 and $3
         group by day order by day`,
        [clientId, addDaysIso(today, -6), today],
      );
      const program = await c.query<{
        preferences: { diet?: string; allergens?: string[] };
        target_kcal: number | null;
        nutritionist_adjusted_at: Date | null;
      }>(
        `select preferences, (plan ->> 'targetKcal')::int as target_kcal, nutritionist_adjusted_at
         from nutrition_programs where user_id = $1`,
        [clientId],
      );
      const appointments = await c.query(
        `select ${APPOINTMENT_COLUMNS} from ${APPOINTMENT_FROM}
         where a.nutritionist_id = app_user_id() and a.user_id = $1
         order by a.starts_at desc limit 10`,
        [clientId],
      );
      const p = program.rows[0];
      return {
        id: clientId,
        profile: current.profile,
        plan: current.plan,
        adjustedBy: current.adjustedBy,
        nutritionistNote: current.nutritionistNote,
        minCalories: MIN_CALORIES[current.profile.sex],
        maxCalories: MAX_CALORIES,
        weights: weights.rows.map((w) => ({ day: w.day, weightKg: w.weight_kg })),
        foodLog: log.rows.map((l) => ({
          day: l.day,
          kcal: Number(l.kcal),
          protein: Number(l.protein),
        })),
        mealPlan: p
          ? {
              diet: p.preferences.diet ?? null,
              allergens: p.preferences.allergens ?? [],
              targetKcal: p.target_kcal,
              adjustedAt: p.nutritionist_adjusted_at?.toISOString() ?? null,
            }
          : null,
        appointments: appointments.rows.map(toAppointment),
      };
    });
  }

  /**
   * Stabileste tinta calorica a clientului (sau revine la calculul automat cu null) si
   * regenereaza planul alimentar; modificarea apare in contul clientului marcata
   * „ajustat de nutritionist”.
   */
  async adjustClient(
    nutritionistId: string,
    clientId: string,
    input: { calorieTarget: number | null; note: string },
  ) {
    await this.db.asUser(nutritionistId, async (c) => {
      const current = await this.requireClient(c, clientId);
      const min = MIN_CALORIES[current.profile.sex];
      if (
        input.calorieTarget !== null &&
        (input.calorieTarget < min || input.calorieTarget > MAX_CALORIES)
      ) {
        throw new BadRequestException(
          `Tinta trebuie sa fie intre ${min} si ${MAX_CALORIES} kcal (limita de siguranta).`,
        );
      }
      await c.query(
        `update profiles set
           calorie_target = $2,
           calorie_target_by = case when $2::int is null then null else 'nutritionist' end,
           nutritionist_note = nullif($3, ''), nutritionist_adjusted_at = now(), updated_at = now()
         where user_id = $1`,
        [clientId, input.calorieTarget, input.note.trim()],
      );
      await this.nutrition.regenerateFor(c, clientId);
    });
    const { rows } = await this.db.auth.query<{ display_name: string }>(
      'select display_name from nutritionist_profiles where user_id = $1',
      [nutritionistId],
    );
    await this.notifications.notify(clientId, 'plan_adjusted', {
      calorieTarget: input.calorieTarget,
      note: input.note.trim(),
      nutritionistName: rows[0]?.display_name ?? '',
    });
    return this.client(nutritionistId, clientId);
  }

  private async requireClient(c: pg.PoolClient, clientId: string) {
    const current = await this.profiles.currentIn(c, clientId);
    if (!current) {
      throw new NotFoundException('Clientul nu ti-a dat acordul sau nu are profil completat.');
    }
    return current;
  }
}
