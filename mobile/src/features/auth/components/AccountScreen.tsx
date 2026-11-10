import Constants from 'expo-constants';
import { Pressable, View } from 'react-native';

import { useSession } from '@/shared/auth/session';
import { Button, Icon, Screen, Text, tokens, useTheme } from '@/shared/design';
import type { Preference } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useSignOut } from '../api/useAuth';

const APPEARANCES: { value: Preference; label: string }[] = [
  { value: 'system', label: en.account.system },
  { value: 'dark', label: en.account.dark },
  { value: 'light', label: en.account.light },
];

function AppearancePicker() {
  const { colors, preference, setPreference } = useTheme();
  return (
    <View style={{ gap: tokens.space['space-1'] }} accessibilityRole="radiogroup" accessibilityLabel={en.account.appearance}>
      <Text variant="label">{en.account.appearance}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
        {APPEARANCES.map(({ value, label }) => {
          const selected = value === preference;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={() => setPreference(value)}
              style={{
                minHeight: 48,
                minWidth: 48,
                paddingHorizontal: tokens.space['space-4'],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: tokens.space['space-1'],
                borderRadius: tokens.radius['radius-pill'],
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? colors.brand : colors['line-strong'],
                backgroundColor: selected ? colors['surface-raised'] : 'transparent',
              }}
            >
              {selected ? <Icon name="check" size={16} color="brand" /> : null}
              <Text variant="label">{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: tokens.space['space-1'] }}>
      <Text variant="label">{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

export function AccountScreen() {
  const { email } = useSession();
  const signOut = useSignOut();
  return (
    <Screen scroll>
      <Text variant="display" accessibilityRole="header">
        {en.tabs.account}
      </Text>
      {email ? <Detail label={en.account.email} value={email} /> : null}
      <AppearancePicker />
      <Button kind="secondary" title={en.account.signOut} loading={signOut.isPending} onPress={() => signOut.mutate()} />
      <Detail label={en.account.version} value={Constants.expoConfig?.version ?? ''} />
      <Text variant="caption" color="ink-muted">
        {en.account.modelCredit}
      </Text>
    </Screen>
  );
}
