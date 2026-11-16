import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { AppBar, Button, Field, Screen, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { emailSchema } from '@/shared/validation';

import { authErrorMessage, useSendPasswordReset } from '../api/useAuth';

const schema = z.object({ email: emailSchema });

export function ForgotPasswordScreen() {
  const router = useRouter();
  const reset = useSendPasswordReset();
  const { control, handleSubmit } = useForm<{ email: string }>({
    resolver: zodResolver(schema) as never,
    defaultValues: { email: '' },
  });
  return (
    <Screen scroll header={<AppBar onBack={() => router.back()} />}>
      <Text variant="display-xl" accessibilityRole="header">
        {en.auth.forgotTitle}
      </Text>
      <Text color="ink-muted">{en.auth.forgotIntro}</Text>
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <Field
            label={en.auth.email}
            value={field.value}
            onChangeText={field.onChange}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            error={fieldState.error?.message ?? (reset.isError ? authErrorMessage(reset.error) : undefined)}
          />
        )}
      />
      {reset.isSuccess ? <Text accessibilityRole="alert">{en.auth.resetSent}</Text> : null}
      <Button
        title={en.auth.sendResetLink}
        loading={reset.isPending}
        onPress={() => void handleSubmit(({ email }) => reset.mutate(email))()}
      />
    </Screen>
  );
}
