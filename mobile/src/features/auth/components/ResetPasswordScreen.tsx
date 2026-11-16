import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button, Field, Screen, Text } from '@/shared/design';
import { useStrings, useValidationMessage } from '@/shared/i18n';
import { passwordSchema } from '@/shared/validation';

import { authErrorMessage, useStartRecovery, useUpdatePassword } from '../api/useAuth';

const schema = z.object({ password: passwordSchema });

/** Opened from the reset email (`vehiclepassport://reset-password?code=...`): the code becomes a recovery session, then the new password is set. */
export function ResetPasswordScreen() {
  const s = useStrings();
  const localized = useValidationMessage();
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
        {s.auth.resetTitle}
      </Text>
      {invalid ? (
        <>
          <Text accessibilityRole="alert">{s.auth.resetLinkInvalid}</Text>
          <Button title={s.auth.toForgot} onPress={() => router.replace('/forgot-password')} />
        </>
      ) : !recovery.isSuccess ? (
        <Text color="ink-muted">{s.auth.checkingLink}</Text>
      ) : (
        <>
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <Field
                label={s.auth.newPassword}
                value={field.value}
                onChangeText={field.onChange}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                error={localized(fieldState.error?.message) ?? (update.isError ? authErrorMessage(update.error, s) : undefined)}
              />
            )}
          />
          <Button
            title={s.auth.resetAction}
            loading={update.isPending}
            onPress={() => void handleSubmit(({ password }) => update.mutate(password, { onSuccess: () => router.replace('/') }))()}
          />
        </>
      )}
    </Screen>
  );
}
