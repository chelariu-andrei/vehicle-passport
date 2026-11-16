import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useSignOut } from '@/features/auth';
import { useSession } from '@/shared/auth/session';
import { Avatar, Card, Icon, Screen, SettingsGroup, SettingsRow, Text, tokens } from '@/shared/design';
import { useStrings, useT } from '@/shared/i18n';

import { useMe } from '../api/useMe';

function Stat({ text }: { text: string }) {
  return (
    <Text variant="caption" color="ink-muted">
      {text}
    </Text>
  );
}

function ProfileCard() {
  const t = useT();
  const s = useStrings();
  const { email: sessionEmail } = useSession();
  const me = useMe().data;
  const email = me?.email ?? sessionEmail;
  const name = me?.displayName?.trim() || null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('account.profile')} onPress={() => router.push('/account/profile')}>
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
              <Stat text={s.account.stats.vehicles(me.stats.vehicles)} />
              <Stat text={s.account.stats.events(me.stats.events)} />
              <Stat text={s.account.stats.passports(me.stats.passports)} />
            </View>
          ) : null}
        </View>
        <Icon name="chevron" size={18} color="ink-muted" />
      </Card>
    </Pressable>
  );
}

/** Rows whose screens arrive in a later task already point at their path. */
const go = (path: string) => () => router.push(path as never);

export function AccountScreen() {
  const t = useT();
  const s = useStrings();
  const signOut = useSignOut();
  return (
    <Screen scroll>
      <Text variant="display" accessibilityRole="header">
        {t('tabs.account')}
      </Text>
      <ProfileCard />
      <SettingsGroup title={t('account.groups.account')}>
        <SettingsRow label={t('account.signInMethods')} onPress={() => router.push('/account/sign-in-methods')} />
      </SettingsGroup>
      <SettingsGroup title={t('account.groups.security')}>
        <SettingsRow label={t('account.security')} onPress={() => router.push('/account/security')} />
      </SettingsGroup>
      <SettingsGroup title={t('account.groups.preferences')}>
        <SettingsRow label={t('account.notifications')} onPress={() => router.push('/account/notifications')} />
        <SettingsRow label={t('account.language')} onPress={() => router.push('/account/language')} />
        <SettingsRow label={t('account.units')} onPress={() => router.push('/account/units')} />
        <SettingsRow label={t('settings.appearance.title')} onPress={() => router.push('/account/appearance')} />
      </SettingsGroup>
      <SettingsGroup title={t('account.groups.help')}>
        <SettingsRow label={t('account.support')} onPress={() => router.push('/account/support')} />
      </SettingsGroup>
      <SettingsGroup title={t('account.groups.about')}>
        <SettingsRow label={t('account.legal')} onPress={() => router.push('/account/legal')} />
        <SettingsRow label={t('account.acknowledgements')} onPress={() => router.push('/account/acknowledgements')} />
      </SettingsGroup>
      <SettingsGroup testID="group-sign-out">
        <SettingsRow label={t('account.signOut')} chevron={false} disabled={signOut.isPending} onPress={() => signOut.mutate()} />
      </SettingsGroup>
      <SettingsGroup testID="group-delete">
        <SettingsRow label={t('account.deleteAccount')} danger onPress={go('/account/delete')} />
      </SettingsGroup>
      <Text variant="caption" color="ink-muted" style={{ textAlign: 'center' }}>
        {s.account.versionLine(Constants.expoConfig?.version ?? '')}
      </Text>
    </Screen>
  );
}
