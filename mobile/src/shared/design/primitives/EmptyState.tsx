import { View } from 'react-native';

import { tokens } from '../tokens.generated';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  icon?: IconName;
  title: string;
  body?: string;
  action?: { title: string; onPress: () => void };
};

export function EmptyState({ icon = 'car', title, body, action }: Props) {
  return (
    <View style={{ alignItems: 'center', gap: tokens.space['space-3'], paddingTop: tokens.space['space-12'] }}>
      <Icon name={icon} size={48} color="ink-muted" />
      <Text variant="title-lg" style={{ textAlign: 'center' }} accessibilityRole="header">
        {title}
      </Text>
      {body ? (
        <Text variant="body-lg" color="ink-muted" style={{ textAlign: 'center' }}>
          {body}
        </Text>
      ) : null}
      {action ? <Button title={action.title} onPress={action.onPress} /> : null}
    </View>
  );
}
