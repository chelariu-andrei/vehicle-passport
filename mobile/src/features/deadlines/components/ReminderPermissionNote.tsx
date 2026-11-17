import { useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';

import { Button, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { readPermission, type PermissionState } from '../notifications/permission';

/** On the notification settings: when the phone has notifications off for the app, say reminders cannot reach the owner and offer the phone's settings. Re-read when the app comes back from them. */
export function ReminderPermissionNote() {
  const [state, setState] = useState<PermissionState>('undetermined');
  useEffect(() => {
    let alive = true;
    const read = () => void readPermission().then((s) => alive && setState(s));
    read();
    const sub = AppState.addEventListener('change', (next) => next === 'active' && read());
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  if (state !== 'denied') return null;
  const s = en.deadlines.permission;
  return (
    <View style={{ gap: tokens.space['space-2'] }}>
      <Text variant="caption" color="ink-muted">
        {s.deniedNote}
      </Text>
      <Button kind="secondary" title={s.openSettings} onPress={() => void Linking.openSettings()} />
    </View>
  );
}
