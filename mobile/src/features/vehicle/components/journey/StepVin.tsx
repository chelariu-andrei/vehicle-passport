import { Controller } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { View } from 'react-native';

import { Field, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { cleanVin, makeFromVin } from '../../model/vin';
import type { JourneyFormInput } from './form';
import { WhereToFindVin } from './WhereToFindVin';

type Props = { control: Control<JourneyFormInput>; error?: string; onEdit: () => void };

/** Step 1: the VIN, cleaned as it is typed, with a count and the make it points to. */
export function StepVin({ control, error, onEdit }: Props) {
  return (
    <>
      <Text variant="display-xl" accessibilityRole="header">
        {en.journey.vinTitle}
      </Text>
      <Text variant="body-lg" color="ink-muted">
        {en.journey.vinBody}
      </Text>
      <Controller
        control={control}
        name="vin"
        render={({ field }) => {
          const make = makeFromVin(field.value);
          return (
            <View style={{ gap: tokens.space['space-2'] }}>
              <Field
                label={en.vehicleForm.vin}
                value={field.value}
                // Pasted text arrives whole, so it is cleaned here rather than cut by a length limit.
                onChangeText={(text) => {
                  onEdit();
                  field.onChange(cleanVin(text));
                }}
                onBlur={field.onBlur}
                autoCapitalize="characters"
                autoCorrect={false}
                mono
                error={error}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: tokens.space['space-3'] }}>
                <Text variant="caption" color="brand" style={{ flexShrink: 1 }}>
                  {make ? en.journey.looksLike(make) : ''}
                </Text>
                <Text variant="vin-sm" color="ink-muted">
                  {en.journey.count(field.value.length)}
                </Text>
              </View>
            </View>
          );
        }}
      />
      <WhereToFindVin />
    </>
  );
}
