import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  foodNutrients,
  generateMealPlan,
  getFood,
  getRecipe,
  mealAlternatives,
  recipeAllowed,
  recipeNutrients,
  regenerateDay,
  replaceMeal,
  roundNutrients,
  scaleNutrients,
  shoppingList,
  SLOT_MEAL_TYPE,
  type MealPlan,
  type MealSlot,
  type Nutrients,
  type NutritionPreferences,
} from '@movemeal/shared';
import type pg from 'pg';
import { isEditableDay, weekdayOfIso } from '../common/dates.js';
import { DatabaseService } from '../database/database.service.js';
import { ProfileService } from '../profile/profile.service.js';
import type { LogEntryDto, LogMeal } from './nutrition.dto.js';

interface ProgramRow {
  preferences: NutritionPreferences;
  plan: MealPlan;
  salt: number;
}

export interface LogEntry extends Nutrients {
  id: string;
  day: string;
  meal: LogMeal;
  source: 'food' | 'recipe';
  refId: string;
  name: string;
  amount: number;
  unit: 'g' | 'portion';
}

const SLOT_TO_LOG_MEAL: Record<MealSlot, LogMeal> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack1: 'snack',
  snack2: 'snack',
};

@Injectable()
export class NutritionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly profiles: ProfileService,
  ) {}

  // ------------------------------------------------------------------ plan

  async get(userId: string) {
    const row = await this.db.asUser(userId, (c) => this.programIn(c));
    if (!row) throw new NotFoundException('Planul alimentar nu a fost creat.');
    return { preferences: row.preferences, plan: row.plan };
  }

  /** Salveaza preferintele si genereaza planul (inlocuieste planul existent, in aceeasi tranzactie). */
  async savePreferences(userId: string, preferences: NutritionPreferences) {
    return this.db.asUser(userId, async (c) => {
      const plan = await this.generate(c, preferences, 0);
      await c.query(
        `insert into nutrition_programs (user_id, preferences, plan, salt)
         values (app_user_id(), $1, $2, 0)
         on conflict (user_id) do update set
           preferences = excluded.preferences, plan = excluded.plan, salt = 0, created_at = now()`,
        [JSON.stringify(preferences), JSON.stringify(plan)],
      );
      return { preferences, plan };
    });
  }

  /** Regenereaza toata saptamana sau o singura zi. */
  async regenerate(userId: string, weekday?: number) {
    return this.db.asUser(userId, async (c) => {
      const row = await this.requireProgram(c);
      const salt = row.salt + 1;
      const plan =
        weekday === undefined
          ? await this.generate(c, row.preferences, salt)
          : regenerateDay(row.plan, weekday, row.preferences, salt);
      await this.storePlan(c, plan, salt);
      return { preferences: row.preferences, plan };
    });
  }

  async alternatives(userId: string, weekday: number, slot: MealSlot) {
    const row = await this.db.asUser(userId, (c) => this.requireProgram(c));
    return mealAlternatives(row.plan, weekday, slot, row.preferences);
  }

  async replace(userId: string, weekday: number, slot: MealSlot, recipeId: string) {
    return this.db.asUser(userId, async (c) => {
      const row = await this.requireProgram(c);
      const recipe = getRecipe(recipeId);
      const current = row.plan.days
        .find((d) => d.weekday === weekday)
        ?.meals.find((m) => m.slot === slot);
      if (!current) throw new NotFoundException('Masa nu exista in plan.');
      // Doar retete compatibile cu restrictiile si cu tipul mesei.
      if (
        !recipe ||
        recipe.mealType !== SLOT_MEAL_TYPE[slot] ||
        !recipeAllowed(recipe, row.preferences)
      ) {
        throw new BadRequestException('Reteta nu este compatibila cu aceasta masa.');
      }
      const portions = Math.min(
        2,
        Math.max(0.5, Math.round((current.nutrients.kcal / recipeNutrients(recipe).kcal) * 4) / 4),
      );
      const plan = replaceMeal(row.plan, weekday, {
        slot,
        recipeId,
        portions,
        nutrients: roundNutrients(scaleNutrients(recipeNutrients(recipe), portions)),
      });
      await this.storePlan(c, plan, row.salt);
      return { preferences: row.preferences, plan };
    });
  }

  async shopping(userId: string) {
    const row = await this.db.asUser(userId, (c) => this.requireProgram(c));
    return shoppingList(row.plan);
  }

  // ------------------------------------------------------------------ jurnal

  async log(userId: string, day: string): Promise<LogEntry[]> {
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query(
        `select id, to_char(day, 'YYYY-MM-DD') as day, meal, source, ref_id, name, amount, unit,
                kcal, protein, carbs, fat
         from food_log where day = $1 order by created_at`,
        [day],
      );
      return rows.map((r) => ({
        id: r.id,
        day: r.day,
        meal: r.meal,
        source: r.source,
        refId: r.ref_id,
        name: r.name,
        amount: r.amount,
        unit: r.unit,
        kcal: r.kcal,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
      }));
    });
  }

  /** Adauga o inregistrare; valorile se calculeaza pe server din catalog. */
  async addLog(userId: string, dto: LogEntryDto): Promise<LogEntry> {
    if (!isEditableDay(dto.day)) {
      throw new BadRequestException('Se pot adauga inregistrari doar pentru ultimele 14 zile.');
    }
    let name: string;
    let nutrients: Nutrients;
    let unit: 'g' | 'portion';
    if (dto.source === 'food') {
      const food = getFood(dto.refId);
      if (!food) throw new BadRequestException('Aliment necunoscut.');
      name = food.name.ro;
      nutrients = foodNutrients(food, dto.amount);
      unit = 'g';
    } else {
      const recipe = getRecipe(dto.refId);
      if (!recipe) throw new BadRequestException('Reteta necunoscuta.');
      if (dto.amount > 4) throw new BadRequestException('Cel mult 4 portii.');
      name = recipe.name.ro;
      nutrients = scaleNutrients(recipeNutrients(recipe), dto.amount);
      unit = 'portion';
    }
    const n = roundNutrients(nutrients);
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{ id: string }>(
        `insert into food_log (user_id, day, meal, source, ref_id, name, amount, unit, kcal, protein, carbs, fat)
         values (app_user_id(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         returning id`,
        [
          dto.day,
          dto.meal,
          dto.source,
          dto.refId,
          name,
          dto.amount,
          unit,
          n.kcal,
          n.protein,
          n.carbs,
          n.fat,
        ],
      );
      return { id: rows[0].id, ...dto, name, unit, ...n };
    });
  }

  /** „Mancat”: masa planificata pentru ziua respectiva trece in jurnal. */
  async eatPlanned(userId: string, day: string, slot: MealSlot): Promise<LogEntry> {
    const row = await this.db.asUser(userId, (c) => this.requireProgram(c));
    const meal = row.plan.days
      .find((d) => d.weekday === weekdayOfIso(day))
      ?.meals.find((m) => m.slot === slot);
    if (!meal) throw new NotFoundException('Masa nu exista in plan.');
    const already = await this.db.asUser(userId, (c) =>
      c.query(
        `select 1 from food_log where day = $1 and meal = $2 and source = 'recipe' and ref_id = $3`,
        [day, SLOT_TO_LOG_MEAL[slot], meal.recipeId],
      ),
    );
    if (already.rowCount) throw new ConflictException('Masa este deja in jurnal.');
    return this.addLog(userId, {
      day,
      meal: SLOT_TO_LOG_MEAL[slot],
      source: 'recipe',
      refId: meal.recipeId,
      amount: meal.portions,
    });
  }

  async deleteLog(userId: string, id: string): Promise<void> {
    await this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{ day: string }>(
        `select to_char(day, 'YYYY-MM-DD') as day from food_log where id = $1`,
        [id],
      );
      if (!rows[0]) throw new NotFoundException();
      if (!isEditableDay(rows[0].day)) {
        throw new BadRequestException('Se pot modifica doar ultimele 14 zile.');
      }
      await c.query('delete from food_log where id = $1', [id]);
    });
  }

  /** Alimentele folosite recent si frecvent (pentru afisarea lor primele la cautare). */
  async recentFoods(userId: string): Promise<string[]> {
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{ ref_id: string }>(
        `select ref_id from food_log
         where source = 'food' and day > current_date - 30
         group by ref_id
         order by max(created_at) desc, count(*) desc
         limit 12`,
      );
      return rows.map((r) => r.ref_id);
    });
  }

  // ------------------------------------------------------------------ intern

  private async programIn(c: pg.PoolClient): Promise<ProgramRow | undefined> {
    const { rows } = await c.query<ProgramRow>(
      'select preferences, plan, salt from nutrition_programs',
    );
    return rows[0];
  }

  private async requireProgram(c: pg.PoolClient): Promise<ProgramRow> {
    const row = await this.programIn(c);
    if (!row) throw new NotFoundException('Planul alimentar nu a fost creat.');
    return row;
  }

  private async storePlan(c: pg.PoolClient, plan: MealPlan, salt: number) {
    await c.query('update nutrition_programs set plan = $1, salt = $2', [
      JSON.stringify(plan),
      salt,
    ]);
  }

  private async generate(c: pg.PoolClient, preferences: NutritionPreferences, salt: number) {
    const current = await this.profiles.currentIn(c);
    if (!current) throw new NotFoundException('Completeaza mai intai profilul.');
    const result = generateMealPlan(
      preferences,
      {
        kcal: current.plan.targetCalories,
        protein: current.plan.macros.proteinG,
        // Tabelul 1.2: proteinele de cel mult 2,0 g/kg.
        proteinMax: current.profile.weightKg * 2,
      },
      salt,
    );
    if (!result.ok) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Restrictiile nu permit alcatuirea unui plan.',
        blockedBy: result.blockedBy,
      });
    }
    return result.plan;
  }
}
