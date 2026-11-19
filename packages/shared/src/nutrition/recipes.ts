import type { Recipe } from './types.ts';

const r = (foodId: string, grams: number) => ({ foodId, grams });

/**
 * Catalogul initial de retete (cantitatile sunt pentru o portie).
 * Valorile nutritionale, alergenii si dietele compatibile se calculeaza din ingrediente.
 */
export const RECIPES: Recipe[] = [
  // ======================= MIC DEJUN =======================
  {
    id: 'oatmeal_banana',
    name: { ro: 'Terci de ovăz cu banană și nuci', en: 'Oatmeal with banana and walnuts' },
    mealType: 'breakfast',
    minutes: 10,
    ingredients: [r('oats', 60), r('milk', 200), r('banana', 100), r('walnuts', 10)],
    steps: {
      ro: [
        'Fierbe fulgii de ovăz în lapte 4–5 minute, amestecând.',
        'Adaugă banana feliată și nucile mărunțite.',
      ],
      en: [
        'Simmer the oats in the milk for 4–5 minutes, stirring.',
        'Top with sliced banana and chopped walnuts.',
      ],
    },
  },
  {
    id: 'oatmeal_berries_vegan',
    name: {
      ro: 'Ovăz cu băutură de soia și fructe de pădure',
      en: 'Oats with soy milk and berries',
    },
    mealType: 'breakfast',
    minutes: 10,
    ingredients: [r('oats', 60), r('soy_milk', 200), r('berries', 100), r('chia', 10)],
    steps: {
      ro: [
        'Fierbe ovăzul în băutura de soia 4–5 minute.',
        'Adaugă fructele de pădure și semințele de chia.',
      ],
      en: ['Cook the oats in the soy milk for 4–5 minutes.', 'Add the berries and chia seeds.'],
    },
  },
  {
    id: 'veggie_omelette',
    name: { ro: 'Omletă cu legume', en: 'Vegetable omelette' },
    mealType: 'breakfast',
    minutes: 15,
    ingredients: [
      r('eggs', 150),
      r('bell_pepper', 60),
      r('tomato', 60),
      r('spinach', 30),
      r('olive_oil', 5),
      r('wholewheat_bread', 40),
    ],
    steps: {
      ro: [
        'Călește ardeiul și spanacul în ulei 2–3 minute.',
        'Toarnă ouăle bătute și gătește la foc mic.',
        'Servește cu roșii și pâine integrală.',
      ],
      en: [
        'Sauté the pepper and spinach in oil for 2–3 minutes.',
        'Pour in the beaten eggs and cook on low heat.',
        'Serve with tomatoes and wholewheat bread.',
      ],
    },
  },
  {
    id: 'greek_yogurt_bowl',
    name: {
      ro: 'Bol cu iaurt grecesc, fructe și migdale',
      en: 'Greek yogurt bowl with berries and almonds',
    },
    mealType: 'breakfast',
    minutes: 5,
    ingredients: [r('greek_yogurt', 200), r('berries', 80), r('honey', 10), r('almonds', 15)],
    steps: {
      ro: ['Pune iaurtul într-un bol.', 'Adaugă fructele, mierea și migdalele.'],
      en: ['Spoon the yogurt into a bowl.', 'Top with berries, honey and almonds.'],
    },
  },
  {
    id: 'cottage_pancakes',
    name: { ro: 'Clătite din brânză de vaci (sirniki)', en: 'Cottage cheese pancakes' },
    mealType: 'breakfast',
    minutes: 20,
    ingredients: [
      r('cottage_cheese', 150),
      r('eggs', 50),
      r('oats', 30),
      r('honey', 10),
      r('butter', 5),
    ],
    steps: {
      ro: [
        'Amestecă brânza, oul și ovăzul măcinat.',
        'Formează turtițe și rumenește-le în unt, la foc mic.',
        'Servește cu miere.',
      ],
      en: [
        'Mix the cottage cheese, egg and ground oats.',
        'Shape small patties and brown them in butter on low heat.',
        'Serve with honey.',
      ],
    },
  },
  {
    id: 'avocado_egg_toast',
    name: { ro: 'Pâine prăjită cu avocado și ou', en: 'Avocado and egg toast' },
    mealType: 'breakfast',
    minutes: 10,
    ingredients: [r('wholewheat_bread', 70), r('avocado', 60), r('eggs', 100), r('tomato', 50)],
    steps: {
      ro: [
        'Prăjește pâinea și întinde avocado zdrobit.',
        'Fierbe ouăle 7 minute și pune-le deasupra, cu roșii.',
      ],
      en: [
        'Toast the bread and spread mashed avocado.',
        'Boil the eggs for 7 minutes and add them with tomato.',
      ],
    },
  },
  {
    id: 'tofu_scramble',
    name: { ro: 'Tofu scramble cu spanac', en: 'Tofu scramble with spinach' },
    mealType: 'breakfast',
    minutes: 15,
    ingredients: [
      r('tofu', 150),
      r('spinach', 40),
      r('onion', 30),
      r('tomato', 60),
      r('olive_oil', 5),
      r('wholewheat_bread', 50),
    ],
    steps: {
      ro: [
        'Călește ceapa, apoi adaugă tofu sfărâmat.',
        'Pune spanacul și roșia, gătește 3–4 minute.',
        'Servește cu pâine.',
      ],
      en: [
        'Sauté the onion, then add crumbled tofu.',
        'Add spinach and tomato and cook for 3–4 minutes.',
        'Serve with bread.',
      ],
    },
  },
  {
    id: 'buckwheat_milk',
    name: { ro: 'Hrișcă cu lapte și miere', en: 'Buckwheat porridge with milk' },
    mealType: 'breakfast',
    minutes: 20,
    ingredients: [r('buckwheat', 60), r('milk', 250), r('honey', 10)],
    steps: {
      ro: ['Fierbe hrișca în apă 12–15 minute.', 'Adaugă laptele cald și mierea.'],
      en: ['Boil the buckwheat in water for 12–15 minutes.', 'Add warm milk and honey.'],
    },
  },
  {
    id: 'buckwheat_soy_berries',
    name: { ro: 'Hrișcă cu băutură de soia și fructe', en: 'Buckwheat with soy milk and berries' },
    mealType: 'breakfast',
    minutes: 20,
    ingredients: [
      r('buckwheat', 60),
      r('soy_milk', 200),
      r('berries', 80),
      r('sunflower_seeds', 10),
    ],
    steps: {
      ro: ['Fierbe hrișca 12–15 minute.', 'Adaugă băutura de soia, fructele și semințele.'],
      en: ['Boil the buckwheat for 12–15 minutes.', 'Add soy milk, berries and seeds.'],
    },
  },
  {
    id: 'peanut_banana_toast',
    name: { ro: 'Pâine cu unt de arahide și banană', en: 'Peanut butter and banana toast' },
    mealType: 'breakfast',
    minutes: 5,
    ingredients: [r('wholewheat_bread', 70), r('peanut_butter', 20), r('banana', 100)],
    steps: {
      ro: ['Întinde untul de arahide pe pâine.', 'Adaugă banana feliată.'],
      en: ['Spread peanut butter on the bread.', 'Top with sliced banana.'],
    },
  },
  {
    id: 'chia_pudding',
    name: { ro: 'Budincă de chia cu fructe', en: 'Chia pudding with fruit' },
    mealType: 'breakfast',
    minutes: 5,
    ingredients: [r('chia', 30), r('soy_milk', 200), r('berries', 80), r('banana', 50)],
    steps: {
      ro: [
        'Amestecă chia cu băutura de soia și lasă peste noapte la frigider.',
        'Dimineața adaugă fructele.',
      ],
      en: ['Mix chia with soy milk and refrigerate overnight.', 'Add the fruit in the morning.'],
    },
  },
  {
    id: 'smoothie_bowl',
    name: { ro: 'Smoothie bowl cu semințe', en: 'Smoothie bowl with seeds' },
    mealType: 'breakfast',
    minutes: 5,
    ingredients: [
      r('banana', 120),
      r('berries', 100),
      r('soy_milk', 150),
      r('chia', 15),
      r('sunflower_seeds', 15),
    ],
    steps: {
      ro: [
        'Mixează banana, fructele și băutura de soia.',
        'Toarnă într-un bol și presară semințele.',
      ],
      en: ['Blend the banana, berries and soy milk.', 'Pour into a bowl and sprinkle with seeds.'],
    },
  },
  {
    id: 'rice_cakes_avocado',
    name: { ro: 'Rondele de orez cu avocado și roșii', en: 'Rice cakes with avocado and tomato' },
    mealType: 'breakfast',
    minutes: 5,
    ingredients: [r('rice_cakes', 40), r('avocado', 70), r('tomato', 80), r('sunflower_seeds', 10)],
    steps: {
      ro: ['Întinde avocado pe rondele.', 'Adaugă roșiile feliate și semințele.'],
      en: ['Spread avocado on the rice cakes.', 'Add sliced tomato and seeds.'],
    },
  },
  {
    id: 'rice_cakes_cottage',
    name: {
      ro: 'Rondele de orez cu brânză de vaci și legume',
      en: 'Rice cakes with cottage cheese and vegetables',
    },
    mealType: 'breakfast',
    minutes: 5,
    ingredients: [
      r('rice_cakes', 30),
      r('cottage_cheese', 150),
      r('cucumber', 80),
      r('tomato', 80),
    ],
    steps: {
      ro: ['Întinde brânza pe rondele.', 'Servește cu castraveți și roșii.'],
      en: ['Spread the cottage cheese on the rice cakes.', 'Serve with cucumber and tomato.'],
    },
  },

  {
    id: 'skyr_bowl',
    name: { ro: 'Bol cu skyr, fructe și ovăz', en: 'Skyr bowl with berries and oats' },
    mealType: 'breakfast',
    minutes: 3,
    ingredients: [r('skyr', 250), r('berries', 80), r('oats', 25)],
    steps: {
      ro: ['Pune skyr-ul într-un bol, adaugă fructele și ovăzul.'],
      en: ['Put the skyr in a bowl and top with berries and oats.'],
    },
  },
  {
    id: 'egg_white_omelette',
    name: { ro: 'Omletă din albușuri cu ciuperci', en: 'Egg white omelette with mushrooms' },
    mealType: 'breakfast',
    minutes: 12,
    ingredients: [
      r('egg_whites', 200),
      r('eggs', 50),
      r('mushrooms', 60),
      r('spinach', 50),
      r('wholewheat_bread', 35),
    ],
    steps: {
      ro: [
        'Călește ciupercile și spanacul fără ulei, într-o tigaie antiaderentă.',
        'Adaugă albușurile și oul bătute, gătește la foc mic.',
      ],
      en: [
        'Cook the mushrooms and spinach in a non-stick pan.',
        'Add the beaten egg whites and egg and cook on low heat.',
      ],
    },
  },
  {
    id: 'tofu_burrito',
    name: { ro: 'Burrito cu tofu și fasole', en: 'Tofu and bean breakfast burrito' },
    mealType: 'breakfast',
    minutes: 15,
    ingredients: [r('tortilla', 60), r('tofu', 120), r('beans', 80), r('tomato', 50)],
    steps: {
      ro: [
        'Rumenește tofu sfărâmat și adaugă fasolea.',
        'Pune amestecul și roșia pe lipie și rulează.',
      ],
      en: [
        'Brown the crumbled tofu and add the beans.',
        'Fill the tortilla with the mix and tomato and roll it up.',
      ],
    },
  },
  {
    id: 'lentil_pancakes',
    name: { ro: 'Clătite din linte cu spanac', en: 'Lentil pancakes with spinach' },
    mealType: 'breakfast',
    minutes: 20,
    ingredients: [
      r('lentils', 60),
      r('spinach', 40),
      r('onion', 20),
      r('sunflower_oil', 5),
      r('tomato', 80),
    ],
    steps: {
      ro: [
        'Înmoaie lintea 2 ore, apoi mixeaz-o cu puțină apă și spanac.',
        'Coace clătitele într-o tigaie unsă.',
        'Servește cu roșii.',
      ],
      en: [
        'Soak the lentils for 2 hours, then blend with a little water and spinach.',
        'Cook the pancakes in a greased pan.',
        'Serve with tomato.',
      ],
    },
  },

  // ======================= MESE PRINCIPALE =======================
  {
    id: 'tempeh_stirfry',
    name: { ro: 'Tempeh cu legume la wok', en: 'Tempeh vegetable stir-fry' },
    mealType: 'main',
    minutes: 20,
    ingredients: [
      r('tempeh', 150),
      r('frozen_veg', 200),
      r('rice', 50),
      r('soy_sauce', 10),
      r('sunflower_oil', 5),
    ],
    steps: {
      ro: [
        'Fierbe orezul.',
        'Rumenește tempeh-ul feliat, adaugă legumele și gătește 6–8 minute.',
        'Adaugă sosul de soia.',
      ],
      en: [
        'Cook the rice.',
        'Brown the sliced tempeh, add the vegetables and cook for 6–8 minutes.',
        'Add the soy sauce.',
      ],
    },
  },
  {
    id: 'seitan_peppers',
    name: { ro: 'Seitan cu ardei și orez', en: 'Seitan with peppers and rice' },
    mealType: 'main',
    minutes: 20,
    ingredients: [
      r('seitan', 150),
      r('bell_pepper', 100),
      r('onion', 50),
      r('rice', 50),
      r('sunflower_oil', 8),
    ],
    steps: {
      ro: [
        'Fierbe orezul.',
        'Călește ceapa și ardeiul, adaugă seitanul feliat și gătește 5 minute.',
      ],
      en: [
        'Cook the rice.',
        'Sauté the onion and pepper, add the sliced seitan and cook for 5 minutes.',
      ],
    },
  },
  {
    id: 'lentil_pasta_edamame',
    name: {
      ro: 'Paste din linte cu edamame și roșii',
      en: 'Lentil pasta with edamame and tomatoes',
    },
    mealType: 'main',
    minutes: 15,
    ingredients: [
      r('red_lentil_pasta', 80),
      r('edamame', 80),
      r('canned_tomatoes', 100),
      r('spinach', 50),
      r('olive_oil', 5),
    ],
    steps: {
      ro: [
        'Fierbe pastele 8 minute.',
        'Încălzește roșiile cu edamame și spanac.',
        'Amestecă cu pastele.',
      ],
      en: [
        'Cook the pasta for 8 minutes.',
        'Warm the tomatoes with edamame and spinach.',
        'Toss with the pasta.',
      ],
    },
  },
  {
    id: 'tofu_curry',
    name: { ro: 'Curry de tofu cu spanac', en: 'Tofu and spinach curry' },
    mealType: 'main',
    minutes: 25,
    ingredients: [
      r('tofu', 180),
      r('canned_tomatoes', 150),
      r('spinach', 60),
      r('onion', 40),
      r('rice', 50),
      r('sunflower_oil', 5),
    ],
    steps: {
      ro: [
        'Fierbe orezul.',
        'Călește ceapa, adaugă roșiile și condimente de curry, apoi tofu cubulețe.',
        'Fierbe 10 minute și adaugă spanacul.',
      ],
      en: [
        'Cook the rice.',
        'Sauté the onion, add tomatoes and curry spices, then the cubed tofu.',
        'Simmer for 10 minutes and stir in the spinach.',
      ],
    },
  },
  {
    id: 'lentil_tofu_salad',
    name: { ro: 'Salată de linte cu tofu', en: 'Lentil salad with tofu' },
    mealType: 'main',
    minutes: 25,
    ingredients: [
      r('lentils', 60),
      r('tofu', 100),
      r('cucumber', 100),
      r('tomato', 80),
      r('olive_oil', 5),
      r('lemon', 10),
    ],
    steps: {
      ro: [
        'Fierbe lintea 20 de minute și las-o să se răcească.',
        'Amestecă cu tofu, legumele, uleiul și lămâia.',
      ],
      en: [
        'Boil the lentils for 20 minutes and let them cool.',
        'Mix with tofu, vegetables, oil and lemon.',
      ],
    },
  },
  {
    id: 'vegetable_frittata',
    name: { ro: 'Frittata cu dovlecel și telemea', en: 'Zucchini and feta frittata' },
    mealType: 'main',
    minutes: 30,
    ingredients: [
      r('eggs', 150),
      r('egg_whites', 100),
      r('zucchini', 120),
      r('telemea', 30),
      r('potatoes', 100),
      r('olive_oil', 5),
    ],
    steps: {
      ro: [
        'Călește cartofii și dovlecelul tăiați subțire.',
        'Toarnă ouăle bătute cu brânza.',
        'Coace la 180 °C timp de 15 minute.',
      ],
      en: [
        'Sauté thinly sliced potatoes and zucchini.',
        'Pour over the eggs beaten with the cheese.',
        'Bake at 180 °C for 15 minutes.',
      ],
    },
  },
  {
    id: 'chicken_rice_broccoli',
    name: { ro: 'Pui cu orez și broccoli', en: 'Chicken with rice and broccoli' },
    mealType: 'main',
    minutes: 25,
    ingredients: [r('chicken_breast', 150), r('rice', 70), r('broccoli', 150), r('olive_oil', 10)],
    steps: {
      ro: [
        'Fierbe orezul.',
        'Gătește pieptul de pui la tigaie, câte 5–6 minute pe fiecare parte.',
        'Fierbe broccoli la abur 5 minute și stropește cu ulei.',
      ],
      en: [
        'Cook the rice.',
        'Pan-fry the chicken breast for 5–6 minutes per side.',
        'Steam the broccoli for 5 minutes and drizzle with oil.',
      ],
    },
  },
  {
    id: 'lentil_soup',
    name: { ro: 'Supă de linte', en: 'Lentil soup' },
    mealType: 'main',
    minutes: 35,
    ingredients: [
      r('lentils', 70),
      r('carrot', 60),
      r('onion', 50),
      r('tomato_paste', 15),
      r('olive_oil', 10),
    ],
    steps: {
      ro: [
        'Călește ceapa și morcovul în ulei.',
        'Adaugă lintea, pasta de roșii și 600 ml apă.',
        'Fierbe 25 de minute, până se înmoaie lintea.',
      ],
      en: [
        'Sauté the onion and carrot in oil.',
        'Add lentils, tomato paste and 600 ml water.',
        'Simmer for 25 minutes until the lentils are soft.',
      ],
    },
  },
  {
    id: 'turkey_pasta',
    name: { ro: 'Paste cu curcan și sos de roșii', en: 'Turkey pasta with tomato sauce' },
    mealType: 'main',
    minutes: 25,
    ingredients: [
      r('pasta', 80),
      r('turkey_breast', 120),
      r('canned_tomatoes', 150),
      r('onion', 40),
      r('olive_oil', 8),
      r('parmesan', 10),
    ],
    steps: {
      ro: [
        'Fierbe pastele.',
        'Rumenește curcanul tăiat cubulețe cu ceapa, apoi adaugă roșiile și fierbe 10 minute.',
        'Amestecă cu pastele și presară parmezan.',
      ],
      en: [
        'Cook the pasta.',
        'Brown the diced turkey with onion, add tomatoes and simmer for 10 minutes.',
        'Toss with the pasta and sprinkle parmesan.',
      ],
    },
  },
  {
    id: 'beef_buckwheat',
    name: { ro: 'Vită cu hrișcă și legume', en: 'Beef with buckwheat and vegetables' },
    mealType: 'main',
    minutes: 35,
    ingredients: [
      r('beef_lean', 130),
      r('buckwheat', 70),
      r('onion', 40),
      r('carrot', 50),
      r('sunflower_oil', 8),
    ],
    steps: {
      ro: [
        'Fierbe hrișca.',
        'Călește carnea cu ceapa și morcovul, apoi înăbușă 15 minute.',
        'Servește carnea peste hrișcă.',
      ],
      en: [
        'Cook the buckwheat.',
        'Sauté the beef with onion and carrot, then braise for 15 minutes.',
        'Serve the beef over the buckwheat.',
      ],
    },
  },
  {
    id: 'salmon_potatoes',
    name: { ro: 'Somon cu cartofi și spanac', en: 'Salmon with potatoes and spinach' },
    mealType: 'main',
    minutes: 30,
    ingredients: [
      r('salmon', 130),
      r('potatoes', 250),
      r('spinach', 50),
      r('olive_oil', 5),
      r('lemon', 10),
    ],
    steps: {
      ro: [
        'Fierbe cartofii.',
        'Coace somonul la 200 °C timp de 12–15 minute.',
        'Servește cu spanac, ulei și lămâie.',
      ],
      en: [
        'Boil the potatoes.',
        'Bake the salmon at 200 °C for 12–15 minutes.',
        'Serve with spinach, oil and lemon.',
      ],
    },
  },
  {
    id: 'chickpea_curry',
    name: { ro: 'Curry de năut cu orez', en: 'Chickpea curry with rice' },
    mealType: 'main',
    minutes: 30,
    ingredients: [
      r('chickpeas', 200),
      r('canned_tomatoes', 150),
      r('onion', 50),
      r('spinach', 50),
      r('rice', 60),
      r('sunflower_oil', 10),
    ],
    steps: {
      ro: [
        'Fierbe orezul.',
        'Călește ceapa, adaugă roșiile, năutul și condimente de curry; fierbe 10 minute.',
        'Adaugă spanacul la final.',
      ],
      en: [
        'Cook the rice.',
        'Sauté the onion, add tomatoes, chickpeas and curry spices; simmer for 10 minutes.',
        'Stir in the spinach at the end.',
      ],
    },
  },
  {
    id: 'tuna_salad',
    name: { ro: 'Salată cu ton și porumb', en: 'Tuna and corn salad' },
    mealType: 'main',
    minutes: 10,
    ingredients: [
      r('tuna_canned', 120),
      r('lettuce', 80),
      r('tomato', 100),
      r('cucumber', 100),
      r('corn', 50),
      r('olive_oil', 10),
      r('wholewheat_bread', 50),
    ],
    steps: {
      ro: [
        'Taie legumele și pune-le într-un bol.',
        'Adaugă tonul scurs și porumbul.',
        'Stropește cu ulei și servește cu pâine.',
      ],
      en: [
        'Chop the vegetables into a bowl.',
        'Add the drained tuna and corn.',
        'Drizzle with oil and serve with bread.',
      ],
    },
  },
  {
    id: 'chicken_wrap',
    name: { ro: 'Lipie cu pui și legume', en: 'Chicken wrap' },
    mealType: 'main',
    minutes: 20,
    ingredients: [
      r('tortilla', 70),
      r('chicken_breast', 120),
      r('lettuce', 40),
      r('tomato', 60),
      r('greek_yogurt', 40),
    ],
    steps: {
      ro: [
        'Gătește puiul la tigaie și taie-l fâșii.',
        'Pune pe lipie salata, roșia, puiul și iaurtul.',
        'Rulează strâns.',
      ],
      en: [
        'Pan-cook the chicken and slice it.',
        'Fill the wrap with lettuce, tomato, chicken and yogurt.',
        'Roll it tightly.',
      ],
    },
  },
  {
    id: 'bean_stew',
    name: { ro: 'Tocăniță de fasole', en: 'Bean stew' },
    mealType: 'main',
    minutes: 30,
    ingredients: [
      r('beans', 220),
      r('onion', 50),
      r('carrot', 50),
      r('bell_pepper', 60),
      r('tomato_paste', 20),
      r('sunflower_oil', 10),
      r('wholewheat_bread', 50),
    ],
    steps: {
      ro: [
        'Călește ceapa, morcovul și ardeiul.',
        'Adaugă fasolea, pasta de roșii și puțină apă; fierbe 15 minute.',
        'Servește cu pâine.',
      ],
      en: [
        'Sauté the onion, carrot and pepper.',
        'Add beans, tomato paste and a little water; simmer for 15 minutes.',
        'Serve with bread.',
      ],
    },
  },
  {
    id: 'tofu_stirfry',
    name: { ro: 'Tofu cu legume la wok', en: 'Tofu vegetable stir-fry' },
    mealType: 'main',
    minutes: 20,
    ingredients: [
      r('tofu', 150),
      r('frozen_veg', 200),
      r('rice', 60),
      r('soy_sauce', 15),
      r('sunflower_oil', 8),
    ],
    steps: {
      ro: [
        'Fierbe orezul.',
        'Rumenește tofu cubulețe, adaugă legumele și călește 6–8 minute.',
        'Stropește cu sos de soia.',
      ],
      en: [
        'Cook the rice.',
        'Brown the cubed tofu, add vegetables and stir-fry for 6–8 minutes.',
        'Season with soy sauce.',
      ],
    },
  },
  {
    id: 'pork_cabbage',
    name: { ro: 'Varză călită cu mușchi de porc', en: 'Braised cabbage with pork' },
    mealType: 'main',
    minutes: 40,
    ingredients: [
      r('pork_loin', 120),
      r('cabbage', 250),
      r('onion', 40),
      r('tomato_paste', 15),
      r('sunflower_oil', 8),
      r('potatoes', 150),
    ],
    steps: {
      ro: [
        'Rumenește carnea cu ceapa.',
        'Adaugă varza tocată și pasta de roșii; înăbușă 25 de minute.',
        'Servește cu cartofi fierți.',
      ],
      en: [
        'Brown the pork with onion.',
        'Add shredded cabbage and tomato paste; braise for 25 minutes.',
        'Serve with boiled potatoes.',
      ],
    },
  },
  {
    id: 'quinoa_salad',
    name: { ro: 'Salată de quinoa cu năut și telemea', en: 'Quinoa salad with chickpeas and feta' },
    mealType: 'main',
    minutes: 20,
    ingredients: [
      r('quinoa', 70),
      r('chickpeas', 100),
      r('cucumber', 100),
      r('tomato', 100),
      r('telemea', 40),
      r('olive_oil', 10),
      r('lemon', 10),
    ],
    steps: {
      ro: [
        'Fierbe quinoa 15 minute și las-o să se răcească.',
        'Amestecă cu năutul, legumele și brânza.',
        'Asezonează cu ulei și lămâie.',
      ],
      en: [
        'Cook the quinoa for 15 minutes and let it cool.',
        'Mix with chickpeas, vegetables and cheese.',
        'Dress with oil and lemon.',
      ],
    },
  },
  {
    id: 'mamaliga_branza',
    name: {
      ro: 'Mămăligă cu brânză, smântână și ou',
      en: 'Polenta with cheese, sour cream and egg',
    },
    mealType: 'main',
    minutes: 30,
    ingredients: [r('cornmeal', 80), r('telemea', 60), r('sour_cream', 40), r('eggs', 50)],
    steps: {
      ro: [
        'Fierbe mălaiul în 350 ml apă, amestecând, 20 de minute.',
        'Prăjește oul ochi.',
        'Servește mămăliga cu brânză, smântână și ou.',
      ],
      en: [
        'Cook the cornmeal in 350 ml water for 20 minutes, stirring.',
        'Fry the egg.',
        'Serve the polenta with cheese, sour cream and egg.',
      ],
    },
  },
  {
    id: 'chicken_soup',
    name: { ro: 'Supă de pui cu tăiței', en: 'Chicken noodle soup' },
    mealType: 'main',
    minutes: 40,
    ingredients: [
      r('chicken_breast', 120),
      r('potatoes', 100),
      r('carrot', 50),
      r('onion', 40),
      r('pasta', 25),
    ],
    steps: {
      ro: [
        'Fierbe puiul cu ceapa și morcovul 20 de minute.',
        'Adaugă cartofii și, după 10 minute, tăițeii.',
        'Fierbe încă 5 minute.',
      ],
      en: [
        'Simmer the chicken with onion and carrot for 20 minutes.',
        'Add the potatoes and, after 10 minutes, the noodles.',
        'Cook for 5 more minutes.',
      ],
    },
  },
  {
    id: 'baked_cod',
    name: { ro: 'Cod la cuptor cu legume', en: 'Baked cod with vegetables' },
    mealType: 'main',
    minutes: 30,
    ingredients: [
      r('cod', 180),
      r('zucchini', 150),
      r('bell_pepper', 100),
      r('olive_oil', 10),
      r('potatoes', 150),
    ],
    steps: {
      ro: [
        'Taie legumele și cartofii, stropește-i cu ulei.',
        'Pune peștele deasupra și coace la 200 °C timp de 20 de minute.',
      ],
      en: [
        'Slice the vegetables and potatoes and drizzle with oil.',
        'Place the fish on top and bake at 200 °C for 20 minutes.',
      ],
    },
  },
  {
    id: 'chicken_avocado_salad',
    name: { ro: 'Salată cu pui și avocado', en: 'Chicken and avocado salad' },
    mealType: 'main',
    minutes: 20,
    ingredients: [
      r('chicken_breast', 130),
      r('lettuce', 80),
      r('avocado', 60),
      r('tomato', 100),
      r('cucumber', 80),
      r('olive_oil', 5),
    ],
    steps: {
      ro: [
        'Gătește puiul și taie-l fâșii.',
        'Amestecă legumele și avocado.',
        'Adaugă puiul și uleiul.',
      ],
      en: [
        'Cook the chicken and slice it.',
        'Toss the vegetables and avocado.',
        'Add the chicken and oil.',
      ],
    },
  },
  {
    id: 'shrimp_pasta',
    name: { ro: 'Paste cu creveți', en: 'Shrimp pasta' },
    mealType: 'main',
    minutes: 20,
    ingredients: [
      r('pasta', 80),
      r('shrimp', 130),
      r('garlic', 5),
      r('olive_oil', 10),
      r('canned_tomatoes', 100),
    ],
    steps: {
      ro: [
        'Fierbe pastele.',
        'Călește usturoiul, adaugă creveții și roșiile; gătește 5 minute.',
        'Amestecă cu pastele.',
      ],
      en: [
        'Cook the pasta.',
        'Sauté the garlic, add shrimp and tomatoes; cook for 5 minutes.',
        'Toss with the pasta.',
      ],
    },
  },
  {
    id: 'stuffed_peppers',
    name: {
      ro: 'Ardei umpluți cu orez și ciuperci',
      en: 'Peppers stuffed with rice and mushrooms',
    },
    mealType: 'main',
    minutes: 50,
    ingredients: [
      r('bell_pepper', 200),
      r('rice', 50),
      r('mushrooms', 80),
      r('onion', 40),
      r('canned_tomatoes', 100),
      r('sunflower_oil', 8),
    ],
    steps: {
      ro: [
        'Călește ceapa și ciupercile, amestecă cu orezul.',
        'Umple ardeii și pune-i într-o oală cu roșiile.',
        'Fierbe la foc mic 35 de minute.',
      ],
      en: [
        'Sauté the onion and mushrooms and mix with the rice.',
        'Stuff the peppers and place them in a pot with the tomatoes.',
        'Simmer for 35 minutes.',
      ],
    },
  },
  {
    id: 'turkey_meatballs',
    name: { ro: 'Chiftele de curcan cu dovlecei', en: 'Turkey meatballs with zucchini' },
    mealType: 'main',
    minutes: 35,
    ingredients: [
      r('turkey_breast', 150),
      r('eggs', 30),
      r('oats', 15),
      r('zucchini', 200),
      r('canned_tomatoes', 100),
      r('olive_oil', 5),
    ],
    steps: {
      ro: [
        'Amestecă carnea tocată cu oul și ovăzul; formează chiftele.',
        'Coace-le la 200 °C timp de 20 de minute.',
        'Servește cu dovlecei călăți în sos de roșii.',
      ],
      en: [
        'Mix the minced turkey with egg and oats; shape meatballs.',
        'Bake at 200 °C for 20 minutes.',
        'Serve with zucchini cooked in tomato sauce.',
      ],
    },
  },
  {
    id: 'cottage_cheese_salad',
    name: { ro: 'Brânză de vaci cu legume', en: 'Cottage cheese with vegetables' },
    mealType: 'main',
    minutes: 5,
    ingredients: [
      r('cottage_cheese', 200),
      r('cucumber', 100),
      r('tomato', 100),
      r('wholewheat_bread', 40),
    ],
    steps: {
      ro: ['Taie legumele cubulețe.', 'Amestecă-le cu brânza și servește cu pâine.'],
      en: ['Dice the vegetables.', 'Mix with the cottage cheese and serve with bread.'],
    },
  },
  {
    id: 'lentil_bolognese',
    name: { ro: 'Paste bolognese cu linte', en: 'Lentil bolognese' },
    mealType: 'main',
    minutes: 35,
    ingredients: [
      r('lentils', 60),
      r('pasta', 70),
      r('canned_tomatoes', 150),
      r('onion', 40),
      r('carrot', 40),
      r('olive_oil', 8),
    ],
    steps: {
      ro: [
        'Călește ceapa și morcovul, adaugă lintea, roșiile și 200 ml apă.',
        'Fierbe 25 de minute.',
        'Servește peste paste.',
      ],
      en: [
        'Sauté the onion and carrot, add lentils, tomatoes and 200 ml water.',
        'Simmer for 25 minutes.',
        'Serve over pasta.',
      ],
    },
  },
  {
    id: 'eggplant_mozzarella',
    name: { ro: 'Vinete la cuptor cu mozzarella', en: 'Baked eggplant with mozzarella' },
    mealType: 'main',
    minutes: 40,
    ingredients: [
      r('eggplant', 250),
      r('mozzarella', 60),
      r('canned_tomatoes', 100),
      r('olive_oil', 10),
      r('wholewheat_bread', 40),
    ],
    steps: {
      ro: [
        'Taie vinetele felii și coace-le 15 minute.',
        'Pune sos de roșii și mozzarella deasupra.',
        'Coace încă 10 minute.',
      ],
      en: [
        'Slice the eggplant and bake for 15 minutes.',
        'Top with tomato sauce and mozzarella.',
        'Bake for another 10 minutes.',
      ],
    },
  },
  {
    id: 'beef_stew',
    name: { ro: 'Tocăniță de vită cu legume', en: 'Beef and vegetable stew' },
    mealType: 'main',
    minutes: 60,
    ingredients: [
      r('beef_lean', 140),
      r('potatoes', 200),
      r('carrot', 60),
      r('onion', 40),
      r('peas', 60),
      r('sunflower_oil', 8),
    ],
    steps: {
      ro: [
        'Rumenește carnea cu ceapa.',
        'Adaugă legumele și apă cât să le acopere.',
        'Fierbe la foc mic 45 de minute.',
      ],
      en: [
        'Brown the beef with onion.',
        'Add the vegetables and enough water to cover.',
        'Simmer for 45 minutes.',
      ],
    },
  },
  {
    id: 'salmon_quinoa',
    name: { ro: 'Somon cu quinoa și broccoli', en: 'Salmon with quinoa and broccoli' },
    mealType: 'main',
    minutes: 25,
    ingredients: [r('salmon', 120), r('quinoa', 60), r('broccoli', 120), r('lemon', 10)],
    steps: {
      ro: [
        'Fierbe quinoa.',
        'Coace somonul 12–15 minute.',
        'Servește cu broccoli la abur și lămâie.',
      ],
      en: [
        'Cook the quinoa.',
        'Bake the salmon for 12–15 minutes.',
        'Serve with steamed broccoli and lemon.',
      ],
    },
  },
  {
    id: 'hummus_bowl',
    name: { ro: 'Bol cu humus, quinoa și legume', en: 'Hummus, quinoa and vegetable bowl' },
    mealType: 'main',
    minutes: 20,
    ingredients: [
      r('hummus', 80),
      r('quinoa', 60),
      r('chickpeas', 80),
      r('cucumber', 80),
      r('tomato', 80),
      r('bell_pepper', 60),
    ],
    steps: {
      ro: [
        'Fierbe quinoa.',
        'Pune în bol quinoa, năutul și legumele tăiate.',
        'Adaugă humusul deasupra.',
      ],
      en: [
        'Cook the quinoa.',
        'Arrange the quinoa, chickpeas and chopped vegetables in a bowl.',
        'Top with hummus.',
      ],
    },
  },
  {
    id: 'buckwheat_mushrooms',
    name: { ro: 'Hrișcă cu ciuperci', en: 'Buckwheat with mushrooms' },
    mealType: 'main',
    minutes: 25,
    ingredients: [
      r('buckwheat', 80),
      r('mushrooms', 150),
      r('onion', 50),
      r('sunflower_oil', 10),
      r('chickpeas', 100),
    ],
    steps: {
      ro: ['Fierbe hrișca.', 'Călește ceapa și ciupercile, adaugă năutul.', 'Amestecă totul.'],
      en: [
        'Cook the buckwheat.',
        'Sauté the onion and mushrooms, add the chickpeas.',
        'Mix everything together.',
      ],
    },
  },
  {
    id: 'sweet_potato_beans',
    name: {
      ro: 'Cartof dulce copt cu fasole și porumb',
      en: 'Baked sweet potato with beans and corn',
    },
    mealType: 'main',
    minutes: 45,
    ingredients: [r('sweet_potato', 250), r('beans', 150), r('corn', 50), r('avocado', 40)],
    steps: {
      ro: [
        'Coace cartoful dulce la 200 °C timp de 40 de minute.',
        'Încălzește fasolea cu porumbul.',
        'Umple cartoful și adaugă avocado.',
      ],
      en: [
        'Bake the sweet potato at 200 °C for 40 minutes.',
        'Warm the beans with the corn.',
        'Fill the potato and top with avocado.',
      ],
    },
  },
  {
    id: 'lentil_vegetable_stew',
    name: { ro: 'Mâncare de linte cu cartofi', en: 'Lentil and potato stew' },
    mealType: 'main',
    minutes: 40,
    ingredients: [
      r('lentils', 70),
      r('potatoes', 150),
      r('carrot', 60),
      r('onion', 40),
      r('tomato_paste', 15),
      r('sunflower_oil', 8),
    ],
    steps: {
      ro: [
        'Călește ceapa și morcovul.',
        'Adaugă lintea, cartofii, pasta de roșii și apă.',
        'Fierbe 30 de minute.',
      ],
      en: [
        'Sauté the onion and carrot.',
        'Add lentils, potatoes, tomato paste and water.',
        'Simmer for 30 minutes.',
      ],
    },
  },
  {
    id: 'tofu_rice_peas',
    name: { ro: 'Orez cu tofu și mazăre', en: 'Rice with tofu and peas' },
    mealType: 'main',
    minutes: 25,
    ingredients: [
      r('rice', 70),
      r('tofu', 120),
      r('peas', 100),
      r('carrot', 60),
      r('sunflower_oil', 10),
    ],
    steps: {
      ro: ['Fierbe orezul.', 'Rumenește tofu, adaugă morcovul și mazărea.', 'Amestecă cu orezul.'],
      en: ['Cook the rice.', 'Brown the tofu, add carrot and peas.', 'Stir in the rice.'],
    },
  },
  {
    id: 'egg_potato_salad',
    name: { ro: 'Salată de cartofi cu ou', en: 'Potato and egg salad' },
    mealType: 'main',
    minutes: 25,
    ingredients: [
      r('potatoes', 200),
      r('eggs', 100),
      r('cucumber', 80),
      r('onion', 20),
      r('sunflower_oil', 10),
      r('mustard', 5),
    ],
    steps: {
      ro: [
        'Fierbe cartofii și ouăle.',
        'Taie totul cubulețe, adaugă castravetele și ceapa.',
        'Asezonează cu ulei și muștar.',
      ],
      en: [
        'Boil the potatoes and eggs.',
        'Dice everything and add cucumber and onion.',
        'Dress with oil and mustard.',
      ],
    },
  },

  // ======================= GUSTARI =======================
  {
    id: 'apple_peanut_butter',
    name: { ro: 'Măr cu unt de arahide', en: 'Apple with peanut butter' },
    mealType: 'snack',
    minutes: 2,
    ingredients: [r('apple', 150), r('peanut_butter', 15)],
    steps: {
      ro: ['Taie mărul felii și servește cu unt de arahide.'],
      en: ['Slice the apple and serve with peanut butter.'],
    },
  },
  {
    id: 'yogurt_berries',
    name: { ro: 'Iaurt cu fructe de pădure', en: 'Yogurt with berries' },
    mealType: 'snack',
    minutes: 2,
    ingredients: [r('yogurt', 200), r('berries', 80)],
    steps: { ro: ['Amestecă iaurtul cu fructele.'], en: ['Mix the yogurt with the berries.'] },
  },
  {
    id: 'nut_mix',
    name: { ro: 'Mix de nuci și stafide', en: 'Nut and raisin mix' },
    mealType: 'snack',
    minutes: 1,
    ingredients: [r('almonds', 15), r('walnuts', 15), r('raisins', 15)],
    steps: { ro: ['Amestecă nucile cu stafidele.'], en: ['Mix the nuts with the raisins.'] },
  },
  {
    id: 'kefir_banana',
    name: { ro: 'Chefir cu banană', en: 'Kefir with banana' },
    mealType: 'snack',
    minutes: 2,
    ingredients: [r('kefir', 250), r('banana', 100)],
    steps: {
      ro: ['Servește chefirul cu banana sau mixează-le.'],
      en: ['Serve the kefir with the banana or blend them.'],
    },
  },
  {
    id: 'hummus_veggies',
    name: { ro: 'Humus cu bețișoare de legume', en: 'Hummus with vegetable sticks' },
    mealType: 'snack',
    minutes: 5,
    ingredients: [r('hummus', 60), r('carrot', 120), r('cucumber', 80)],
    steps: {
      ro: ['Taie legumele bețișoare și servește cu humus.'],
      en: ['Cut the vegetables into sticks and serve with hummus.'],
    },
  },
  {
    id: 'cottage_honey',
    name: { ro: 'Brânză de vaci cu miere și nuci', en: 'Cottage cheese with honey and walnuts' },
    mealType: 'snack',
    minutes: 2,
    ingredients: [r('cottage_cheese', 150), r('honey', 10), r('walnuts', 10)],
    steps: {
      ro: ['Pune mierea și nucile peste brânză.'],
      en: ['Top the cottage cheese with honey and walnuts.'],
    },
  },
  {
    id: 'rice_cakes_peanut',
    name: { ro: 'Rondele de orez cu unt de arahide', en: 'Rice cakes with peanut butter' },
    mealType: 'snack',
    minutes: 2,
    ingredients: [r('rice_cakes', 20), r('peanut_butter', 15), r('banana', 50)],
    steps: {
      ro: ['Întinde untul de arahide și adaugă banana.'],
      en: ['Spread the peanut butter and add the banana.'],
    },
  },
  {
    id: 'orange_almonds',
    name: { ro: 'Portocală și migdale', en: 'Orange and almonds' },
    mealType: 'snack',
    minutes: 1,
    ingredients: [r('orange', 150), r('almonds', 20)],
    steps: { ro: ['Servește portocala cu migdalele.'], en: ['Serve the orange with the almonds.'] },
  },
  {
    id: 'fruit_salad',
    name: { ro: 'Salată de fructe', en: 'Fruit salad' },
    mealType: 'snack',
    minutes: 5,
    ingredients: [r('apple', 100), r('orange', 100), r('banana', 60)],
    steps: { ro: ['Taie fructele cubulețe și amestecă-le.'], en: ['Dice the fruit and mix.'] },
  },
  {
    id: 'roasted_chickpeas',
    name: { ro: 'Năut crocant la cuptor', en: 'Crispy roasted chickpeas' },
    mealType: 'snack',
    minutes: 30,
    ingredients: [r('chickpeas', 120), r('olive_oil', 5)],
    steps: {
      ro: [
        'Usucă năutul, amestecă-l cu ulei și condimente.',
        'Coace la 200 °C timp de 25 de minute.',
      ],
      en: ['Pat the chickpeas dry and toss with oil and spices.', 'Bake at 200 °C for 25 minutes.'],
    },
  },
  {
    id: 'eggs_cucumber',
    name: { ro: 'Ouă fierte cu castravete', en: 'Boiled eggs with cucumber' },
    mealType: 'snack',
    minutes: 10,
    ingredients: [r('eggs', 100), r('cucumber', 100)],
    steps: {
      ro: ['Fierbe ouăle 9 minute și servește cu castravete.'],
      en: ['Boil the eggs for 9 minutes and serve with cucumber.'],
    },
  },
  {
    id: 'tuna_rice_cakes',
    name: { ro: 'Rondele de orez cu ton', en: 'Rice cakes with tuna' },
    mealType: 'snack',
    minutes: 3,
    ingredients: [r('rice_cakes', 20), r('tuna_canned', 60), r('cucumber', 50)],
    steps: {
      ro: ['Pune tonul scurs și castravetele pe rondele.'],
      en: ['Top the rice cakes with drained tuna and cucumber.'],
    },
  },
  {
    id: 'turkey_sandwich',
    name: { ro: 'Sandviș cu curcan', en: 'Turkey sandwich' },
    mealType: 'snack',
    minutes: 10,
    ingredients: [
      r('wholewheat_bread', 35),
      r('turkey_breast', 60),
      r('lettuce', 20),
      r('tomato', 40),
    ],
    steps: {
      ro: ['Gătește curcanul la tigaie și taie-l felii.', 'Pune-l pe pâine cu salată și roșie.'],
      en: ['Pan-cook the turkey and slice it.', 'Place it on the bread with lettuce and tomato.'],
    },
  },
  {
    id: 'apple_seeds',
    name: { ro: 'Măr cu semințe de floarea-soarelui', en: 'Apple with sunflower seeds' },
    mealType: 'snack',
    minutes: 2,
    ingredients: [r('apple', 150), r('sunflower_seeds', 20)],
    steps: { ro: ['Servește mărul cu semințele.'], en: ['Serve the apple with the seeds.'] },
  },
  {
    id: 'tofu_veggie_snack',
    name: { ro: 'Tofu cu legume crude', en: 'Tofu with raw vegetables' },
    mealType: 'snack',
    minutes: 5,
    ingredients: [r('tofu', 100), r('carrot', 80), r('cucumber', 80)],
    steps: {
      ro: ['Taie tofu și legumele bețișoare.'],
      en: ['Cut the tofu and vegetables into sticks.'],
    },
  },
  {
    id: 'skyr_snack',
    name: { ro: 'Skyr cu fructe de pădure', en: 'Skyr with berries' },
    mealType: 'snack',
    minutes: 2,
    ingredients: [r('skyr', 150), r('berries', 50)],
    steps: { ro: ['Amestecă skyr-ul cu fructele.'], en: ['Mix the skyr with the berries.'] },
  },
  {
    id: 'edamame_snack',
    name: { ro: 'Edamame cu lămâie', en: 'Edamame with lemon' },
    mealType: 'snack',
    minutes: 6,
    ingredients: [r('edamame', 150), r('lemon', 5)],
    steps: {
      ro: ['Fierbe edamame 5 minute și stropește cu lămâie.'],
      en: ['Boil the edamame for 5 minutes and add lemon.'],
    },
  },
  {
    id: 'soy_shake',
    name: { ro: 'Shake de soia cu banană', en: 'Soy and banana shake' },
    mealType: 'snack',
    minutes: 3,
    ingredients: [r('soy_milk', 250), r('banana', 80), r('chia', 10)],
    steps: { ro: ['Mixează toate ingredientele.'], en: ['Blend all the ingredients.'] },
  },
];
