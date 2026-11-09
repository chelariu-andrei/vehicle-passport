import { View } from 'react-native';

import { Button, Card, Icon, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

/** Tells the owner that someone has asked for the car. It says how many, never who. */
export function ClaimsBanner({ count, onReview }: { count: number; onReview: () => void }) {
  return (
    <Card style={{ gap: tokens.space['space-3'] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-3'] }}>
        <Icon name="alert" color="warning" />
        <Text variant="title" style={{ flex: 1 }}>
          {en.vehicle.claimsBanner(count)}
        </Text>
      </View>
      <Button kind="secondary" title={en.vehicle.reviewClaims} onPress={onReview} />
    </Card>
  );
}
