import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { PALETTE, CarViewer, NEUTRAL_LOOK } from '@/shared/viewer';

/** Dev screen for the owner's phone check (plan Task 4 gate). */
export default function ViewerDevScreen() {
  const focused = useIsFocused();
  const [look, setLook] = useState(NEUTRAL_LOOK);
  const [fps, setFps] = useState<number | null>(null);

  return (
    <Screen scroll>
      <Text variant="title">{en.viewer.devTitle}</Text>
      <View style={{ height: 440 }}>
        <CarViewer look={look} active={focused} onFps={setFps} />
      </View>
      <Text>{en.viewer.fps(fps)}</Text>
      {PALETTE.slice(0, 4).map((option) => (
        <Button
          key={option.code}
          kind="secondary"
          title={en.viewer.colourButton(option.name)}
          onPress={() => setLook({ ...NEUTRAL_LOOK, color: option.code })}
        />
      ))}
    </Screen>
  );
}
