import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { authErrorMessage, useUpdatePassword } from '@/features/auth';
import { AuthFailed, type AccountIdentity, type SocialProvider } from '@/shared/auth/session';
import { AppBar, Button, ErrorState, Field, Screen, SettingsGroup, Skeleton, Text, toast, tokens } from '@/shared/design';
import { useStrings, useValidationMessage, type Strings } from '@/shared/i18n';
import { useBack } from '@/shared/navigation/useBack';
import { passwordSchema } from '@/shared/validation';

import { useIdentities, useLinkProvider, useUnlinkIdentity } from '../api/useIdentities';

type Method = AccountIdentity['provider'];

/** What to tell the person when connecting went wrong. */
function linkMessage(error: unknown, s: Strings): string {
  if (error instanceof AuthFailed) {
    if (error.failure === 'account-exists-other-provider') return s.signInMethods.alreadyUsed;
    if (error.failure === 'network') return s.errors.network;
  }
  return s.signInMethods.connectFailed;
}

function unlinkMessage(error: unknown, s: Strings): string {
  if (error instanceof AuthFailed && (error.failure === 'last-identity' || error.failure === 'network')) return authErrorMessage(error, s);
  return s.signInMethods.disconnectFailed;
}

type RowProps = {
  name: string;
  connected: boolean;
  /** Email cannot be added from here, only removed. */
  canConnect: boolean;
  /** This is the only way left to sign in. */
  last: boolean;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
};

function MethodRow({ name, connected, canConnect, last, busy, onConnect, onDisconnect }: RowProps) {
  const s = useStrings().signInMethods;
  const disabled = busy || (connected && last);
  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space['space-3'],
        paddingHorizontal: tokens.space['space-4'],
        paddingVertical: tokens.space['space-2'],
      }}
    >
      <View style={{ flex: 1 }}>
        <Text>{name}</Text>
        <Text variant="caption" color="ink-muted">
          {connected ? s.connected : s.notConnected}
        </Text>
      </View>
      {connected || canConnect ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={connected ? s.disconnectLabel(name) : s.connectLabel(name)}
          accessibilityState={{ disabled, busy }}
          disabled={disabled}
          onPress={connected ? onDisconnect : onConnect}
          style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', paddingHorizontal: tokens.space['space-3'], opacity: disabled ? 0.5 : 1 }}
        >
          <Text variant="label" color={connected ? 'ink-muted' : 'brand'}>
            {connected ? s.disconnect : s.connect}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ChangePassword() {
  const s = useStrings();
  const localized = useValidationMessage();
  const update = useUpdatePassword();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();

  const submit = () => {
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(localized(parsed.error.issues[0]?.message));
      return;
    }
    setError(undefined);
    update.mutate(parsed.data, {
      onSuccess: () => {
        setPassword('');
        toast(s.signInMethods.passwordChanged);
      },
      onError: (failure) => setError(authErrorMessage(failure, s)),
    });
  };

  return (
    <View style={{ gap: tokens.space['space-3'] }}>
      <Text variant="label" color="ink-muted" accessibilityRole="header">
        {s.signInMethods.passwordGroup}
      </Text>
      <Field
        label={s.signInMethods.newPassword}
        value={password}
        onChangeText={setPassword}
        error={error}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Button kind="secondary" title={s.signInMethods.changePassword} loading={update.isPending} onPress={submit} />
    </View>
  );
}

/** Account > Sign-in methods: which of Apple, Google and email sign in to this account, and the password. */
export function SignInMethodsScreen() {
  const s = useStrings();
  const back = useBack('/account');
  const identities = useIdentities();
  const link = useLinkProvider();
  const unlink = useUnlinkIdentity();
  const [message, setMessage] = useState<string>();
  const header = <AppBar onBack={back} title={s.signInMethods.title} />;

  if (!identities.data) {
    return (
      <Screen header={header}>
        {identities.isError ? <ErrorState title={s.signInMethods.loadError} onRetry={() => void identities.refetch()} /> : <Skeleton height={160} />}
      </Screen>
    );
  }

  const connected = identities.data;
  const methods: { method: Method; name: string }[] = [
    ...(Platform.OS === 'ios' ? [{ method: 'apple' as const, name: s.signInMethods.apple }] : []),
    { method: 'google', name: s.signInMethods.google },
    { method: 'email', name: s.signInMethods.email },
  ];
  const busy = link.isPending || unlink.isPending;

  const connect = (provider: SocialProvider) => {
    setMessage(undefined);
    link.mutate(provider, { onError: (error) => setMessage(linkMessage(error, s)) });
  };
  const disconnect = (identity: AccountIdentity) => {
    setMessage(undefined);
    unlink.mutate(identity.id, { onError: (error) => setMessage(unlinkMessage(error, s)) });
  };

  const onlyOne = connected.length <= 1;
  return (
    <Screen scroll header={header}>
      <Text color="ink-muted">{s.signInMethods.intro}</Text>
      <SettingsGroup>
        {methods.map(({ method, name }) => {
          const identity = connected.find((candidate) => candidate.provider === method);
          return (
            <MethodRow
              key={method}
              name={name}
              connected={identity !== undefined}
              canConnect={method !== 'email'}
              last={onlyOne}
              busy={busy}
              onConnect={() => connect(method as SocialProvider)}
              onDisconnect={() => identity && disconnect(identity)}
            />
          );
        })}
      </SettingsGroup>
      {onlyOne ? (
        <Text variant="caption" color="ink-muted">
          {s.auth.lastIdentity}
        </Text>
      ) : null}
      {message ? (
        <Text accessibilityRole="alert" color="danger">
          {message}
        </Text>
      ) : null}
      {connected.some((identity) => identity.provider === 'email') ? <ChangePassword /> : null}
    </Screen>
  );
}
