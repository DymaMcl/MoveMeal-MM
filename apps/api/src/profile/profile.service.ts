import { Injectable, NotFoundException } from '@nestjs/common';
import type { EnergyProfile } from '@movemeal/shared';
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

@Injectable()
export class ProfileService {
  constructor(
    private readonly db: DatabaseService,
    private readonly energy: EnergyService,
  ) {}

  async get(userId: string) {
    const row = await this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<ProfileRow>(`select ${COLUMNS} from profiles`);
      return rows[0];
    });
    if (!row) throw new NotFoundException('Profilul nu a fost completat.');
    return this.withPlan(toProfile(row));
  }

  async save(userId: string, dto: ProfileDto) {
    const hasTarget = dto.goal === 'lose' || dto.goal === 'gain';
    const row = await this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<ProfileRow>(
        `insert into profiles (user_id, ${COLUMNS})
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (user_id) do update set
           name = excluded.name, age = excluded.age, sex = excluded.sex,
           height_cm = excluded.height_cm, weight_kg = excluded.weight_kg,
           goal = excluded.goal, activity_level = excluded.activity_level,
           target_weight_kg = excluded.target_weight_kg, weeks = excluded.weeks,
           updated_at = now()
         returning ${COLUMNS}`,
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
    return this.withPlan(toProfile(row));
  }

  private withPlan(profile: Profile) {
    return { profile, ...this.energy.calculate(profile) };
  }
}
