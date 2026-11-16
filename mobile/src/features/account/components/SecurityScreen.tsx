import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { authErrorMessage } from '@/features/auth';
import { signOutOthers } from '@/shared/auth/session';
import { AppBar, ConfirmSheet, Screen, SettingsGroup, SettingsRow, Switch, Text, toast, tokens, useTheme } from '@/shared/design';
import { useStrings } from '@/shared/i18n';
import { useBack } from '@/shared/navigation/useBack';

import { appLock, authenticate, biometricCapability, LOCK_TIMEOUTS, useAppLock, type LockTimeout } from '../model/appLock';

function TimeoutChoice({ value, onChange }: { value: LockTimeout; onChange: (value: LockTimeout) => void }) {
  const s = useStrings().security;
  const { colors } = useTheme();
  return (
    <View style={{ gap: tokens.space['space-2'] }}>
      <Text variant="caption" color="ink-muted">
        {s.timeoutLabel}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={s.timeoutLabel} style={{ flexDirection: 'row', gap: tokens.space['space-2'] }}>
        {LOCK_TIMEOUTS.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={s.timeout[option]}
              accessibilityState={{ selected }}
              onPress={() => onChange(option)}
              style={{
                flex: 1,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: tokens.space['space-2'],
                borderRadius: tokens.radius['radius-md'],
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? colors.brand : colors['line-strong'],
                backgroundColor: selected ? colors['surface-raised'] : 'transparent',
              }}
            >
              <Text variant="caption" style={{ textAlign: 'center' }}>
                {s.timeout[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Account > Password and security: the app lock, and signing out of every other device. */
export function SecurityScreen() {
  const s = useStrings();
  const back = useBack('/account');
  const lock = useAppLock();
  const [note, setNote] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const others = useMutation({ mutationFn: signOutOthers });

  const toggle = async (on: boolean) => {
    setNote(undefined);
    if (!on) {
      await appLock.update({ enabled: false });
      return;
    }
    const capability = await biometricCapability();
    if (capability !== 'available') {
      setNote(capability === 'no-hardware' ? s.security.noHardware : s.security.notEnrolled);
      return;
    }
    // Turning the lock on must prove the person can open it, or they could lock themselves out.
    if (await authenticate(s.security.promptMessage)) await appLock.update({ enabled: true });
    else setNote(s.security.authFailed);
  };

  const signOutElsewhere = () => {
    setConfirming(false);
    others.mutate(undefined, {
      onSuccess: () => toast(s.security.signedOutOthers),
      onError: (error) => toast(authErrorMessage(error, s)),
    });
  };

  return (
    <Screen scroll header={<AppBar onBack={back} title={s.security.title} />}>
      <View style={{ gap: tokens.space['space-2'] }}>
        <Text variant="label" color="ink-muted" accessibilityRole="header">
          {s.security.appLockGroup}
        </Text>
        <Switch label={s.security.biometrics} value={lock.enabled} onValueChange={(on) => void toggle(on)} />
        <Text variant="caption" color="ink-muted">
          {s.security.biometricsHelper}
        </Text>
        {note ? (
          <Text accessibilityRole="alert" color="danger">
            {note}
          </Text>
        ) : null}
        {lock.enabled ? <TimeoutChoice value={lock.timeout} onChange={(timeout) => void appLock.update({ timeout })} /> : null}
      </View>
      <SettingsGroup title={s.security.devicesGroup}>
        <SettingsRow label={s.security.signOutOthers} chevron={false} disabled={others.isPending} onPress={() => setConfirming(true)} />
      </SettingsGroup>
      <ConfirmSheet
        visible={confirming}
        title={s.security.confirmTitle}
        body={s.security.confirmBody}
        confirmLabel={s.security.confirm}
        dismissLabel={s.security.cancel}
        onConfirm={signOutElsewhere}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}
