import { Modal, Pressable, View } from 'react-native';

import { en } from '../../i18n/en';
import { useTheme } from '../theme';
import { tokens } from '../tokens.generated';
import { Button } from './Button';
import { Text } from './Text';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  /** What declining reads as, in the caller's words (never a generic label). */
  dismissLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmSheet({ visible, title, body, confirmLabel, dismissLabel, danger = false, onConfirm, onCancel }: Props) {
  const { colors, scheme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim }}>
        <Pressable accessibilityLabel={en.common.dismiss} style={{ flex: 1 }} onPress={onCancel} />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: tokens.radius['radius-lg'],
            borderTopRightRadius: tokens.radius['radius-lg'],
            padding: tokens.space['space-5'],
            gap: tokens.space['space-4'],
            boxShadow: tokens.shadow[scheme]['shadow-card'],
          }}
        >
          <Text variant="title-lg" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="body-lg" color="ink-muted">
            {body}
          </Text>
          <Button kind={danger ? 'danger' : 'primary'} title={confirmLabel} onPress={onConfirm} />
          <Button kind="quiet" title={dismissLabel} onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}
