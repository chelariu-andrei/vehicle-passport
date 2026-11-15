import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { BODY_TYPES, CarViewer, NEUTRAL_LOOK } from '@/shared/viewer';
import type { Look } from '@/shared/viewer';

const FINISHES: readonly Look['finish'][] = ['GLOSS', 'METALLIC', 'SATIN', 'MATTE'];

/** Dev screen for the device gate: cycles the seven body types and the four finishes and reports the frame rate. */
export default function ViewerDevScreen() {
  const focused = useIsFocused();
  const [look, setLook] = useState<Look>({ ...NEUTRAL_LOOK, bodyType: BODY_TYPES[0] });
  const [fps, setFps] = useState<number | null>(null);

  const next = <T,>(list: readonly T[], current: T | null) => list[(list.indexOf(current as T) + 1) % list.length];

  return (
    <Screen scroll>
      <Text variant="title">{en.viewer.devTitle}</Text>
      <View style={{ height: 440 }}>
        <CarViewer look={look} active={focused} onFps={setFps} />
      </View>
      <Text>{en.viewer.fps(fps)}</Text>
      <Text>{en.viewer.current(look.bodyType ? en.look.body[look.bodyType] : '', en.look.finish[look.finish])}</Text>
      <Button kind="secondary" title={en.viewer.nextBody} onPress={() => setLook({ ...look, bodyType: next(BODY_TYPES, look.bodyType) })} />
      <Button kind="secondary" title={en.viewer.nextFinish} onPress={() => setLook({ ...look, finish: next(FINISHES, look.finish) })} />
    </Screen>
  );
}
