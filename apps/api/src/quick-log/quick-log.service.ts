import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { roundNutrients, scaleNutrients, type Nutrients } from '@movemeal/shared';
import type pg from 'pg';
import { addDaysIso, isEditableDay, todayIso } from '../common/dates.js';
import { DatabaseService } from '../database/database.service.js';
import type { LogMeal } from '../nutrition/nutrition.dto.js';
import type { LogEntry } from '../nutrition/nutrition.service.js';
import { productError, ProductsService } from './products.service.js';
import {
  MAX_SAVED_ITEMS,
  MAX_SAVED_MEALS,
  type CopyLogDto,
  type LogProductDto,
  type QuickAddDto,
  type SaveMealDto,
} from './quick-log.dto.js';

/** Un aliment dintr-o masa salvata (copia inregistrarii din jurnal, cu valorile ei). */
export interface SavedMealItem extends Nutrients {
  source: LogEntry['source'];
  refId: string;
  name: string;
  amount: number;
  unit: 'g' | 'portion';
}

export interface SavedMeal {
  id: string;
  name: string;
  items: SavedMealItem[];
  total: Nutrients;
  uses: number;
}

/** Se pot copia mese din ultimele 60 de zile. */
const COPY_WINDOW_DAYS = 60;

interface LogRow {
  id: string;
  day: string;
  meal: LogMeal;
  source: LogEntry['source'];
  ref_id: string;
  name: string;
  amount: number;
  unit: 'g' | 'portion';
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const toEntry = (r: LogRow): LogEntry => ({
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
});

const RETURNING = `returning id, to_char(day, 'YYYY-MM-DD') as day, meal, source, ref_id, name,
  amount, unit, kcal, protein, carbs, fat`;

function sum(items: Nutrients[]): Nutrients {
  return roundNutrients(
    items.reduce(
      (s, n) => ({
        kcal: s.kcal + n.kcal,
        protein: s.protein + n.protein,
        carbs: s.carbs + n.carbs,
        fat: s.fat + n.fat,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    ),
  );
}

function requireEditable(day: string) {
  if (!isEditableDay(day)) {
    throw new BadRequestException('Se pot adauga inregistrari doar pentru ultimele 14 zile.');
  }
}

@Injectable()
export class QuickLogService {
  constructor(
    private readonly db: DatabaseService,
    private readonly products: ProductsService,
  ) {}

  /** Produs scanat sau propriu; valorile se calculeaza pe server din produsul salvat. */
  async logProduct(userId: string, dto: LogProductDto): Promise<LogEntry> {
    requireEditable(dto.day);
    return this.db.asUser(userId, async (c) => {
      const product = await this.products.get(c, dto.productId);
      const grams = Math.round(dto.grams);
      const n = roundNutrients(scaleNutrients(product.per100, grams / 100));
      const name = (product.brand ? `${product.name} · ${product.brand}` : product.name).slice(
        0,
        120,
      );
      return this.insert(c, {
        day: dto.day,
        meal: dto.meal,
        source: 'product',
        refId: product.id,
        name,
        amount: grams,
        unit: 'g',
        ...n,
      });
    });
  }

  /** Calorii introduse direct, cand alimentele nu se pot cauta (restaurant, masa in oras). */
  async quickAdd(userId: string, dto: QuickAddDto): Promise<LogEntry> {
    requireEditable(dto.day);
    const protein = dto.protein ?? 0;
    const carbs = dto.carbs ?? 0;
    const fat = dto.fat ?? 0;
    // Macronutrientii nu pot avea mai multe calorii decat totalul (cu o marja pentru rotunjiri).
    if (protein * 4 + carbs * 4 + fat * 9 > dto.kcal * 1.15 + 20) {
      throw productError(400, 'macros_exceed', 'Macronutrientii depasesc caloriile introduse.');
    }
    const n = roundNutrients({ kcal: dto.kcal, protein, carbs, fat });
    return this.db.asUser(userId, (c) =>
      this.insert(c, {
        day: dto.day,
        meal: dto.meal,
        source: 'quick',
        refId: 'quick',
        name: dto.name?.trim() || '',
        amount: 1,
        unit: 'portion',
        ...n,
      }),
    );
  }

  /** Copiaza o masa sau toata ziua (de exemplu „ca ieri”); valorile raman cele salvate. */
  async copy(userId: string, dto: CopyLogDto): Promise<LogEntry[]> {
    requireEditable(dto.toDay);
    const today = todayIso();
    if (dto.fromDay > today || dto.fromDay <= addDaysIso(today, -COPY_WINDOW_DAYS)) {
      throw new BadRequestException('Se pot copia doar zilele din ultimele 60 de zile.');
    }
    if (dto.toMeal && !dto.fromMeal) {
      throw new BadRequestException('Alege masa care se copiaza.');
    }
    if (
      dto.fromDay === dto.toDay &&
      (!dto.fromMeal || (dto.toMeal ?? dto.fromMeal) === dto.fromMeal)
    ) {
      throw new BadRequestException('Masa nu poate fi copiata peste ea insasi.');
    }
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<LogRow>(
        `insert into food_log (user_id, day, meal, source, ref_id, name, amount, unit, kcal, protein, carbs, fat)
         select user_id, $2::date, coalesce($4, meal), source, ref_id, name, amount, unit,
                kcal, protein, carbs, fat
         from food_log
         where user_id = app_user_id() and day = $1 and ($3::text is null or meal = $3)
         order by created_at
         ${RETURNING}`,
        [dto.fromDay, dto.toDay, dto.fromMeal ?? null, dto.toMeal ?? dto.fromMeal ?? null],
      );
      if (!rows.length) {
        throw productError(422, 'nothing_to_copy', 'Nu exista alimente de copiat.');
      }
      return rows.map(toEntry);
    });
  }

  // ------------------------------------------------------------------ mese salvate

  async savedMeals(userId: string): Promise<SavedMeal[]> {
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{
        id: string;
        name: string;
        items: SavedMealItem[];
        uses: number;
      }>(
        `select id, name, items, uses from saved_meals where user_id = app_user_id()
         order by last_used_at desc nulls last, created_at desc`,
      );
      return rows.map((r) => ({ ...r, total: sum(r.items) }));
    });
  }

  /** Salveaza ca masa alimentele alese din jurnal. */
  async saveMeal(userId: string, dto: SaveMealDto): Promise<SavedMeal> {
    return this.db.asUser(userId, async (c) => {
      const count = await c.query<{ n: number }>(
        'select count(*)::int as n from saved_meals where user_id = app_user_id()',
      );
      if (count.rows[0].n >= MAX_SAVED_MEALS) {
        throw productError(422, 'saved_meals_limit', 'Ai atins numarul maxim de mese salvate.');
      }
      const { rows } = await c.query<LogRow>(
        `select id, to_char(day, 'YYYY-MM-DD') as day, meal, source, ref_id, name, amount, unit,
                kcal, protein, carbs, fat
         from food_log where user_id = app_user_id() and id = any($1::uuid[])
         order by created_at`,
        [dto.entryIds],
      );
      if (rows.length !== dto.entryIds.length) {
        throw new NotFoundException('Unele alimente nu mai exista in jurnal.');
      }
      const items: SavedMealItem[] = rows.slice(0, MAX_SAVED_ITEMS).map((r) => ({
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
      const total = sum(items);
      const inserted = await c.query<{ id: string }>(
        `insert into saved_meals (user_id, name, items, kcal)
         values (app_user_id(), $1, $2, $3) returning id`,
        [dto.name.trim(), JSON.stringify(items), total.kcal],
      );
      return { id: inserted.rows[0].id, name: dto.name.trim(), items, total, uses: 0 };
    });
  }

  async renameMeal(userId: string, id: string, name: string): Promise<void> {
    await this.db.asUser(userId, async (c) => {
      const { rowCount } = await c.query(
        'update saved_meals set name = $2 where id = $1 and user_id = app_user_id()',
        [id, name.trim()],
      );
      if (!rowCount) throw new NotFoundException('Masa salvata nu exista.');
    });
  }

  async deleteMeal(userId: string, id: string): Promise<void> {
    await this.db.asUser(userId, async (c) => {
      const { rowCount } = await c.query(
        'delete from saved_meals where id = $1 and user_id = app_user_id()',
        [id],
      );
      if (!rowCount) throw new NotFoundException('Masa salvata nu exista.');
    });
  }

  /** Adauga in jurnal toate alimentele mesei salvate. */
  async logSavedMeal(userId: string, id: string, day: string, meal: LogMeal): Promise<LogEntry[]> {
    requireEditable(day);
    return this.db.asUser(userId, async (c) => {
      const { rows } = await c.query<{ items: SavedMealItem[] }>(
        `update saved_meals set uses = uses + 1, last_used_at = now()
         where id = $1 and user_id = app_user_id() returning items`,
        [id],
      );
      if (!rows[0]) throw new NotFoundException('Masa salvata nu exista.');
      const entries: LogEntry[] = [];
      for (const item of rows[0].items) {
        entries.push(await this.insert(c, { ...item, day, meal }));
      }
      return entries;
    });
  }

  // ------------------------------------------------------------------ intern

  private async insert(c: pg.PoolClient, e: Omit<LogEntry, 'id'>): Promise<LogEntry> {
    const { rows } = await c.query<LogRow>(
      `insert into food_log (user_id, day, meal, source, ref_id, name, amount, unit, kcal, protein, carbs, fat)
       values (app_user_id(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ${RETURNING}`,
      [
        e.day,
        e.meal,
        e.source,
        e.refId,
        e.name,
        e.amount,
        e.unit,
        e.kcal,
        e.protein,
        e.carbs,
        e.fat,
      ],
    );
    return toEntry(rows[0]);
  }
}
