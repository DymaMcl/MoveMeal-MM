import type { Nutrients } from '@movemeal/shared';
import { loadEnv } from '../config.js';

/**
 * Open Food Facts: baza de date deschisa (ODbL) cu produse ambalate si codurile lor de bare.
 * Serverul cere doar campurile necesare si pastreaza produsul gasit in tabela `products`,
 * ca acelasi cod sa nu fie cerut din nou la fiecare scanare.
 */

export interface OffProduct {
  barcode: string;
  name: string;
  brand: string | null;
  per100: Nutrients;
  servingG: number | null;
  imageUrl: string | null;
}

/** Produsul exista, dar nu are valori nutritionale complete (utilizatorul le poate completa). */
export interface OffIncomplete {
  barcode: string;
  name: string | null;
  brand: string | null;
}

export type OffResult =
  | { kind: 'found'; product: OffProduct }
  | { kind: 'incomplete'; product: OffIncomplete }
  | { kind: 'missing' };

const FIELDS = [
  'code',
  'product_name',
  'product_name_ro',
  'product_name_en',
  'product_name_ru',
  'generic_name',
  'brands',
  'nutriments',
  'serving_quantity',
  'image_front_small_url',
].join(',');

const TIMEOUT_MS = 6_000;

function baseUrl(): string {
  loadEnv();
  return (process.env.OFF_BASE_URL ?? 'https://world.openfoodfacts.org').replace(/\/$/, '');
}

const num = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
};

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, max) : null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Transforma raspunsul Open Food Facts intr-un produs valid. Valorile sunt la 100 g; energia
 * lipsa in kcal se calculeaza din kJ sau din macronutrienti. Produsele cu valori imposibile
 * (de exemplu peste 100 g de nutrienti la 100 g) sunt tratate ca incomplete.
 */
export function parseOffProduct(barcode: string, raw: unknown): OffResult {
  if (!raw || typeof raw !== 'object') return { kind: 'missing' };
  const body = raw as { status?: unknown; product?: Record<string, unknown> };
  const p = body.product;
  if (body.status !== 1 || !p || typeof p !== 'object') return { kind: 'missing' };

  const name =
    text(p.product_name_ro, 120) ??
    text(p.product_name, 120) ??
    text(p.product_name_en, 120) ??
    text(p.product_name_ru, 120) ??
    text(p.generic_name, 120);
  // Prima marca din lista („Marca, Producator”).
  const brand = text(typeof p.brands === 'string' ? p.brands.split(',')[0] : null, 80);

  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === null) {
    const kj = num(n['energy-kj_100g']) ?? num(n.energy_100g);
    if (kj !== null) kcal = kj / 4.184;
  }
  if (kcal === null && protein !== null && carbs !== null && fat !== null) {
    kcal = protein * 4 + carbs * 4 + fat * 9;
  }

  const valid =
    name !== null &&
    kcal !== null &&
    protein !== null &&
    carbs !== null &&
    fat !== null &&
    kcal <= 900 &&
    protein + carbs + fat <= 101;
  if (!valid) return { kind: 'incomplete', product: { barcode, name, brand } };

  const serving = num(p.serving_quantity);
  const image = text(p.image_front_small_url, 500);
  return {
    kind: 'found',
    product: {
      barcode,
      name: name!,
      brand,
      per100: {
        kcal: round1(kcal!),
        protein: round1(protein!),
        carbs: round1(carbs!),
        fat: round1(fat!),
      },
      servingG: serving !== null && serving > 0 && serving <= 2000 ? round1(serving) : null,
      // Doar imaginile servite de Open Food Facts prin HTTPS.
      imageUrl: image && /^https:\/\/[a-z0-9.-]*openfoodfacts\.org\//i.test(image) ? image : null,
    },
  };
}

/** Cauta produsul dupa codul de bare. Arunca o eroare doar daca serviciul nu poate fi contactat. */
export async function fetchOffProduct(barcode: string): Promise<OffResult> {
  const url = `${baseUrl()}/api/v2/product/${barcode}?fields=${FIELDS}`;
  const res = await fetch(url, {
    headers: {
      // Open Food Facts cere un User-Agent care identifica aplicatia (fara date personale).
      'User-Agent': 'MoveMeal/1.0 (nutrition app; contact via project repository)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) return { kind: 'missing' };
  if (!res.ok) throw new Error(`Open Food Facts ${res.status}`);
  return parseOffProduct(barcode, await res.json());
}
