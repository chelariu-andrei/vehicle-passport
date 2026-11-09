import { View } from 'react-native';

import { Icon, useTheme } from '@/shared/design';

/** The static stage (P18): shown while the viewer loads, when it fails and when it is disabled. */
export function StagePlaceholder() {
  const { colors } = useTheme();
  return (
    <View
      testID="stage-placeholder"
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors['brand-deep'] }}
    >
      <Icon name="car" size={64} color="on-brand-deep" />
    </View>
  );
}
