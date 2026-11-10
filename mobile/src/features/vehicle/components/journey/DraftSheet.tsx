import { ConfirmSheet } from '@/shared/design';
import { en } from '@/shared/i18n/en';

type Props = { visible: boolean; onKeep: () => void; onDiscard: () => void; onClose: () => void };

/** "Keep this draft?" Tapping outside or the system Back only closes it: nothing is lost by accident. */
export function DraftSheet({ visible, onKeep, onDiscard, onClose }: Props) {
  return (
    <ConfirmSheet
      visible={visible}
      title={en.journey.draftTitle}
      body={en.journey.draftBody}
      confirmLabel={en.journey.keepDraft}
      dismissLabel={en.common.discard}
      onConfirm={onKeep}
      onCancel={onDiscard}
      onClose={onClose}
    />
  );
}
