export const colors = {
  primary: '#1F9D63',
  primaryDark: '#157A4B',
  primarySoft: '#E8F5EE',
  accent: '#F28C28',
  accentSoft: '#FFF1E3',
  background: '#F7F8FA',
  surface: '#FFFFFF',
  text: '#16202A',
  textMuted: '#667085',
  border: '#E4E7EC',
  danger: '#D92D20',
  warning: '#B54708',
  warningSoft: '#FFFAEB',
  protein: '#4C6FFF',
  carbs: '#F2B705',
  fat: '#E5484D',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

export const font = {
  title: { fontSize: 26, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 18, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  caption: { fontSize: 13, color: colors.textMuted },
};
