import { View } from 'react-native';

import { en } from '../../i18n/en';
import { useTheme } from '../theme';
import { tokens, type ColorName } from '../tokens.generated';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type Evidence = 'ESTIMATED' | 'USER_CONFIRMED' | 'DOCUMENTED' | 'VERIFIED';

// Each level differs by shape as well as colour: dashed, ringed, filled, sealed.
const LOOK: Record<Evidence, { color: ColorName; icon?: IconName; filled?: boolean; dashed?: boolean }> = {
  ESTIMATED: { color: 'evidence-estimated', dashed: true },
  USER_CONFIRMED: { color: 'evidence-confirmed', icon: 'check' },
  DOCUMENTED: { color: 'evidence-documented', icon: 'doc', filled: true },
  VERIFIED: { color: 'evidence-verified', icon: 'shield' },
};

export function EvidenceBadge({ evidence }: { evidence: Evidence }) {
  const { colors } = useTheme();
  const look = LOOK[evidence];
  const word = en.evidence[evidence];
  const ink: ColorName = look.filled ? 'on-brand' : look.color;

  return (
    <View
      accessible
      accessibilityLabel={en.evidence.a11y(word)}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space['space-1'],
        paddingHorizontal: tokens.space['space-2'],
        paddingVertical: tokens.space['space-1'],
        borderRadius: tokens.radius['radius-sm'],
        borderWidth: 1.5,
        borderStyle: look.dashed ? 'dashed' : 'solid',
        borderColor: colors[look.color],
        backgroundColor: look.filled ? colors[look.color] : 'transparent',
      }}
    >
      {look.icon ? <Icon name={look.icon} size={14} color={ink} /> : null}
      <Text variant="caption" color={ink}>
        {word}
      </Text>
    </View>
  );
}
