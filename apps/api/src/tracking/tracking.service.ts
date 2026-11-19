import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { analyzeProgress, movingAverage7, type ProgressAnalysis } from '@movemeal/shared';
import type pg from 'pg';
import { addDaysIso, isEditableDay, todayIso } from '../common/dates.js';
import { DatabaseService } from '../database/database.service.js';
import { ProfileService } from '../profile/profile.service.js';

/** Se poate propune (si accepta) cel mult o ajustare la 14 zile. */
const ADJUSTMENT_INTERVAL_DAYS = 14;

@Injectable()
export class TrackingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly profiles: ProfileService,
  ) {}

  // ------------------------------------------------------------- masuratori

  async saveMeasurement(userId: string, day: string, weightKg: number, waistCm?: number) {
    if (!isEditableDay(day)) {
      throw new BadRequestException('Se pot inregistra doar ultimele 14 zile.');
    }
    // O zi are o singura valoare, care poate fi corectata.
    await this.db.asUser(userId, (c) =>
      c.query(
        `insert into body_measurements (user_id, day, weight_kg, waist_cm)
         values (app_user_id(), $1, $2, $3)
         on conflict (user_id, day) do update set
           weight_kg = excluded.weight_kg, waist_cm = excluded.waist_cm`,
        [day, weightKg, waistCm ?? null],
      ),
    );
  }

  async measurements(userId: string, weeks: number) {
    const from = addDaysIso(todayIso(), -(weeks * 7 - 1));
    const rows = await this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{ day: string; weight_kg: number; waist_cm: number | null }>(
        `select to_char(day, 'YYYY-MM-DD') as day, weight_kg, waist_cm
         from body_measurements where day >= $1 order by day`,
        [from],
      );
      return rows;
    });
    const averages = movingAverage7(rows.map((r) => ({ day: r.day, kg: r.weight_kg })));
    return rows.map((r, i) => ({
      day: r.day,
      weightKg: r.weight_kg,
      waistCm: r.waist_cm,
      average7: averages[i].avg,
    }));
  }

  // ------------------------------------------------------------- apa

  async setWater(userId: string, day: string, ml: number) {
    if (!isEditableDay(day)) {
      throw new BadRequestException('Se pot inregistra doar ultimele 14 zile.');
    }
    await this.db.asUser(userId, (c) =>
      c.query(
        `insert into water_log (user_id, day, ml) values (app_user_id(), $1, $2)
         on conflict (user_id, day) do update set ml = excluded.ml`,
        [day, ml],
      ),
    );
  }

  async water(userId: string, day: string) {
    const { rows } = await this.db.asUser(userId, (c) =>
      c.query<{ ml: number }>('select ml from water_log where day = $1', [day]),
    );
    return { day, ml: rows[0]?.ml ?? 0 };
  }

  // ------------------------------------------------------------- progres

  async progress(userId: string) {
    return this.db.asUser(userId, async (c) => {
      const { analysis, lastAdjustment } = await this.analyzeIn(c);
      const today = todayIso();
      const weekStart = addDaysIso(today, -6);
      const logged = await c.query<{ n: string }>(
        `select count(distinct day) as n from food_log where day between $1 and $2`,
        [weekStart, today],
      );
      return {
        analysis,
        lastAdjustment,
        loggedDaysThisWeek: Number(logged.rows[0].n),
      };
    });
  }

  /** Accepta ajustarea propusa: tinta noua se salveaza in profil (tranzactie unica). */
  async accept(userId: string) {
    return this.db.asUser(userId, async (c) => {
      const { analysis, canAdjust } = await this.analyzeIn(c);
      if (analysis.status !== 'adjust')
        throw new ConflictException('Nu exista o ajustare propusa.');
      if (!canAdjust) {
        throw new ConflictException('Se poate face cel mult o ajustare la 14 zile.');
      }
      await c.query(
        `insert into calorie_adjustments (user_id, previous_target, proposed_target, weekly_change_pct, status)
         values (app_user_id(), $1, $2, $3, 'accepted')`,
        [analysis.currentTarget, analysis.proposedTarget, analysis.weeklyChangePct],
      );
      await c.query('update profiles set calorie_target = $1, updated_at = now()', [
        analysis.proposedTarget,
      ]);
      return { targetCalories: analysis.proposedTarget };
    });
  }

  async reject(userId: string) {
    await this.db.asUser(userId, async (c) => {
      const { analysis, canAdjust } = await this.analyzeIn(c);
      if (analysis.status !== 'adjust' || !canAdjust) {
        throw new ConflictException('Nu exista o ajustare propusa.');
      }
      await c.query(
        `insert into calorie_adjustments (user_id, previous_target, proposed_target, weekly_change_pct, status)
         values (app_user_id(), $1, $2, $3, 'rejected')`,
        [analysis.currentTarget, analysis.proposedTarget, analysis.weeklyChangePct],
      );
    });
  }

  private async analyzeIn(c: pg.PoolClient): Promise<{
    analysis: ProgressAnalysis;
    canAdjust: boolean;
    lastAdjustment: { createdAt: string; status: string; proposedTarget: number } | null;
  }> {
    const current = await this.profiles.currentIn(c);
    if (!current) throw new NotFoundException('Completeaza mai intai profilul.');
    const today = todayIso();
    const from = addDaysIso(today, -13);
    const weights = await c.query<{ day: string; weight_kg: number }>(
      `select to_char(day, 'YYYY-MM-DD') as day, weight_kg from body_measurements
       where day between $1 and $2`,
      [from, today],
    );
    const logged = await c.query<{ day: string }>(
      `select distinct to_char(day, 'YYYY-MM-DD') as day from food_log where day between $1 and $2`,
      [from, today],
    );
    const last = await c.query<{ created_at: Date; status: string; proposed_target: number }>(
      'select created_at, status, proposed_target from calorie_adjustments order by created_at desc limit 1',
    );
    const lastRow = last.rows[0];
    const canAdjust =
      !lastRow ||
      Date.now() - lastRow.created_at.getTime() >= ADJUSTMENT_INTERVAL_DAYS * 24 * 3600 * 1000;

    const analysis = analyzeProgress({
      goal: current.profile.goal,
      sex: current.profile.sex,
      today,
      weights: weights.rows.map((w) => ({ day: w.day, kg: w.weight_kg })),
      loggedDays: logged.rows.map((r) => r.day),
      currentTarget: current.plan.targetCalories,
      tdee: current.plan.tdee,
    });

    return {
      // Dupa o decizie recenta, nu se mai propune nimic pana la urmatoarea fereastra de 14 zile.
      analysis:
        analysis.status === 'adjust' && !canAdjust
          ? { status: 'on_track', weeklyChangePct: analysis.weeklyChangePct }
          : analysis,
      canAdjust,
      lastAdjustment: lastRow
        ? {
            createdAt: lastRow.created_at.toISOString(),
            status: lastRow.status,
            proposedTarget: lastRow.proposed_target,
          }
        : null,
    };
  }
}
