import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, Icon, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { lookHintStore } from '../../model/lookHintStore';

/** Offered on a car that has no look yet. Dismissing it is remembered per car on this phone. */
export function MakeItYoursRow({ vin }: { vin: string }) {
  const router = useRouter();
  // Hidden until the stored answer is known, so a dismissed row never flashes.
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    let live = true;
    void lookHintStore.isDismissed(vin).then((value) => live && setDismissed(value));
    return () => {
      live = false;
    };
  }, [vin]);
  if (dismissed) return null;
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', padding: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${en.look.hintTitle}. ${en.look.hintBody}`}
        onPress={() => router.push(`/vehicles/${vin}/look`)}
        style={{ flex: 1, minHeight: 48, padding: tokens.space['space-4'], flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-3'] }}
      >
        <Icon name="paint" />
        <View style={{ flex: 1 }}>
          <Text variant="label">{en.look.hintTitle}</Text>
          <Text variant="caption" color="ink-muted">
            {en.look.hintBody}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={en.look.hintDismiss}
        onPress={() => {
          setDismissed(true);
          void lookHintStore.dismiss(vin);
        }}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="close" />
      </Pressable>
    </Card>
  );
}
