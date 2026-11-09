import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { tokens } from '../tokens.generated';

type Props = { children: ReactNode; scroll?: boolean };

export function Screen({ children, scroll = false }: Props) {
  const { colors } = useTheme();
  const padding = { padding: tokens.space['space-4'], gap: tokens.space['space-4'] };
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={padding} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
