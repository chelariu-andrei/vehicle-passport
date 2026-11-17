import { fireEvent, render, screen } from '@testing-library/react-native';

import { en } from '@/shared/i18n/en';

import { ReminderPermissionSheet } from './ReminderPermissionSheet';

describe('ReminderPermissionSheet', () => {
  it('explains first and offers Allow reminders and Not now', async () => {
    const onAllow = jest.fn();
    const onNotNow = jest.fn();
    await render(<ReminderPermissionSheet visible onAllow={onAllow} onNotNow={onNotNow} />);
    expect(screen.getByText(en.deadlines.permission.title)).toBeTruthy();
    expect(screen.getByText(en.deadlines.permission.body)).toBeTruthy();
    await fireEvent.press(screen.getByText(en.deadlines.permission.allow));
    await fireEvent.press(screen.getByText(en.deadlines.permission.notNow));
    expect(onAllow).toHaveBeenCalledTimes(1);
    expect(onNotNow).toHaveBeenCalledTimes(1);
  });
});
