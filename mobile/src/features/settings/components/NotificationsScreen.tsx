import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Switch, Text, tokens, useTheme } from '@/shared/design';
import { useStrings } from '@/shared/i18n';

import { useUpdateSettings, type Settings } from '../api/useSettings';
import { SettingsPage } from './SettingsPage';

type Notifications = Settings['notifications'];
const DAYS = [30, 7, 1] as const;

function Chip({ label, on, disabled, onPress }: { label: string; on: boolean; disabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 48,
        minWidth: 48,
        paddingHorizontal: tokens.space['space-4'],
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: tokens.radius['radius-pill'],
        borderWidth: on ? 2 : 1,
        borderColor: on ? colors.brand : colors['line-strong'],
        backgroundColor: on ? colors['surface-raised'] : 'transparent',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text>{label}</Text>
    </Pressable>
  );
}

function Heading({ text }: { text: string }) {
  return (
    <Text variant="label" color="ink-muted" accessibilityRole="header">
      {text}
    </Text>
  );
}

function Form({ settings, permissionNote }: { settings: Settings; permissionNote?: ReactNode }) {
  const s = useStrings().settings.notifications;
  const { change } = useUpdateSettings();
  const n = settings.notifications;
  const set = (patch: Partial<Notifications>) =>
    change((current) => ({ ...current, notifications: { ...current.notifications, ...patch } }));
  const toggleDay = (day: (typeof DAYS)[number]) =>
    change((current) => {
      const days = current.notifications.reminderDays;
      const next = DAYS.filter((d) => (d === day ? !days.includes(d) : days.includes(d)));
      return { ...current, notifications: { ...current.notifications, reminderDays: [...next] } };
    });
  return (
    <View style={{ gap: tokens.space['space-5'] }}>
      <View style={{ gap: tokens.space['space-2'] }}>
        <Heading text={s.deadlinesGroup} />
        <Switch label={s.documentDeadlines} value={n.documentDeadlines} onValueChange={(value) => set({ documentDeadlines: value })} />
        <Text variant="caption" color="ink-muted">
          {s.reminderLabel}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
          {DAYS.map((day) => (
            <Chip
              key={day}
              label={s.reminder[day]}
              on={n.reminderDays.includes(day)}
              disabled={!n.documentDeadlines}
              onPress={() => toggleDay(day)}
            />
          ))}
        </View>
        <Switch label={s.tireSeason} value={n.tireSeason} onValueChange={(value) => set({ tireSeason: value })} />
        <Text variant="caption" color="ink-muted">
          {s.tireSeasonCaption}
        </Text>
        {permissionNote}
      </View>
      <View style={{ gap: tokens.space['space-2'] }}>
        <Heading text={s.activityGroup} />
        <Switch label={s.activityScans} value={n.activityScans} onValueChange={(value) => set({ activityScans: value })} />
        <Switch
          label={s.activityPassportViews}
          value={n.activityPassportViews}
          onValueChange={(value) => set({ activityPassportViews: value })}
        />
        <Switch label={s.activityTransfers} value={n.activityTransfers} onValueChange={(value) => set({ activityTransfers: value })} />
      </View>
      <View style={{ gap: tokens.space['space-2'] }}>
        <Heading text={s.newsGroup} />
        <Switch label={s.productNews} value={n.productNews} onValueChange={(value) => set({ productNews: value })} />
      </View>
    </View>
  );
}

/** Account > Notifications. Every change is sent at once. */
export function NotificationsScreen({ permissionNote }: { permissionNote?: ReactNode } = {}) {
  const s = useStrings();
  return <SettingsPage title={s.settings.notifications.title}>{(settings) => <Form settings={settings} permissionNote={permissionNote} />}</SettingsPage>;
}
