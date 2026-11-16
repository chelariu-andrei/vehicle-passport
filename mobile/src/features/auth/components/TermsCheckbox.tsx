import { Pressable, View } from 'react-native';

import { Icon, Text, tokens, useTheme } from '@/shared/design';
import { useStrings } from '@/shared/i18n';

import { LegalLink } from './LegalLink';

type Props = { checked: boolean; onChange(checked: boolean): void };

const BOX = 28;

export function TermsCheckbox({ checked, onChange }: Props) {
  const s = useStrings();
  const { colors } = useTheme();
  const label = `${s.auth.termsLabel} ${s.auth.terms} ${s.auth.and} ${s.auth.privacy}`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-3'] }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
        hitSlop={10}
        style={{
          width: BOX,
          height: BOX,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: tokens.radius['radius-sm'],
          borderWidth: 1,
          borderColor: checked ? colors.brand : colors['line-strong'],
          backgroundColor: checked ? colors.brand : colors['surface-raised'],
        }}
      >
        {checked ? <Icon name="check" size={18} color="on-brand" /> : null}
      </Pressable>
      <Text style={{ flex: 1 }}>
        {s.auth.termsLabel} <LegalLink type="terms" /> {s.auth.and} <LegalLink type="privacy" />
      </Text>
    </View>
  );
}
