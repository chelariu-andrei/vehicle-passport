import { View } from 'react-native';

import { tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';

/** Three bars under the app bar; the first `step` are filled. */
export function StepProgress({ step }: { step: 1 | 2 | 3 }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={en.journey.progress(step)}
      style={{ flexDirection: 'row', gap: tokens.space['space-2'], paddingHorizontal: tokens.space['space-4'] }}
    >
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= step ? colors.brand : colors['line-strong'] }}
        />
      ))}
    </View>
  );
}
