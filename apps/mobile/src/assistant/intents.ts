import type { Href } from 'expo-router';

/**
 * Asistentul MoveMeal recunoaste intrebarea dupa cuvinte-cheie (in romana, engleza si rusa)
 * si raspunde din regulile aplicatiei. Structura permite inlocuirea ulterioara cu un model AI,
 * pastrand aceleasi actiuni (deschiderea paginii potrivite).
 */
export type Intent =
  | 'hello'
  | 'thanks'
  | 'calories'
  | 'protein'
  | 'water'
  | 'workout'
  | 'mealPlan'
  | 'swap'
  | 'log'
  | 'weight'
  | 'adjustment'
  | 'nutritionist'
  | 'freeConsult'
  | 'bmi'
  | 'photo'
  | 'settings'
  | 'privacy';

interface IntentRule {
  intent: Intent;
  keywords: string[];
  /** Pagina deschisa de butonul de sub raspuns. */
  action?: Href;
  actionLabel?: string;
}

/** Fara diacritice si cu litere mici, pentru comparare. */
export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ё/g, 'е');
}

const RULES: IntentRule[] = [
  {
    intent: 'hello',
    keywords: ['salut', 'buna', 'hello', 'hi ', 'hey', 'привет', 'здравств', 'добрый'],
  },
  {
    intent: 'thanks',
    keywords: ['multumesc', 'mersi', 'merci', 'thank', 'thx', 'спасибо', 'благодар'],
  },
  {
    intent: 'freeConsult',
    keywords: ['gratuit', 'gratis', 'free', 'oferta', 'offer', 'бесплатн', 'предложени'],
    action: '/nutritionist',
    actionLabel: 'menu.nutritionist',
  },
  {
    intent: 'nutritionist',
    keywords: [
      'nutritionist',
      'consult',
      'programa',
      'programez',
      'programare',
      'book',
      'appointment',
      'нутрициолог',
      'диетолог',
      'консультац',
      'запис',
    ],
    action: '/nutritionist',
    actionLabel: 'menu.nutritionist',
  },
  {
    intent: 'bmi',
    keywords: [
      'imc',
      'bmi',
      'greutate normala',
      'prea gras',
      'prea slab',
      'supraponderal',
      'obez',
      'normal weight',
      'overweight',
      'underweight',
      'имт',
      'нормальный вес',
      'лишний вес',
      'ожирени',
      'cantar',
    ],
    action: '/body-check',
    actionLabel: 'menu.bodyCheck',
  },
  {
    intent: 'photo',
    keywords: [
      'fotograf',
      'poza',
      'camera',
      'photo',
      'picture',
      'snap',
      'фото',
      'сфотограф',
      'снимок',
    ],
    action: '/food-photo',
    actionLabel: 'menu.foodPhoto',
  },
  {
    intent: 'protein',
    keywords: ['protein', 'proteine', 'белок', 'белк', 'протеин'],
  },
  {
    intent: 'calories',
    keywords: [
      'calori',
      'kcal',
      'necesar',
      'tinta',
      'calorie',
      'target',
      'калори',
      'ккал',
      'норма',
    ],
    action: '/home',
    actionLabel: 'menu.home',
  },
  {
    intent: 'water',
    keywords: ['apa', 'water', 'hidrat', 'pahar', 'вода', 'воды', 'стакан'],
    action: '/home',
    actionLabel: 'menu.home',
  },
  {
    intent: 'swap',
    keywords: [
      'schimb',
      'inlocu',
      'alta reteta',
      'replace',
      'swap',
      'change a meal',
      'замен',
      'поменять',
    ],
    action: '/meals',
    actionLabel: 'menu.meals',
  },
  {
    intent: 'log',
    keywords: [
      'jurnal',
      'adaug',
      'inregistr',
      'am mancat',
      'log',
      'diary',
      'track',
      'дневник',
      'добав',
      'съел',
    ],
    action: '/calories',
    actionLabel: 'menu.calories',
  },
  {
    intent: 'mealPlan',
    keywords: [
      'meniu',
      'plan alimentar',
      'mese',
      'masa',
      'mananc',
      'reteta',
      'meal',
      'recipe',
      'menu',
      'питани',
      'рецепт',
      'блюд',
      'меню',
    ],
    action: '/meals',
    actionLabel: 'menu.meals',
  },
  {
    intent: 'workout',
    keywords: [
      'antrenament',
      'exercit',
      'sala',
      'sport',
      'workout',
      'exercise',
      'training',
      'gym',
      'трениров',
      'упражнен',
      'зал',
    ],
    action: '/workout',
    actionLabel: 'menu.workout',
  },
  {
    intent: 'adjustment',
    keywords: ['ajustare', 'ajusta', 'adjust', 'platou', 'stagn', 'корректир', 'плато'],
    action: '/progress',
    actionLabel: 'menu.progress',
  },
  {
    intent: 'weight',
    keywords: [
      'greutate',
      'cantaresc',
      'kilogram',
      'progres',
      'weight',
      'weigh',
      'progress',
      'вес',
      'взвеш',
      'прогресс',
    ],
    action: '/progress',
    actionLabel: 'menu.progress',
  },
  {
    intent: 'settings',
    keywords: [
      'tema',
      'limba',
      'noapte',
      'dark',
      'theme',
      'language',
      'тема',
      'язык',
      'тёмн',
      'темн',
    ],
    action: '/settings',
    actionLabel: 'menu.settings',
  },
  {
    intent: 'privacy',
    keywords: [
      'date personale',
      'confidential',
      'acord',
      'privacy',
      'consent',
      'data',
      'конфиденц',
      'данные',
      'согласи',
    ],
    action: '/nutritionist',
    actionLabel: 'menu.nutritionist',
  },
];

export interface Match {
  intent: Intent | null;
  action?: Href;
  actionLabel?: string;
}

/** Intentia cu cele mai multe cuvinte-cheie gasite (la egalitate, prima din lista). */
export function matchIntent(question: string): Match {
  const text = ` ${normalize(question)} `;
  let best: IntentRule | null = null;
  let bestScore = 0;
  for (const rule of RULES) {
    const score = rule.keywords.filter((k) => text.includes(normalize(k))).length;
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }
  return best
    ? { intent: best.intent, action: best.action, actionLabel: best.actionLabel }
    : { intent: null };
}
