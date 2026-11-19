import { Ionicons } from '@expo/vector-icons';
import {
  getFood,
  getRecipe,
  recipeAllergens,
  recipeDiets,
  recipeNutrients,
  roundNutrients,
  scaleNutrients,
  substituteFoods,
  type MealSlot,
  foodName,
  recipeName,
  recipeSteps,
} from '@movemeal/shared';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '@/components/toast';
import { Button, Card } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useNutrition } from '@/state/nutrition-state';
import { useStyles, useTheme } from '@/theme';

export default function RecipeDetail() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { program, eatPlanned } = useNutrition();
  const params = useLocalSearchParams<{
    id: string;
    portions?: string;
    day?: string;
    slot?: string;
  }>();
  const [openIngredient, setOpenIngredient] = useState<string | null>(null);
  const recipe = getRecipe(params.id);

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    back: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    hero: {
      borderRadius: th.radius.xl,
      padding: th.spacing.lg,
      gap: th.spacing.sm,
      minHeight: 170,
      justifyContent: 'flex-end',
    },
    heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
    heroMeta: { color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: th.radius.pill,
      backgroundColor: 'rgba(255,255,255,0.22)',
    },
    tagText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    macros: { flexDirection: 'row', justifyContent: 'space-between' },
    macro: { alignItems: 'center', flex: 1, gap: 2 },
    macroValue: { fontSize: 20, fontWeight: '800', color: th.colors.text },
    ingredient: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      paddingVertical: 6,
    },
    ingredientName: { ...th.font.body, flex: 1 },
    ingredientGrams: { ...th.font.body, fontWeight: '700' },
    substitutes: {
      backgroundColor: th.colors.surfaceAlt,
      borderRadius: th.radius.md,
      padding: th.spacing.sm + 2,
      gap: 4,
    },
    step: { flexDirection: 'row', gap: th.spacing.md },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: th.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumberText: { fontWeight: '800', color: th.colors.accent },
    stepText: { ...th.font.body, flex: 1 },
  }));

  if (!recipe) return <Redirect href="/meals" />;

  const portions = Number(params.portions ?? '1') || 1;
  const nutrients = roundNutrients(scaleNutrients(recipeNutrients(recipe), portions));
  const allergens = recipeAllergens(recipe);
  const diets = recipeDiets(recipe);
  const prefs = program?.preferences ?? {
    diet: 'omnivore' as const,
    allergens: [],
    excludedFoods: [],
  };
  const portionText =
    portions === 1
      ? t('nutrition.portion')
      : t('nutrition.portions', { n: String(portions).replace('.', ',') });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <Pressable accessibilityRole="button" style={s.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>

        <LinearGradient
          colors={theme.gradients.warm}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <Ionicons name="restaurant" size={40} color="rgba(255,255,255,0.9)" />
          <Text style={s.heroTitle}>{recipeName(recipe, language)}</Text>
          <Text style={s.heroMeta}>
            {t('nutrition.minutes', { n: recipe.minutes })} · {portionText}
          </Text>
          <View style={s.tags}>
            {diets.slice(0, 1).map((d) => (
              <View key={d} style={s.tag}>
                <Text style={s.tagText}>{t(`nutrition.setup.diets.${d}`)}</Text>
              </View>
            ))}
            {!allergens.includes('gluten') ? (
              <View style={s.tag}>
                <Text style={s.tagText}>{t('nutrition.recipe.glutenFree')}</Text>
              </View>
            ) : null}
            {!allergens.includes('milk') ? (
              <View style={s.tag}>
                <Text style={s.tagText}>{t('nutrition.recipe.lactoseFree')}</Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        <Card title={t('nutrition.recipe.perServing', { portions: portionText })} icon="pie-chart">
          <View style={s.macros}>
            <View style={s.macro}>
              <Text style={s.macroValue}>{nutrients.kcal}</Text>
              <Text style={theme.font.caption}>{t('common.kcal')}</Text>
            </View>
            <View style={s.macro}>
              <Text style={[s.macroValue, { color: theme.colors.protein }]}>
                {Math.round(nutrients.protein)}
              </Text>
              <Text style={theme.font.caption}>{t('onboarding.summary.protein')}</Text>
            </View>
            <View style={s.macro}>
              <Text style={[s.macroValue, { color: theme.colors.carbs }]}>
                {Math.round(nutrients.carbs)}
              </Text>
              <Text style={theme.font.caption}>{t('onboarding.summary.carbs')}</Text>
            </View>
            <View style={s.macro}>
              <Text style={[s.macroValue, { color: theme.colors.fat }]}>
                {Math.round(nutrients.fat)}
              </Text>
              <Text style={theme.font.caption}>{t('onboarding.summary.fat')}</Text>
            </View>
          </View>
          <Text style={theme.font.caption}>
            {allergens.length
              ? `${t('nutrition.recipe.allergens')}: ${allergens.map((a) => t(`nutrition.setup.allergens.${a}`)).join(', ')}`
              : t('nutrition.recipe.noAllergens')}
          </Text>
        </Card>

        <Card title={t('nutrition.recipe.ingredients')} icon="basket">
          {recipe.ingredients.map((i) => {
            const food = getFood(i.foodId)!;
            const grams = Math.round(i.grams * portions);
            const open = openIngredient === i.foodId;
            const subs = open ? substituteFoods(i.foodId, grams, prefs) : [];
            return (
              <View key={i.foodId}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint={t('nutrition.recipe.substitutes')}
                  style={s.ingredient}
                  onPress={() => setOpenIngredient(open ? null : i.foodId)}
                >
                  <Text style={s.ingredientName}>{foodName(food, language)}</Text>
                  <Text style={s.ingredientGrams}>
                    {grams} {t('common.g')}
                  </Text>
                  <Ionicons name="swap-horizontal" size={16} color={theme.colors.textMuted} />
                </Pressable>
                {open ? (
                  <View style={s.substitutes}>
                    <Text style={theme.font.caption}>
                      {subs.length
                        ? t('nutrition.recipe.substitutesHint')
                        : t('nutrition.recipe.noSubstitutes')}
                    </Text>
                    {subs.map((sub) => (
                      <Text key={sub.foodId} style={theme.font.body}>
                        • {foodName(getFood(sub.foodId)!, language)} — {sub.grams} {t('common.g')}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>

        <Card title={t('nutrition.recipe.steps')} icon="list">
          {recipeSteps(recipe, language).map((text, i) => (
            <View key={i} style={s.step}>
              <View style={s.stepNumber}>
                <Text style={s.stepNumberText}>{i + 1}</Text>
              </View>
              <Text style={s.stepText}>{text}</Text>
            </View>
          ))}
        </Card>

        {params.day && params.slot ? (
          <Button
            title={t('nutrition.recipe.addToLog')}
            icon="add-circle"
            onPress={async () => {
              try {
                await eatPlanned(params.day!, params.slot as MealSlot);
                toast(t('journal.added'));
                router.back();
              } catch {
                toast(t('nutrition.eaten'));
              }
            }}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
