import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useSignOut } from '@/features/auth';
import { useSession } from '@/shared/auth/session';
import { Avatar, Card, Icon, Screen, SettingsGroup, SettingsRow, Text, tokens, useTheme } from '@/shared/design';
import type { Preference } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useMe } from '../api/useMe';

const APPEARANCES: { value: Preference; label: string }[] = [
  { value: 'system', label: en.account.system },
  { value: 'dark', label: en.account.dark },
  { value: 'light', label: en.account.light },
];

/* Appearance stays an inline picker here until its own screen lands with the other preferences. */
function AppearancePicker() {
  const { colors, preference, setPreference } = useTheme();
  return (
    <View style={{ gap: tokens.space['space-1'] }} accessibilityRole="radiogroup" accessibilityLabel={en.account.appearance}>
      <Text variant="label" color="ink-muted">
        {en.account.appearance}
      </Text>
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

function Stat({ text }: { text: string }) {
  return (
    <Text variant="caption" color="ink-muted">
      {text}
    </Text>
  );
}

function ProfileCard() {
  const { email: sessionEmail } = useSession();
  const me = useMe().data;
  const email = me?.email ?? sessionEmail;
  const name = me?.displayName?.trim() || null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={en.account.profile} onPress={() => router.push('/account/profile')}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-4'] }}>
        <Avatar name={name} email={email} />
        <View style={{ flex: 1, gap: tokens.space['space-1'] }}>
          <Text variant="title" numberOfLines={1}>
            {name ?? email ?? ''}
          </Text>
          {name && email ? (
            <Text variant="caption" color="ink-muted" numberOfLines={1}>
              {email}
            </Text>
          ) : null}
          {me ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.space['space-3'] }}>
              <Stat text={en.account.stats.vehicles(me.stats.vehicles)} />
              <Stat text={en.account.stats.events(me.stats.events)} />
              <Stat text={en.account.stats.passports(me.stats.passports)} />
            </View>
          ) : null}
        </View>
        <Icon name="chevron" size={18} color="ink-muted" />
      </Card>
    </Pressable>
  );
}

/** Rows whose screens arrive in later tasks already point at their paths. */
const go = (path: string) => () => router.push(path as never);

export function AccountScreen() {
  const signOut = useSignOut();
  return (
    <Screen scroll>
      <Text variant="display" accessibilityRole="header">
        {en.tabs.account}
      </Text>
      <ProfileCard />
      <SettingsGroup title={en.account.groups.account}>
        <SettingsRow label={en.account.signInMethods} onPress={go('/account/sign-in-methods')} />
      </SettingsGroup>
      <SettingsGroup title={en.account.groups.security}>
        <SettingsRow label={en.account.security} onPress={go('/account/security')} />
      </SettingsGroup>
      <SettingsGroup title={en.account.groups.preferences}>
        <SettingsRow label={en.account.notifications} onPress={go('/account/notifications')} />
        <SettingsRow label={en.account.language} onPress={go('/account/language')} />
        <SettingsRow label={en.account.units} onPress={go('/account/units')} />
      </SettingsGroup>
      <AppearancePicker />
      <SettingsGroup title={en.account.groups.help}>
        <SettingsRow label={en.account.support} onPress={go('/account/support')} />
      </SettingsGroup>
      <SettingsGroup title={en.account.groups.about}>
        <SettingsRow label={en.account.legal} onPress={go('/account/legal')} />
        <SettingsRow label={en.account.acknowledgements} onPress={go('/account/acknowledgements')} />
      </SettingsGroup>
      <SettingsGroup testID="group-sign-out">
        <SettingsRow label={en.account.signOut} chevron={false} disabled={signOut.isPending} onPress={() => signOut.mutate()} />
      </SettingsGroup>
      <SettingsGroup testID="group-delete">
        <SettingsRow label={en.account.deleteAccount} danger onPress={go('/account/delete')} />
      </SettingsGroup>
      <Text variant="caption" color="ink-muted" style={{ textAlign: 'center' }}>
        {en.account.versionLine(Constants.expoConfig?.version ?? '')}
      </Text>
    </Screen>
  );
}
