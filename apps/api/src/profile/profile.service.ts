import { Injectable, NotFoundException } from '@nestjs/common';
import { calculateMacros, type EnergyPlan, type EnergyProfile } from '@movemeal/shared';
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
  calorie_target: number | null;
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
  };
}

const COLUMNS =
  'name, age, sex, height_cm, weight_kg, goal, activity_level, target_weight_kg, weeks';

export interface CurrentEnergy {
  profile: Profile;
  plan: EnergyPlan;
  /** Tinta a fost modificata printr-o ajustare acceptata. */
  adjusted: boolean;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly db: DatabaseService,
    private readonly energy: EnergyService,
  ) {}

  /** Profilul si planul caloric efectiv, in tranzactia data (folosit si de alte module). */
  async currentIn(client: pg.PoolClient): Promise<CurrentEnergy | null> {
    const { rows } = await client.query<ProfileRow>(
      `select ${COLUMNS}, calorie_target from profiles`,
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
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (user_id) do update set
           name = excluded.name, age = excluded.age, sex = excluded.sex,
           height_cm = excluded.height_cm, weight_kg = excluded.weight_kg,
           goal = excluded.goal, activity_level = excluded.activity_level,
           target_weight_kg = excluded.target_weight_kg, weeks = excluded.weeks,
           calorie_target = null, updated_at = now()
         returning ${COLUMNS}, calorie_target`,
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
        ],
      );
      return rows[0];
    });
    return this.response(this.withPlan(row));
  }

  private withPlan(row: ProfileRow): CurrentEnergy {
    const profile = toProfile(row);
    const { plan } = this.energy.calculate(profile);
    if (row.calorie_target === null) return { profile, plan, adjusted: false };
    return {
      profile,
      plan: {
        ...plan,
        targetCalories: row.calorie_target,
        macros: calculateMacros(row.calorie_target, profile.weightKg, profile.goal),
      },
      adjusted: true,
    };
  }

  private response(current: CurrentEnergy) {
    const { goalCheck } = this.energy.calculate(current.profile);
    return { profile: current.profile, plan: current.plan, goalCheck, adjusted: current.adjusted };
  }
}
