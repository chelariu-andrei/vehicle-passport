import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { isApiError } from '@/shared/api';
import { AppBar, Button, Card, ConfirmSheet, Icon, Screen, Text, toast, tokens, useTheme } from '@/shared/design';
import { useStrings } from '@/shared/i18n';
import { useBack } from '@/shared/navigation/useBack';

import { useScheduleDeletion, useScheduledDeletion } from '../api/useDeletion';
import { SharingUnavailableError, useExportData } from '../api/useExport';
import { appLock, authenticate } from '../model/appLock';
import { DeletionBanner } from './DeletionBanner';

const BOX = 28;

function UnderstandCheckbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-3'], minHeight: 48 }}
    >
      <View
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
      </View>
      <Text style={{ flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

/** Account > Delete account: what goes and what stays, a data export, and the scheduled deletion (cancellable until its date). */
export function DeleteAccountScreen() {
  const s = useStrings();
  const back = useBack('/account');
  const scheduledFor = useScheduledDeletion();
  const schedule = useScheduleDeletion();
  const exportData = useExportData();
  const [understood, setUnderstood] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Set from the first tap until the request settles: a second tap must not ask for biometrics or send again.
  const inFlight = useRef(false);

  const download = () =>
    exportData.mutate(undefined, {
      onError: (error) => toast(error instanceof SharingUnavailableError ? s.export.unavailable : s.export.failed),
    });

  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    // With the app lock on, the person proves it is them before anything is scheduled; a failed check changes nothing.
    if (appLock.get().enabled && !(await authenticate(s.deletion.authPrompt))) {
      inFlight.current = false;
      setConfirming(false);
      toast(s.deletion.authFailed);
      return;
    }
    schedule.mutate(undefined, {
      onSettled: () => {
        inFlight.current = false;
        setConfirming(false);
      },
      // A 409 is not a failure: the account is read again and shows the date that already stands.
      onError: (error) => {
        if (!isApiError(error, 'deletion-already-scheduled')) toast(s.deletion.scheduleFailed);
      },
    });
  };

  return (
    <Screen scroll header={<AppBar onBack={back} title={s.deletion.title} />}>
      <DeletionBanner />
      {scheduledFor === null ? <Text color="ink-muted">{s.deletion.intro}</Text> : null}
      <Card style={{ gap: tokens.space['space-2'] }}>
        <Text variant="title" accessibilityRole="header">
          {s.deletion.deletedTitle}
        </Text>
        <Text color="ink-muted">{s.deletion.deletedBody}</Text>
      </Card>
      <Card style={{ gap: tokens.space['space-2'] }}>
        <Text variant="title" accessibilityRole="header">
          {s.deletion.staysTitle}
        </Text>
        <Text color="ink-muted">{s.deletion.staysBody}</Text>
        <Text color="ink-muted">{s.deletion.keptAnonymous}</Text>
      </Card>
      <Button kind="secondary" icon="share" title={s.deletion.download} loading={exportData.isPending} onPress={download} />
      {scheduledFor === null ? (
        <>
          <UnderstandCheckbox checked={understood} label={s.deletion.understand} onChange={setUnderstood} />
          <Button kind="danger" title={s.deletion.action} disabled={!understood} onPress={() => setConfirming(true)} />
        </>
      ) : null}
      <ConfirmSheet
        visible={confirming}
        danger
        title={s.deletion.sheetTitle}
        body={s.deletion.sheetBody}
        confirmLabel={s.deletion.sheetConfirm}
        dismissLabel={s.deletion.sheetDismiss}
        onConfirm={() => void confirm()}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}
