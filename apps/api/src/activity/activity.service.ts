import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import {
  activityKcal,
  fastingBlock,
  getActivity,
  getFastingPlan,
  MAX_FAST_HOURS,
  stepsKcal,
  workoutKcal,
  type ActivityId,
  type FastingBlock,
  type FastingPlanId,
  type LossApproach,
} from '@movemeal/shared';
import type pg from 'pg';
import { addDaysIso, isEditableDay, todayIso } from '../common/dates.js';
import { DatabaseService } from '../database/database.service.js';
import { TrophiesService } from '../engagement/trophies.service.js';
import { ProfileService } from '../profile/profile.service.js';
import type { ActivityDto, FastingStartDto } from './activity.dto.js';

export interface ActivityEntry {
  id: string;
  activityId: ActivityId;
  minutes: number;
  kcal: number;
}

export interface ActivityDay {
  day: string;
  items: ActivityEntry[];
  steps: number;
  stepsKcal: number;
  workoutExercises: number;
  workoutKcal: number;
  /** Toate caloriile arse in plus fata de activitatea obisnuita. */
  totalKcal: number;
  /** Arderea zilnica propusa prin abordarea slabirii (0 daca nu e cazul). */
  goalKcal: number;
  lossApproach: LossApproach | null;
  /** Arderea totala in ultimele 7 zile (pentru grafic). */
  week: { day: string; kcal: number }[];
}

export interface FastingSession {
  id: string;
  planId: FastingPlanId;
  plannedHours: number;
  startedAt: string;
  endedAt: string | null;
  /** Postul a atins durata planificata. */
  completed: boolean;
}

interface FastingRow {
  id: string;
  plan_id: FastingPlanId;
  planned_hours: number;
  started_at: Date;
  ended_at: Date | null;
}

const HOUR = 3_600_000;

function activityError(status: number, code: string, message: string) {
  return new HttpException({ statusCode: status, code, message }, status);
}
const FASTING_COLUMNS = 'id, plan_id, planned_hours, started_at, ended_at';

function toSession(row: FastingRow): FastingSession {
  const end = row.ended_at;
  return {
    id: row.id,
    planId: row.plan_id,
    plannedHours: row.planned_hours,
    startedAt: row.started_at.toISOString(),
    endedAt: end ? end.toISOString() : null,
    completed: end !== null && end.getTime() - row.started_at.getTime() >= row.planned_hours * HOUR,
  };
}

@Injectable()
export class ActivityService {
  constructor(
    private readonly db: DatabaseService,
    private readonly profiles: ProfileService,
    private readonly trophies: TrophiesService,
  ) {}

  private async energyIn(c: pg.PoolClient) {
    const current = await this.profiles.currentIn(c);
    if (!current) throw new NotFoundException('Profilul nu a fost completat.');
    return current;
  }

  /** Arderea unei zile: activitati, pasi peste pragul obisnuit si antrenamentul bifat. */
  async day(userId: string, day = todayIso()): Promise<ActivityDay> {
    return this.db.asUser(userId, async (c) => {
      const { profile, plan } = await this.energyIn(c);
      const from = addDaysIso(day, -6);
      const items = await c.query<{
        id: string;
        day: string;
        activity_id: ActivityId;
        minutes: number;
        kcal: number;
      }>(
        `select id, to_char(day, 'YYYY-MM-DD') as day, activity_id, minutes, kcal from activity_log
         where user_id = app_user_id() and day between $1 and $2 order by created_at`,
        [from, day],
      );
      const steps = await c.query<{ day: string; steps: number }>(
        `select to_char(day, 'YYYY-MM-DD') as day, steps from steps_log
         where user_id = app_user_id() and day between $1 and $2`,
        [from, day],
      );
      const workouts = await c.query<{ day: string; n: number }>(
        `select to_char(day, 'YYYY-MM-DD') as day, count(*)::int as n from workout_logs
         where user_id = app_user_id() and day between $1 and $2 group by day`,
        [from, day],
      );
      const kg = profile.weightKg;
      const stepsOf = (d: string) => steps.rows.find((r) => r.day === d)?.steps ?? 0;
      const exercisesOf = (d: string) => workouts.rows.find((r) => r.day === d)?.n ?? 0;
      const totalOf = (d: string) =>
        items.rows.filter((r) => r.day === d).reduce((sum, r) => sum + r.kcal, 0) +
        stepsKcal(stepsOf(d), kg) +
        workoutKcal(exercisesOf(d), kg);

      return {
        day,
        items: items.rows
          .filter((r) => r.day === day)
          .map((r) => ({ id: r.id, activityId: r.activity_id, minutes: r.minutes, kcal: r.kcal })),
        steps: stepsOf(day),
        stepsKcal: stepsKcal(stepsOf(day), kg),
        workoutExercises: exercisesOf(day),
        workoutKcal: workoutKcal(exercisesOf(day), kg),
        totalKcal: totalOf(day),
        goalKcal: plan.exerciseKcal ?? 0,
        lossApproach: profile.goal === 'lose' ? (profile.lossApproach ?? 'diet') : null,
        week: Array.from({ length: 7 }, (_, i) => {
          const d = addDaysIso(from, i);
          return { day: d, kcal: totalOf(d) };
        }),
      };
    });
  }

  async add(userId: string, dto: ActivityDto) {
    if (!isEditableDay(dto.day)) {
      throw activityError(
        400,
        'day_not_editable',
        'Activitatile se pot introduce doar pentru ultimele 14 zile.',
      );
    }
    const activity = getActivity(dto.activityId);
    if (!activity) throw new BadRequestException('Activitate necunoscuta.');
    const entry = await this.db.asUser(userId, async (c): Promise<ActivityEntry> => {
      const { profile } = await this.energyIn(c);
      const kcal = dto.kcal ?? activityKcal(activity, dto.minutes, profile.weightKg);
      const { rows } = await c.query<{ id: string }>(
        `insert into activity_log (user_id, day, activity_id, minutes, kcal)
         values (app_user_id(), $1, $2, $3, $4) returning id`,
        [dto.day, dto.activityId, dto.minutes, kcal],
      );
      return { id: rows[0].id, activityId: dto.activityId, minutes: dto.minutes, kcal };
    });
    const trophies = await this.trophies.evaluate(userId);
    return { entry, trophies };
  }

  async remove(userId: string, id: string) {
    const removed = await this.db.asUser(userId, async (c) => {
      const { rowCount } = await c.query('delete from activity_log where id = $1', [id]);
      return rowCount ?? 0;
    });
    if (!removed) throw new NotFoundException('Activitatea nu exista.');
  }

  // ------------------------------------------------------------------ post intermitent

  async fasting(userId: string): Promise<{
    active: FastingSession | null;
    history: FastingSession[];
    block: FastingBlock;
    stats: { completed: number; longestHours: number };
  }> {
    return this.db.asUser(userId, async (c) => {
      const { profile } = await this.energyIn(c);
      const { rows } = await c.query<FastingRow>(
        `select ${FASTING_COLUMNS} from fasting_sessions
         where user_id = app_user_id() order by started_at desc limit 60`,
      );
      const sessions = rows.map(toSession);
      const durations = rows
        .filter((r) => r.ended_at)
        .map((r) => (r.ended_at!.getTime() - r.started_at.getTime()) / HOUR);
      return {
        active: sessions.find((s) => s.endedAt === null) ?? null,
        history: sessions.filter((s) => s.endedAt !== null).slice(0, 14),
        block: fastingBlock(profile),
        stats: {
          completed: sessions.filter((s) => s.completed).length,
          longestHours: Math.round(Math.max(0, ...durations) * 10) / 10,
        },
      };
    });
  }

  async startFast(userId: string, dto: FastingStartDto): Promise<FastingSession> {
    const plan = getFastingPlan(dto.planId);
    if (!plan) throw new BadRequestException('Plan necunoscut.');
    const now = Date.now();
    const started = dto.startedAt ? new Date(dto.startedAt) : new Date(now);
    if (started.getTime() > now + 60_000 || started.getTime() < now - MAX_FAST_HOURS * HOUR) {
      throw activityError(
        400,
        'fasting_start',
        'Ora de inceput trebuie sa fie in ultimele 24 de ore.',
      );
    }
    return this.db.asUser(userId, async (c) => {
      const { profile } = await this.energyIn(c);
      // Aplicatia nu propune postul minorilor si persoanelor subponderale.
      if (fastingBlock(profile)) {
        throw activityError(
          422,
          'fasting_blocked',
          'Postul intermitent nu este recomandat pentru profilul tau.',
        );
      }
      const active = await c.query(
        'select 1 from fasting_sessions where user_id = app_user_id() and ended_at is null',
      );
      if (active.rowCount) {
        throw activityError(409, 'fasting_active', 'Ai deja un post in desfasurare.');
      }
      const { rows } = await c.query<FastingRow>(
        `insert into fasting_sessions (user_id, plan_id, planned_hours, started_at)
         values (app_user_id(), $1, $2, $3) returning ${FASTING_COLUMNS}`,
        [plan.id, plan.fastHours, started],
      );
      return toSession(rows[0]);
    });
  }

  async stopFast(userId: string): Promise<{ session: FastingSession; trophies: string[] }> {
    const session = await this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<FastingRow>(
        `update fasting_sessions set ended_at = greatest(now(), started_at + interval '1 minute')
         where user_id = app_user_id() and ended_at is null
         returning ${FASTING_COLUMNS}`,
      );
      if (!rows[0]) throw new NotFoundException('Nu ai un post in desfasurare.');
      return toSession(rows[0]);
    });
    const trophies = session.completed ? await this.trophies.evaluate(userId) : [];
    return { session, trophies };
  }

  async removeFast(userId: string, id: string) {
    const removed = await this.db.asUser(userId, async (c) => {
      const { rowCount } = await c.query('delete from fasting_sessions where id = $1', [id]);
      return rowCount ?? 0;
    });
    if (!removed) throw new NotFoundException('Postul nu exista.');
  }
}
