import { Platform } from 'react-native';

import type { PlannedReminder } from '../model/reminderPlan';
import { applyPlan, cancelAll, type NotificationsModule } from './scheduler';

const reminder = (day: number, over: Partial<PlannedReminder> = {}): PlannedReminder => ({
  fireAt: new Date(2027, 0, day, 9, 0, 0),
  title: `Title ${day}`,
  body: `Body ${day}`,
  data: { vin: 'V1', kind: 'RCA' },
  ...over,
});

function fakeModule() {
  const calls: string[] = [];
  const mod = {
    cancelAllScheduledNotificationsAsync: jest.fn(async () => void calls.push('cancel')),
    scheduleNotificationAsync: jest.fn(async () => (calls.push('schedule'), 'id')),
    setNotificationChannelAsync: jest.fn(async () => null),
  } satisfies NotificationsModule;
  return { mod, calls };
}

afterEach(() => {
  Platform.OS = 'ios';
});

describe('applyPlan', () => {
  it('cancels everything first, then schedules each reminder with its date, content and data', async () => {
    const { mod, calls } = fakeModule();
    await applyPlan([reminder(5), reminder(6)], mod);
    expect(calls).toEqual(['cancel', 'schedule', 'schedule']);
    expect(mod.scheduleNotificationAsync).toHaveBeenNthCalledWith(1, {
      content: { title: 'Title 5', body: 'Body 5', data: { vin: 'V1', kind: 'RCA' } },
      trigger: { type: 'date', date: new Date(2027, 0, 5, 9, 0, 0), channelId: 'deadlines' },
    });
  });

  it('only cancels when the plan is empty', async () => {
    const { mod, calls } = fakeModule();
    await applyPlan([], mod);
    expect(calls).toEqual(['cancel']);
  });

  it('keeps going when one reminder cannot be scheduled', async () => {
    const { mod } = fakeModule();
    mod.scheduleNotificationAsync.mockRejectedValueOnce(new Error('nope'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await applyPlan([reminder(5), reminder(6)], mod);
    expect(mod.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('creates the deadlines channel on Android before scheduling', async () => {
    Platform.OS = 'android';
    const { mod } = fakeModule();
    await applyPlan([reminder(5)], mod);
    expect(mod.setNotificationChannelAsync).toHaveBeenCalledWith('deadlines', expect.objectContaining({ name: expect.any(String) }));
  });

  it('does not touch channels on iOS', async () => {
    const { mod } = fakeModule();
    await applyPlan([reminder(5)], mod);
    expect(mod.setNotificationChannelAsync).not.toHaveBeenCalled();
  });
});

describe('cancelAll', () => {
  it('cancels every scheduled notification', async () => {
    const { mod } = fakeModule();
    await cancelAll(mod);
    expect(mod.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mod.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
