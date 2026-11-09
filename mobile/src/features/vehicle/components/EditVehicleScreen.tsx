import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { errorMessage } from '@/shared/api';
import { Button, ErrorState, Field, Screen, Skeleton, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useUpdateVehicle } from '../api/useUpdateVehicle';
import { useVehicle } from '../api/useVehicles';
import type { VehicleResponse } from '../api/useVehicles';
import { changedFields } from '../model/changedFields';
import { vehicleFormSchema } from '../model/vehicleForm';
import type { VehicleFormValues } from '../model/vehicleForm';
import { FuelPicker } from './FuelPicker';

type FormInput = z.input<ReturnType<typeof vehicleFormSchema>>;
type FieldName = 'make' | 'model' | 'year' | 'fuel';

function EditForm({ vehicle }: { vehicle: VehicleResponse }) {
  const router = useRouter();
  const update = useUpdateVehicle(vehicle.vin);
  const schema = useMemo(() => vehicleFormSchema(new Date()), []);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, VehicleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vin: vehicle.vin,
      make: vehicle.make,
      model: vehicle.model,
      engine: vehicle.engine ?? '',
      year: String(vehicle.year),
      fuel: vehicle.fuel,
    },
  });
  // Editing clears a settled server error. A request in flight must never be reset: that would detach its callbacks.
  const edited = () => {
    if (update.isError) update.reset();
  };

  // Save needs something to send. A form that does not parse yet is not "unchanged": pressing Save explains why.
  const parsed = schema.safeParse(useWatch({ control }));
  const unchanged = parsed.success && Object.keys(changedFields(vehicle, parsed.data)).length === 0;

  const close = () => (router.canGoBack() ? router.back() : router.replace(`/vehicles/${vehicle.vin}`));
  const submit = handleSubmit((values) => {
    const changes = changedFields(vehicle, values);
    if (Object.keys(changes).length === 0) return;
    update.mutate(changes, { onSuccess: close });
  });

  const maxYear = new Date().getFullYear() + 1;
  const problem = (field: FieldName): string | undefined =>
    errors[field] === undefined ? undefined : field === 'year' ? en.vehicleForm.invalidYear(maxYear) : en.vehicleForm.required;

  return (
    <Screen scroll>
      <Text variant="display-xl" accessibilityRole="header">
        {en.vehicle.editTitle}
      </Text>
      <ReadOnlyVin vin={vehicle.vin} />
      <Controller
        control={control}
        name="make"
        render={({ field }) => (
          <Field
            label={en.vehicleForm.make}
            value={field.value}
            onChangeText={(text) => {
              edited();
              field.onChange(text);
            }}
            onBlur={field.onBlur}
            maxLength={100}
            error={problem('make')}
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
              edited();
              field.onChange(text);
            }}
            onBlur={field.onBlur}
            maxLength={100}
            error={problem('model')}
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
              edited();
              field.onChange(text);
            }}
            onBlur={field.onBlur}
            maxLength={100}
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
              edited();
              field.onChange(text);
            }}
            onBlur={field.onBlur}
            keyboardType="number-pad"
            maxLength={4}
            error={problem('year')}
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
              edited();
              field.onChange(fuel);
            }}
            error={problem('fuel')}
          />
        )}
      />
      {update.isError ? (
        <Text color="danger" accessibilityRole="alert">
          {errorMessage(update.error)}
        </Text>
      ) : null}
      <Button title={en.vehicle.save} disabled={unchanged} loading={update.isPending} onPress={submit} />
      <Button kind="secondary" title={en.common.cancel} onPress={close} />
    </Screen>
  );
}

/** The VIN identifies the car and cannot be edited: it is shown as text, not as a field. */
function ReadOnlyVin({ vin }: { vin: string }) {
  return (
    <>
      <Text variant="vin">{vin}</Text>
      <Text variant="caption" color="ink-muted">
        {en.vehicle.vinReadOnly}
      </Text>
    </>
  );
}

export function EditVehicleScreen({ vin }: { vin: string }) {
  const vehicle = useVehicle(vin);
  if (vehicle.data) return <EditForm vehicle={vehicle.data} />;
  return (
    <Screen>
      {vehicle.isError ? (
        <ErrorState onRetry={() => void vehicle.refetch()} />
      ) : (
        <Skeleton height={48} />
      )}
    </Screen>
  );
}
