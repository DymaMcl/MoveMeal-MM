import { Ionicons } from '@expo/vector-icons';
import { getFood, type FoodCategory, type ShoppingItem } from '@movemeal/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { Card, Notice } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

const ORDER: FoodCategory[] = [
  'vegetables',
  'fruits',
  'meat_fish',
  'dairy_eggs',
  'grains',
  'legumes',
  'nuts_seeds',
  'oils_condiments',
];

function amount(grams: number) {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1).replace('.', ',')} kg` : `${grams} g`;
}

/** Lista de cumparaturi a saptamanii, grupata pe categorii; poate fi trimisa sau salvata. */
export default function ShoppingList() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const { session } = useAppState();
  const [list, setList] = useState<Partial<Record<FoodCategory, ShoppingItem[]>> | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    header: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md },
    round: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    title: { ...th.font.title, flex: 1, fontSize: 22 },
    item: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm, paddingVertical: 6 },
    name: { ...th.font.body, flex: 1 },
    grams: { ...th.font.body, fontWeight: '700' },
  }));

  useEffect(() => {
    if (!session) return;
    api
      .shoppingList(session.token)
      .then(setList)
      .catch(() => setError(true));
  }, [session]);

  function exportText() {
    if (!list) return '';
    return ORDER.filter((c) => list[c]?.length)
      .map(
        (c) =>
          `${t(`nutrition.categories.${c}`)}\n` +
          list[c]!.map((i) => `- ${getFood(i.foodId)!.name[language]}: ${amount(i.grams)}`).join(
            '\n',
          ),
      )
      .join('\n\n');
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" style={s.round} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={s.title}>{t('nutrition.shoppingTitle')}</Text>
          {list ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share"
              style={s.round}
              onPress={() =>
                Share.share({ message: `${t('nutrition.shoppingTitle')}\n\n${exportText()}` })
              }
            >
              <Ionicons name="share-outline" size={20} color={theme.colors.primary} />
            </Pressable>
          ) : null}
        </View>
        <Text style={theme.font.caption}>{t('nutrition.shoppingHint')}</Text>
        {error ? <Notice>{t('errors.network')}</Notice> : null}
        {!list && !error ? <ActivityIndicator color={theme.colors.primary} /> : null}
        {list
          ? ORDER.filter((c) => list[c]?.length).map((c) => (
              <Card key={c} title={t(`nutrition.categories.${c}`)}>
                {list[c]!.map((item) => {
                  const done = checked.has(item.foodId);
                  return (
                    <Pressable
                      key={item.foodId}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: done }}
                      style={s.item}
                      onPress={() =>
                        setChecked((prev) => {
                          const next = new Set(prev);
                          if (done) next.delete(item.foodId);
                          else next.add(item.foodId);
                          return next;
                        })
                      }
                    >
                      <Ionicons
                        name={done ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={done ? theme.colors.primary : theme.colors.textMuted}
                      />
                      <Text
                        style={[
                          s.name,
                          done && { textDecorationLine: 'line-through', opacity: 0.6 },
                        ]}
                      >
                        {getFood(item.foodId)!.name[language]}
                      </Text>
                      <Text style={s.grams}>{amount(item.grams)}</Text>
                    </Pressable>
                  );
                })}
              </Card>
            ))
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}
