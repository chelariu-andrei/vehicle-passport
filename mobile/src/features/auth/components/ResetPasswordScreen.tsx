import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button, Field, Screen, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { passwordSchema } from '@/shared/validation';

import { authErrorMessage, useStartRecovery, useUpdatePassword } from '../api/useAuth';

const schema = z.object({ password: passwordSchema });

/** Opened from the reset email (`vehiclepassport://reset-password?code=...`): the code becomes a recovery session, then the new password is set. */
export function ResetPasswordScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const recovery = useStartRecovery();
  const update = useUpdatePassword();
  const { control, handleSubmit } = useForm<{ password: string }>({
    resolver: zodResolver(schema) as never,
    defaultValues: { password: '' },
  });

  const { mutate: startRecovery } = recovery;
  useEffect(() => {
    if (code) startRecovery(code);
  }, [code, startRecovery]);

  const invalid = !code || recovery.isError;
  return (
    <Screen scroll>
      <Text variant="display-xl" accessibilityRole="header">
        {en.auth.resetTitle}
      </Text>
      {invalid ? (
        <>
          <Text accessibilityRole="alert">{en.auth.resetLinkInvalid}</Text>
          <Button title={en.auth.toForgot} onPress={() => router.replace('/forgot-password')} />
        </>
      ) : !recovery.isSuccess ? (
        <Text color="ink-muted">{en.auth.checkingLink}</Text>
      ) : (
        <>
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <Field
                label={en.auth.newPassword}
                value={field.value}
                onChangeText={field.onChange}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                error={fieldState.error?.message ?? (update.isError ? authErrorMessage(update.error) : undefined)}
              />
            )}
          />
          <Button
            title={en.auth.resetAction}
            loading={update.isPending}
            onPress={() => void handleSubmit(({ password }) => update.mutate(password, { onSuccess: () => router.replace('/') }))()}
          />
        </>
      )}
    </Screen>
  );
}
