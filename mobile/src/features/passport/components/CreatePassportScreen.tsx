import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { errorMessage } from '@/shared/api';
import { Button, Card, Icon, Screen, Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useCreatePassport } from '../api/useCreatePassport';
import { expiryFrom } from '../model/display';
import type { ExpiryChoice } from '../model/display';

const CHOICES: { choice: ExpiryChoice; label: string }[] = [
  { choice: 7, label: en.passport.expiry[7] },
  { choice: 30, label: en.passport.expiry[30] },
  { choice: 90, label: en.passport.expiry[90] },
  { choice: null, label: en.passport.expiry.none },
];

export function CreatePassportScreen({ vin }: { vin: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const create = useCreatePassport(vin);
  const [choice, setChoice] = useState<ExpiryChoice>(30);

  const close = () => (router.canGoBack() ? router.back() : router.replace(`/vehicles/${vin}`));
  const submit = () => {
    if (create.isPending) return;
    create.mutate(expiryFrom(choice, new Date()), { onSuccess: (passport) => router.replace(`/passports/${passport.id}`) });
  };

  return (
    <Screen scroll>
      <Text variant="display-xl" accessibilityRole="header">
        {en.passport.createTitle}
      </Text>
      <Card style={{ gap: tokens.space['space-2'] }}>
        <Text variant="title" accessibilityRole="header">
          {en.passport.freezeTitle}
        </Text>
        <Text variant="body-lg" color="ink-muted">
          {en.passport.freezeBody}
        </Text>
      </Card>

      <View accessibilityRole="radiogroup" accessibilityLabel={en.passport.expiryLabel} style={{ gap: tokens.space['space-2'] }}>
        <Text variant="label">{en.passport.expiryLabel}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
          {CHOICES.map((option) => {
            const selected = option.choice === choice;
            return (
              <Pressable
                key={option.label}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                onPress={() => setChoice(option.choice)}
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
                <Text variant="label">{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {create.isError ? (
        <Text color="danger" accessibilityRole="alert">
          {errorMessage(create.error)}
        </Text>
      ) : null}
      <Button title={en.passport.createSubmit} loading={create.isPending} onPress={submit} />
      <Button kind="secondary" title={en.common.cancel} onPress={close} />
    </Screen>
  );
}
