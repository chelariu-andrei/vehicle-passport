import { ConfirmSheet } from '@/shared/design';
import { en } from '@/shared/i18n/en';

type Props = { visible: boolean; onAllow(): void; onNotNow(): void };

/** The short explanation shown before the system prompt, so the phone never asks cold. */
export function ReminderPermissionSheet({ visible, onAllow, onNotNow }: Props) {
  const s = en.deadlines.permission;
  return (
    <ConfirmSheet
      visible={visible}
      title={s.title}
      body={s.body}
      confirmLabel={s.allow}
      dismissLabel={s.notNow}
      onConfirm={onAllow}
      onCancel={onNotNow}
    />
  );
}
