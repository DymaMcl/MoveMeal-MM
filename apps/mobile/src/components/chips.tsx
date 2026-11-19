import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useStyles, useTheme } from '@/theme';

export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
}

/** Butoane rotunjite pentru alegere multipla (sau unica, cu `single`). */
export function Chips<T extends string | number>({
  options,
  selected,
  onToggle,
  disabled,
}: {
  options: ChipOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
  /** Optiunile care nu mai pot fi alese (de exemplu cand s-a atins limita). */
  disabled?: (value: T) => boolean;
}) {
  const theme = useTheme();
  const s = useStyles((th) => ({
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      minHeight: 44,
      borderRadius: th.radius.pill,
      borderWidth: 1.5,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
    },
    active: { borderColor: th.colors.primary, backgroundColor: th.colors.primarySoft },
    label: { fontSize: 15, fontWeight: '600', color: th.colors.text },
    activeLabel: { color: th.colors.primaryStrong },
  }));

  return (
    <View style={s.wrap}>
      {options.map((o) => {
        const active = selected.includes(o.value);
        const off = !active && disabled?.(o.value);
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active, disabled: !!off }}
            disabled={!!off}
            onPress={() => onToggle(o.value)}
            style={[s.chip, active && s.active, off && { opacity: 0.4 }]}
          >
            {active ? (
              <Ionicons name="checkmark" size={16} color={theme.colors.primaryStrong} />
            ) : null}
            <Text style={[s.label, active && s.activeLabel]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
