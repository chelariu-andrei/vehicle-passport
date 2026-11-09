import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { errorMessage, isApiError } from '@/shared/api';
import { Button, Field, Icon, Screen, Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useRegisterVehicle } from '../api/useRegisterVehicle';
import { FUEL_TYPES, vehicleFormSchema } from '../model/vehicleForm';
import type { FuelType } from '../model/vehicleForm';

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

export function AddVehicleScreen() {
  const router = useRouter();
  const register = useRegisterVehicle();
  const [vin, setVin] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [engine, setEngine] = useState('');
  const [year, setYear] = useState('');
  const [fuel, setFuel] = useState<FuelType | null>(null);
  const [errors, setErrors] = useState<Errors>({});

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

  const submit = () => {
    const maxYear = new Date().getFullYear() + 1;
    const parsed = vehicleFormSchema(new Date()).safeParse({ vin, make, model, engine, year, fuel });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof Errors;
        next[field] ??=
          field === 'vin' ? en.vehicleForm.invalidVin : field === 'year' ? en.vehicleForm.invalidYear(maxYear) : en.vehicleForm.required;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    // Only contract fields go out; `engine` is already absent when left empty.
    register.mutate(parsed.data, {
      onSuccess: (result) => {
        if (result.kind === 'created') openCar(result.vehicle.vin);
      },
    });
  };

  const failure = register.isError ? register.error : null;
  const alreadyMine = isApiError(failure, 'already-owner');
  const vinProblem = isApiError(failure, 'invalid-vin') ? errorMessage(failure) : errors.vin;
  const formProblem = failure && !isApiError(failure, 'invalid-vin') ? errorMessage(failure) : null;

  return (
    <Screen scroll>
      <Text variant="display-xl" accessibilityRole="header">
        {en.vehicleForm.title}
      </Text>
      <Field
        label={en.vehicleForm.vin}
        value={vin}
        onChangeText={(text) => setVin(text.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={17}
        helper={en.vehicleForm.vinHelper}
        error={vinProblem}
      />
      <Field label={en.vehicleForm.make} value={make} onChangeText={setMake} maxLength={100} error={errors.make} />
      <Field label={en.vehicleForm.model} value={model} onChangeText={setModel} maxLength={100} error={errors.model} />
      <Field label={en.vehicleForm.engine} value={engine} onChangeText={setEngine} maxLength={100} />
      <Field
        label={en.vehicleForm.year}
        value={year}
        onChangeText={setYear}
        keyboardType="number-pad"
        maxLength={4}
        error={errors.year}
      />
      <FuelPicker value={fuel} onChange={setFuel} error={errors.fuel} />
      {formProblem ? (
        <Text color="danger" accessibilityRole="alert">
          {formProblem}
        </Text>
      ) : null}
      {alreadyMine ? <Button kind="secondary" title={en.vehicleForm.viewCar} onPress={() => openCar(vin)} /> : null}
      <Button title={en.vehicleForm.submit} loading={register.isPending} onPress={submit} />
      <Button kind="secondary" title={en.common.cancel} onPress={close} />
    </Screen>
  );
}
