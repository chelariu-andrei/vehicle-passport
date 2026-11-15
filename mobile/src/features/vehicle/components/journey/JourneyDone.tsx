import { useRouter } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';

import { ActionBar, AppBar, Screen, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { goToGarage } from '@/shared/navigation/goToGarage';
import { CarViewer } from '@/shared/viewer';
import type { Look } from '@/shared/viewer';

const STAGE_SHARE = 0.3;

/** The last screen: the car is in the garage; the first service is one tap away. */
export function JourneyDone({ vin, name, look }: { vin: string; name: string; look: Look }) {
  const router = useRouter();
  const { height } = useWindowDimensions();
  return (
    <Screen
      scroll
      header={<AppBar />}
      footer={
        <ActionBar
          primary={{ title: en.look.firstService, onPress: () => router.replace(`/scans/new?vin=${vin}`) }}
          quiet={{ title: en.journey.later, onPress: goToGarage }}
        />
      }
    >
      <View style={{ height: height * STAGE_SHARE, borderRadius: tokens.radius['radius-lg'], overflow: 'hidden' }}>
        <CarViewer look={look} view="front" active />
      </View>
      <Text variant="title" accessibilityRole="header">
        {en.look.doneTitle(name)}
      </Text>
      <Text color="ink-muted">{en.look.doneBody}</Text>
    </Screen>
  );
}
