import { useRouter } from 'expo-router';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Pressable, View } from 'react-native';

import { errorMessage, isApiError } from '@/shared/api';
import { Button, Field, Icon, Screen, Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useRegisterVehicle } from '../api/useRegisterVehicle';
import { FUEL_TYPES, vehicleFormSchema } from '../model/vehicleForm';
import type { FuelType, VehicleFormValues } from '../model/vehicleForm';

type Errors = Partial<Record<'vin' | 'make' | 'model' | 'engine' | 'year' | 'fuel', string>>;

function FuelPicker({ value, onChange, error }: { value: FuelType | null; onChange(fuel: FuelType): void; error?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: tokens.space['space-1'] }} accessibilityRole="radiogroup" accessibilityLabel={en.vehicleForm.fuel}>
      <Text variant="label">{en.vehicleForm.fuel}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
        {FUEL_TYPES.map((fuel) => {
          const selected = fuel === value;
          return (
            <Pressable
              key={fuel}
              accessibilityRole="radio"
              accessibilityLabel={en.fuel[fuel]}
              accessibilityState={{ selected }}
              onPress={() => onChange(fuel)}
              style={{
                minHeight: 48,
                minWidth: 48,
                paddingHorizontal: tokens.space['space-4'],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: tokens.space['space-1'],
                borderRadius: tokens.radius['radius-pill'],
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? colors.brand : colors['line-strong'],
                backgroundColor: selected ? colors['surface-raised'] : 'transparent',
              }}
            >
              {selected ? <Icon name="check" size={16} color="brand" /> : null}
              <Text variant="label">{en.fuel[fuel]}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

type FormInput = z.input<ReturnType<typeof vehicleFormSchema>>;
type Field_ = keyof Errors;

export function AddVehicleScreen() {
  const router = useRouter();
  const register = useRegisterVehicle();
  const schema = useMemo(() => vehicleFormSchema(new Date()), []);
  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormInput, unknown, VehicleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { vin: '', make: '', model: '', engine: '', year: '', fuel: undefined },
  });
  // Editing any field clears a stale server error.
  const edited = () => register.reset();

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openCar = (carVin: string) => router.replace(`/vehicles/${carVin}`);

  if (register.data?.kind === 'claimFiled') {
    return (
      <Screen scroll>
        <Text variant="display-xl" accessibilityRole="header">
          {en.vehicleForm.filedTitle}
        </Text>
        <Text variant="body-lg">{en.vehicleForm.filedBody}</Text>
        <Button title={en.vehicleForm.done} onPress={close} />
      </Screen>
    );
  }

  const submit = handleSubmit((values) => {
    // Only contract fields go out; `engine` is already absent when left empty.
    register.mutate(values, {
      onSuccess: (result) => {
        if (result.kind === 'created') openCar(result.vehicle.vin);
      },
    });
  });

  const maxYear = new Date().getFullYear() + 1;
  const problem = (field: Field_): string | undefined =>
    errors[field] === undefined
      ? undefined
      : field === 'vin'
        ? en.vehicleForm.invalidVin
        : field === 'year'
          ? en.vehicleForm.invalidYear(maxYear)
          : en.vehicleForm.required;

  const failure = register.isError ? register.error : null;
  const alreadyMine = isApiError(failure, 'already-owner');
  const vinProblem = isApiError(failure, 'invalid-vin') ? errorMessage(failure) : problem('vin');
  const formProblem = failure && !isApiError(failure, 'invalid-vin') ? errorMessage(failure) : null;

  return (
    <Screen scroll>
      <Text variant="display-xl" accessibilityRole="header">
        {en.vehicleForm.title}
      </Text>
      <Controller
        control={control}
        name="vin"
        render={({ field }) => (
          <Field
            label={en.vehicleForm.vin}
            value={field.value}
            onChangeText={(text) => {
              edited();
              field.onChange(text.toUpperCase());
            }}
            onBlur={field.onBlur}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={17}
            helper={en.vehicleForm.vinHelper}
            error={vinProblem}
          />
        )}
      />
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
      {formProblem ? (
        <Text color="danger" accessibilityRole="alert">
          {formProblem}
        </Text>
      ) : null}
      {alreadyMine ? <Button kind="secondary" title={en.vehicleForm.viewCar} onPress={() => openCar(getValues('vin'))} /> : null}
      <Button title={en.vehicleForm.submit} loading={register.isPending} onPress={submit} />
      <Button kind="secondary" title={en.common.cancel} onPress={close} />
    </Screen>
  );
}
