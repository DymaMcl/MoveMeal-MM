import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  generateWorkoutPlan,
  getExercise,
  validatePreferences,
  type Goal,
  type WorkoutPlan,
  type WorkoutPreferences,
} from '@movemeal/shared';
import { DatabaseService } from '../database/database.service.js';

export interface WorkoutProgram {
  preferences: WorkoutPreferences;
  plan: WorkoutPlan;
  createdAt: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class WorkoutService {
  constructor(private readonly db: DatabaseService) {}

  async get(userId: string): Promise<WorkoutProgram> {
    const row = await this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{
        preferences: WorkoutPreferences;
        plan: WorkoutPlan;
        created_at: Date;
      }>('select preferences, plan, created_at from workout_programs');
      return rows[0];
    });
    if (!row) throw new NotFoundException('Programul de antrenament nu a fost creat.');
    return {
      preferences: row.preferences,
      plan: row.plan,
      createdAt: row.created_at.toISOString(),
    };
  }

  /** Genereaza programul din preferinte si obiectivul din profil, apoi il salveaza. */
  async save(userId: string, preferences: WorkoutPreferences): Promise<WorkoutProgram> {
    const errors = validatePreferences(preferences);
    if (errors.length > 0) throw new BadRequestException({ statusCode: 400, message: errors });

    return this.db.asUser(userId, async (c) => {
      const profile = await c.query<{ goal: Goal }>(
        'select goal from profiles where user_id = app_user_id()',
      );
      if (profile.rowCount === 0) {
        throw new NotFoundException('Completeaza mai intai profilul.');
      }
      const prefs: WorkoutPreferences = {
        ...preferences,
        // La sala echipamentul de acasa nu conteaza.
        equipment: preferences.location === 'gym' ? [] : preferences.equipment,
      };
      const plan = generateWorkoutPlan(prefs, profile.rows[0].goal);
      const { rows } = await c.query<{ created_at: Date }>(
        `insert into workout_programs (user_id, preferences, plan)
         values (app_user_id(), $1, $2)
         on conflict (user_id) do update set
           preferences = excluded.preferences, plan = excluded.plan, created_at = now()
         returning created_at`,
        [JSON.stringify(prefs), JSON.stringify(plan)],
      );
      return { preferences: prefs, plan, createdAt: rows[0].created_at.toISOString() };
    });
  }

  /** Exercitiile marcate ca efectuate intre doua date (inclusiv). */
  async logs(userId: string, from: string, to: string) {
    if (!DATE.test(from) || !DATE.test(to)) {
      throw new BadRequestException('Datele trebuie sa fie in formatul AAAA-LL-ZZ.');
    }
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{ day: string; exercise_id: string }>(
        `select to_char(day, 'YYYY-MM-DD') as day, exercise_id
         from workout_logs where day between $1 and $2 order by day, completed_at`,
        [from, to],
      );
      return rows.map((r) => ({ day: r.day, exerciseId: r.exercise_id }));
    });
  }

  async setLog(userId: string, day: string, exerciseId: string, done: boolean) {
    if (!getExercise(exerciseId)) throw new BadRequestException('Exercitiu necunoscut.');
    await this.db.asUser(userId, (c) =>
      done
        ? c.query(
            `insert into workout_logs (user_id, day, exercise_id) values (app_user_id(), $1, $2)
             on conflict do nothing`,
            [day, exerciseId],
          )
        : c.query('delete from workout_logs where day = $1 and exercise_id = $2', [
            day,
            exerciseId,
          ]),
    );
  }
}
