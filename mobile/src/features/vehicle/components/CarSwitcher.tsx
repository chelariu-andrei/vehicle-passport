import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Skeleton, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useActiveCar } from '../api/useActiveCar';
import { CarListSheet, plateOrVin } from './CarListSheet';

/**
 * The title of the Car, Scans and Passports tabs: the active car's name with its plate (or VIN) under it. With two or
 * more cars it is a button that opens the car list; with one it is plain text; with none it reads `fallbackTitle`.
 */
export function CarSwitcher({ fallbackTitle }: { fallbackTitle: string }) {
  const { status, car, cars } = useActiveCar();
  const [open, setOpen] = useState(false);

  if (status === 'loading') {
    return (
      <View accessible accessibilityLabel={en.common.loading} style={{ gap: tokens.space['space-2'] }}>
        <Skeleton width={180} height={24} />
        <Skeleton width={120} height={14} />
      </View>
    );
  }
  if (!car) {
    return (
      <Text variant="title-lg" accessibilityRole="header">
        {fallbackTitle}
      </Text>
    );
  }

  const name = `${car.make} ${car.model}`;
  const under = plateOrVin(car);
  const title = (
    <View style={{ gap: tokens.space['space-1'] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-1'] }}>
        <Text variant="title-lg" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1 }}>
          {name}
        </Text>
        {cars.length >= 2 ? <Icon name="down" size={20} /> : null}
      </View>
      <Text variant="vin-sm" color="ink-muted">
        {under}
      </Text>
    </View>
  );

  if (cars.length < 2) return title;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${under}. ${en.cars.switch}`}
        onPress={() => setOpen(true)}
        style={{ minHeight: 48, justifyContent: 'center' }}
      >
        {title}
      </Pressable>
      <CarListSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
