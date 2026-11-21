import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  calculateMacros,
  type EnergyPlan,
  type EnergyProfile,
  type LossApproach,
} from '@movemeal/shared';
import type pg from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { EnergyService } from '../energy/energy.service.js';
import type { ProfileDto } from './profile.dto.js';

export interface Profile extends EnergyProfile {
  name: string;
}

interface ProfileRow {
  name: string;
  age: number;
  sex: Profile['sex'];
  height_cm: number;
  weight_kg: number;
  goal: Profile['goal'];
  activity_level: Profile['activityLevel'];
  target_weight_kg: number | null;
  weeks: number | null;
  loss_approach: Profile['lossApproach'] | null;
  calorie_target: number | null;
  calorie_target_by: 'adjustment' | 'nutritionist' | null;
  nutritionist_note: string | null;
}

function toProfile(row: ProfileRow): Profile {
  return {
    name: row.name,
    age: row.age,
    sex: row.sex,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    goal: row.goal,
    activityLevel: row.activity_level,
    ...(row.target_weight_kg !== null ? { targetWeightKg: row.target_weight_kg } : {}),
    ...(row.weeks !== null ? { weeks: row.weeks } : {}),
    ...(row.loss_approach ? { lossApproach: row.loss_approach } : {}),
  };
}

const COLUMNS =
  'name, age, sex, height_cm, weight_kg, goal, activity_level, target_weight_kg, weeks, loss_approach';

export interface CurrentEnergy {
  profile: Profile;
  plan: EnergyPlan;
  /** Tinta a fost modificata printr-o ajustare acceptata sau de nutritionist. */
  adjusted: boolean;
  /** Cine a stabilit tinta: ajustarea automata acceptata sau nutritionistul. */
  adjustedBy: 'adjustment' | 'nutritionist' | null;
  nutritionistNote: string | null;
}

const EXTRA = 'calorie_target, calorie_target_by, nutritionist_note';

@Injectable()
export class ProfileService {
  constructor(
    private readonly db: DatabaseService,
    private readonly energy: EnergyService,
  ) {}

  /** Profilul si planul caloric efectiv, in tranzactia data (folosit si de alte module). */
  async currentIn(client: pg.PoolClient, userId?: string): Promise<CurrentEnergy | null> {
    const { rows } = await client.query<ProfileRow>(
      `select ${COLUMNS}, ${EXTRA} from profiles where user_id = coalesce($1, app_user_id())`,
      [userId ?? null],
    );
    return rows[0] ? this.withPlan(rows[0]) : null;
  }

  async get(userId: string) {
    const current = await this.db.asUser(userId, (c) => this.currentIn(c));
    if (!current) throw new NotFoundException('Profilul nu a fost completat.');
    return this.response(current);
  }

  async save(userId: string, dto: ProfileDto) {
    const hasTarget = dto.goal === 'lose' || dto.goal === 'gain';
    const row = await this.db.asUser(userId, async (c) => {
      // La modificarea profilului, tinta se recalculeaza (ajustarea anterioara nu mai e valabila).
      const { rows } = await c.query<ProfileRow>(
        `insert into profiles (user_id, ${COLUMNS})
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         on conflict (user_id) do update set
           name = excluded.name, age = excluded.age, sex = excluded.sex,
           height_cm = excluded.height_cm, weight_kg = excluded.weight_kg,
           goal = excluded.goal, activity_level = excluded.activity_level,
           target_weight_kg = excluded.target_weight_kg, weeks = excluded.weeks,
           loss_approach = excluded.loss_approach,
           calorie_target = null, calorie_target_by = null, updated_at = now()
         returning ${COLUMNS}, ${EXTRA}`,
        [
          userId,
          dto.name.trim(),
          dto.age,
          dto.sex,
          dto.heightCm,
          dto.weightKg,
          dto.goal,
          dto.activityLevel,
          hasTarget ? dto.targetWeightKg : null,
          hasTarget ? dto.weeks : null,
          dto.goal === 'lose' ? (dto.lossApproach ?? 'diet') : null,
        ],
      );
      return rows[0];
    });
    return this.response(this.withPlan(row));
  }

  async setLossApproach(userId: string, approach: LossApproach) {
    const row = await this.db.asUser(userId, async (c) => {
      // O ajustare automata acceptata se refacea pe vechea abordare, deci se renunta la ea;
      // tinta stabilita de nutritionist se pastreaza.
      const { rows } = await c.query<ProfileRow>(
        `update profiles set loss_approach = $1,
           calorie_target = case when calorie_target_by = 'nutritionist' then calorie_target end,
           calorie_target_by = case when calorie_target_by = 'nutritionist' then calorie_target_by end,
           updated_at = now()
         where user_id = app_user_id() and goal = 'lose'
         returning ${COLUMNS}, ${EXTRA}`,
        [approach],
      );
      return rows[0];
    });
    if (!row) {
      throw new BadRequestException('Abordarea se alege doar pentru obiectivul de slabire.');
    }
    return this.response(this.withPlan(row));
  }

  private withPlan(row: ProfileRow): CurrentEnergy {
    const profile = toProfile(row);
    const { plan } = this.energy.calculate(profile);
    const note = row.nutritionist_note ?? null;
    if (row.calorie_target === null) {
      return { profile, plan, adjusted: false, adjustedBy: null, nutritionistNote: note };
    }
    return {
      profile,
      plan: {
        ...plan,
        targetCalories: row.calorie_target,
        macros: calculateMacros(row.calorie_target, profile.weightKg, profile.goal),
      },
      adjusted: true,
      adjustedBy: row.calorie_target_by ?? 'adjustment',
      nutritionistNote: note,
    };
  }

  private response(current: CurrentEnergy) {
    const { goalCheck } = this.energy.calculate(current.profile);
    return {
      profile: current.profile,
      plan: current.plan,
      goalCheck,
      adjusted: current.adjusted,
      adjustedBy: current.adjustedBy,
      nutritionistNote: current.nutritionistNote,
    };
  }
}
