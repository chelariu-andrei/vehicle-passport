import { View } from 'react-native';

import { useIsOnline } from '../../api/onlineStatus';
import { en } from '../../i18n/en';
import { useTheme } from '../theme';
import { tokens } from '../tokens.generated';
import { Icon } from './Icon';
import { Text } from './Text';

/** Non-blocking notice shown while the device is offline. */
export function OfflineBanner() {
  const online = useIsOnline();
  const { colors } = useTheme();
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space['space-2'],
        padding: tokens.space['space-3'],
        backgroundColor: colors['surface-raised'],
      }}
    >
      <Icon name="alert" size={20} color="ink-muted" />
      <Text variant="body" color="ink-muted">
        {en.errors.offlineBanner}
      </Text>
    </View>
  );
}
