import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { ConfirmSheet } from '@/shared/design';
import { en } from '@/shared/i18n/en';

const DISMISS_FALLBACK_MS = 350;

type Props = {
  visible: boolean;
  /** Runs once the sheet has gone: the journey leaves, and leaving while the sheet still dismisses can drop the pop on iOS. */
  onKeep: () => void;
  onDiscard: () => void;
  /** Closes the sheet and stays on the screen. */
  onClose: () => void;
};

/** "Keep this draft?" Tapping outside or the system Back only closes it: nothing is lost by accident. */
export function DraftSheet({ visible, onKeep, onDiscard, onClose }: Props) {
  const pending = useRef<(() => void) | null>(null);
  const runPending = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };
  // Same sequencing as the car menu: iOS reports the end of the dismissal through `onDismiss` and a timer there could
  // act mid-dismissal; elsewhere `onDismiss` never fires, so a short timer stands in. Reopening drops a stale choice.
  useEffect(() => {
    if (visible) {
      pending.current = null;
      return;
    }
    if (Platform.OS === 'ios' || !pending.current) return;
    const timer = setTimeout(runPending, DISMISS_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  const choose = (action: () => void) => {
    pending.current = action;
    onClose();
  };

  return (
    <ConfirmSheet
      visible={visible}
      title={en.journey.draftTitle}
      body={en.journey.draftBody}
      confirmLabel={en.journey.keepDraft}
      dismissLabel={en.common.discard}
      onConfirm={() => choose(onKeep)}
      onCancel={() => choose(onDiscard)}
      onClose={onClose}
      onDismiss={runPending}
    />
  );
}
