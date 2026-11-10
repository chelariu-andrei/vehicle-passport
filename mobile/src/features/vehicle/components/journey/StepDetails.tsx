import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';

import { Field, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { FuelPicker } from '../FuelPicker';
import type { JourneyFormInput } from './form';

type Props = {
  control: Control<JourneyFormInput>;
  errors: FieldErrors<JourneyFormInput>;
  /** The make was suggested from the VIN. */
  suggested: boolean;
  onEdit: () => void;
};

/** Step 2: make (suggested), model, year, engine and fuel. */
export function StepDetails({ control, errors, suggested, onEdit }: Props) {
  const maxYear = new Date().getFullYear() + 1;
  const required = (name: 'make' | 'model' | 'fuel') => (errors[name] ? en.vehicleForm.required : undefined);
  return (
    <>
      <Text variant="display-xl" accessibilityRole="header">
        {en.journey.detailsTitle}
      </Text>
      <Controller
        control={control}
        name="make"
        render={({ field }) => (
          <Field
            label={en.vehicleForm.make}
            value={field.value}
            onChangeText={(text) => {
              onEdit();
              field.onChange(text);
            }}
            onBlur={field.onBlur}
            maxLength={100}
            helper={suggested ? en.journey.makeHelper : undefined}
            error={required('make')}
          />
        )}
      />
      <Controller
        control={control}
        name="model"
        render={({ field }) => (
          <Field
            label={en.vehicleForm.model}
            value={field.value}
            onChangeText={(text) => {
              onEdit();
              field.onChange(text);
            }}
            onBlur={field.onBlur}
            maxLength={100}
            error={required('model')}
          />
        )}
      />
      <Controller
        control={control}
        name="year"
        render={({ field }) => (
          <Field
            label={en.vehicleForm.year}
            value={String(field.value ?? '')}
            onChangeText={(text) => {
              onEdit();
              field.onChange(text);
            }}
            onBlur={field.onBlur}
            keyboardType="number-pad"
            maxLength={4}
            error={errors.year ? en.vehicleForm.invalidYear(maxYear) : undefined}
          />
        )}
      />
      <Controller
        control={control}
        name="engine"
        render={({ field }) => (
          <Field
            label={en.vehicleForm.engine}
            value={field.value ?? ''}
            onChangeText={(text) => {
              onEdit();
              field.onChange(text);
            }}
            onBlur={field.onBlur}
            maxLength={100}
          />
        )}
      />
      <Controller
        control={control}
        name="fuel"
        render={({ field }) => (
          <FuelPicker
            value={field.value ?? null}
            onChange={(fuel) => {
              onEdit();
              field.onChange(fuel);
            }}
            error={required('fuel')}
          />
        )}
      />
    </>
  );
}
