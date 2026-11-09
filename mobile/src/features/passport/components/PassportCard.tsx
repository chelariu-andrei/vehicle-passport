import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { VehicleResponse } from '@/features/vehicle';
import { Card, Icon, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { formatDate, passportHeader } from '../model/display';
import type { PassportResponse } from '../model/display';

/** One passport in the list. The status is a word, never colour alone, and the label is "Frozen snapshot". */
export function PassportCard({ passport, vehicles }: { passport: PassportResponse; vehicles: VehicleResponse[] }) {
  const router = useRouter();
  const header = passportHeader(passport, vehicles);
  const status = en.passport.status[passport.status];
  const expiry = passport.expiresAt ? en.passport.expires(formatDate(passport.expiresAt)) : en.passport.noExpiry;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${header}, ${passport.vin}, ${status}`}
      onPress={() => router.push(`/passports/${passport.id}`)}
    >
      <Card style={{ gap: tokens.space['space-2'] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-2'] }}>
          <Icon name="doc" size={16} color="ink-muted" />
          <Text variant="caption" color="ink-muted">
            {en.passport.frozen}
          </Text>
        </View>
        <Text variant="title-lg">{header}</Text>
        {header !== passport.vin ? (
          <Text variant="vin-sm" color="ink-muted">
            {passport.vin}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="label">{status}</Text>
          <Text color="ink-muted">{expiry}</Text>
        </View>
      </Card>
    </Pressable>
  );
}
