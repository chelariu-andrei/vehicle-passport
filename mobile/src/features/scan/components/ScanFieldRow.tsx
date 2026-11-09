import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { Field, Icon, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

type Props = ComponentProps<typeof Field> & {
  /** Low confidence, or a value that could not be read. Said in words and with a glyph, never by colour alone. */
  flagged?: boolean;
  /** A warning the scan raised about this field. */
  warning?: string;
};

/** One reviewable field: the input, a "Check" mark when the reading is doubtful, and the scan's warning for it. */
export function ScanFieldRow({ flagged = false, warning, ...field }: Props) {
  return (
    <View style={{ gap: tokens.space['space-1'] }}>
      <Field {...field} />
      {flagged ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-1'] }}>
          <Icon name="alert" size={16} color="warning" />
          <Text variant="caption" color="warning">
            {en.scans.review.check}
          </Text>
        </View>
      ) : null}
      {warning ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-1'] }}>
          <Icon name="alert" size={16} color="warning" />
          <Text variant="caption" color="warning" style={{ flex: 1 }}>
            {warning}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
