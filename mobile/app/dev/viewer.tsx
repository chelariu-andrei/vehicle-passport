import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { CarViewer, VIEWER_COLOURS } from '@/shared/viewer';

/** Dev screen for the owner's phone check (plan Task 4 gate). */
export default function ViewerDevScreen() {
  const focused = useIsFocused();
  const [color, setColor] = useState<string>(VIEWER_COLOURS[0].hex);
  const [fps, setFps] = useState<number | null>(null);

  return (
    <Screen scroll>
      <Text variant="title">{en.viewer.devTitle}</Text>
      <View style={{ height: 440 }}>
        <CarViewer color={color} active={focused} onFps={setFps} />
      </View>
      <Text>{en.viewer.fps(fps)}</Text>
      {VIEWER_COLOURS.map((option) => (
        <Button
          key={option.hex}
          kind="secondary"
          title={en.viewer.colourButton(option.name)}
          onPress={() => setColor(option.hex)}
        />
      ))}
    </Screen>
  );
}
