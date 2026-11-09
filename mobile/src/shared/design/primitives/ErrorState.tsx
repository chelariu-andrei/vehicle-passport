import { View } from 'react-native';

import { en } from '../../i18n/en';
import { tokens } from '../tokens.generated';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = { title?: string; body?: string; onRetry?: () => void };

export function ErrorState({ title = en.common.errorTitle, body = en.common.errorBody, onRetry }: Props) {
  return (
    <View
      accessibilityRole="alert"
      style={{ alignItems: 'center', gap: tokens.space['space-3'], paddingTop: tokens.space['space-12'] }}
    >
      <Icon name="alert" size={48} color="danger" />
      <Text variant="title-lg" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text variant="body-lg" color="ink-muted" style={{ textAlign: 'center' }}>
        {body}
      </Text>
      {onRetry ? <Button kind="secondary" title={en.common.retry} onPress={onRetry} /> : null}
    </View>
  );
}
