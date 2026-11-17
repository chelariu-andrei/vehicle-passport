import { useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';

import { Button, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { readPermission, reminderPrompt, requestPermission, type PermissionState } from '../notifications/permission';

/** On the notification settings: when the phone has notifications off for the app, say reminders cannot reach the owner and offer the phone's settings. Re-read when the app comes back from them. */
export function ReminderPermissionNote() {
  const [state, setState] = useState<PermissionState>('undetermined');
  const [explained, setExplained] = useState(false);
  useEffect(() => {
    let alive = true;
    const read = () => void readPermission().then((s) => alive && setState(s));
    read();
    void reminderPrompt.wasExplained().then((value) => alive && setExplained(value));
    const sub = AppState.addEventListener('change', (next) => next === 'active' && read());
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  const s = en.deadlines.permission;
  // "Not now" leaves the system permission undecided and the phone has no settings entry yet: offer the prompt again here.
  if (state === 'undetermined' && explained) {
    const allow = async () => setState(await requestPermission());
    return (
      <View style={{ gap: tokens.space['space-2'] }}>
        <Text variant="caption" color="ink-muted">
          {s.laterNote}
        </Text>
        <Button kind="secondary" title={s.allow} onPress={() => void allow()} />
      </View>
    );
  }
  if (state !== 'denied') return null;
  return (
    <View style={{ gap: tokens.space['space-2'] }}>
      <Text variant="caption" color="ink-muted">
        {s.deniedNote}
      </Text>
      <Button kind="secondary" title={s.openSettings} onPress={() => void Linking.openSettings()} />
    </View>
  );
}
