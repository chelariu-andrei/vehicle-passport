import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { ActionBar, AppBar, Screen, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { NEUTRAL_LOOK } from '@/shared/viewer';
import type { Look } from '@/shared/viewer';

import { useSaveLook } from '../../api/useSaveLook';
import { LookEditor } from '../look/LookEditor';
import { StepProgress } from './StepProgress';

/** Step 3. The car is already registered; saving is optional and a failure never blocks leaving. */
export function JourneyLook({ vin, onDone }: { vin: string; onDone: (look: Look) => void }) {
  const [look, setLook] = useState<Look>(NEUTRAL_LOOK);
  const save = useSaveLook(vin);
  return (
    <Screen
      scroll
      header={
        <>
          <AppBar />
          <StepProgress step={3} />
        </>
      }
      footer={
        <ActionBar
          primary={{ title: en.look.save, loading: save.isPending, onPress: () => save.mutate(look, { onSuccess: () => onDone(look) }) }}
          quiet={{ title: en.look.skip, onPress: () => onDone(NEUTRAL_LOOK) }}
        />
      }
    >
      <Text variant="title" accessibilityRole="header">
        {en.look.title}
      </Text>
      <LookEditor look={look} onChange={setLook} active />
      {save.isError ? (
        <Text color="danger" accessibilityRole="alert">
          {errorMessage(save.error)}
        </Text>
      ) : null}
    </Screen>
  );
}
