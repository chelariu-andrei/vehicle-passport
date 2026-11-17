import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { en } from '@/shared/i18n/en';

import type { PlannedReminder } from '../model/reminderPlan';

/** The slice of `expo-notifications` the scheduler uses, so tests can pass their own. */
export type NotificationsModule = Pick<
  typeof Notifications,
  'cancelAllScheduledNotificationsAsync' | 'scheduleNotificationAsync' | 'setNotificationChannelAsync'
>;

export const CHANNEL_ID = 'deadlines';

async function ensureChannel(mod: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await mod.setNotificationChannelAsync(CHANNEL_ID, {
    name: en.deadlines.title,
    // The package re-exports this enum through `export *`, which the namespace rule cannot follow.
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Makes the phone's scheduled notifications exactly `plan`: cancels all, then schedules each reminder. The app has no other
 * scheduled notifications, so cancelling all is what lets a renewed or deleted document drop its reminder. One reminder that
 * cannot be scheduled never stops the rest.
 */
export async function applyPlan(plan: PlannedReminder[], mod: NotificationsModule = Notifications): Promise<void> {
  await mod.cancelAllScheduledNotificationsAsync();
  if (plan.length === 0) return;
  await ensureChannel(mod);
  for (const r of plan) {
    try {
      await mod.scheduleNotificationAsync({
        content: { title: r.title, body: r.body, data: r.data },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt, channelId: CHANNEL_ID },
      });
    } catch (error) {
      console.warn('Could not schedule a reminder', error);
    }
  }
}

export async function cancelAll(mod: NotificationsModule = Notifications): Promise<void> {
  await mod.cancelAllScheduledNotificationsAsync();
}
