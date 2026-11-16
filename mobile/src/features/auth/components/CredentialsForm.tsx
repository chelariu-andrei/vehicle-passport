import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { Button, Field, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { displayNameSchema, emailSchema, passwordSchema } from '@/shared/validation';

import { TermsCheckbox } from './TermsCheckbox';

const signInSchema = z.object({
  email: emailSchema,
  // Sign-in accepts whatever the account already has; the length rules apply when choosing one.
  password: z.string().min(1, en.validation.passwordRequired),
});
const signUpSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
  termsAccepted: z.literal(true),
});

type FormValues = { displayName: string; email: string; password: string; termsAccepted: boolean };

type Props = {
  mode: 'in' | 'up';
  pending: boolean;
  /** A failure from the server and the field it belongs under. */
  serverError?: { field: 'email' | 'password'; message: string } | null;
  onSubmit(values: { email: string; password: string; displayName: string }): void;
  onForgotPassword?(): void;
};

/** The fields and the button both auth screens share. Checks run on submit; the email is never cleared. */
export function CredentialsForm({ mode, pending, serverError, onSubmit, onForgotPassword }: Props) {
  const up = mode === 'up';
  const [visible, setVisible] = useState(false);
  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(up ? signUpSchema : signInSchema) as never,
    defaultValues: { displayName: '', email: '', password: '', termsAccepted: false },
  });
  const [email, password, termsAccepted] = useWatch({ control, name: ['email', 'password', 'termsAccepted'] });
  const ready = up ? termsAccepted : email.trim() !== '' && password !== '';

  return (
    <View style={{ gap: tokens.space['space-4'] }}>
      {up ? (
        <Controller
          control={control}
          name="displayName"
          render={({ field, fieldState }) => (
            <Field
              label={en.auth.displayName}
              value={field.value}
              onChangeText={field.onChange}
              autoComplete="name"
              textContentType="name"
              error={fieldState.error?.message}
            />
          )}
        />
      ) : null}
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
            error={fieldState.error?.message ?? (serverError?.field === 'email' ? serverError.message : undefined)}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <Field
            label={en.auth.password}
            value={field.value}
            onChangeText={field.onChange}
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoComplete={up ? 'new-password' : 'current-password'}
            textContentType={up ? 'newPassword' : 'password'}
            error={fieldState.error?.message ?? (serverError?.field === 'password' ? serverError.message : undefined)}
          />
        )}
      />
      <Button kind="quiet" title={visible ? en.auth.hidePassword : en.auth.showPassword} onPress={() => setVisible((shown) => !shown)} />
      {!up && onForgotPassword ? <Button kind="quiet" title={en.auth.forgotPassword} onPress={onForgotPassword} /> : null}
      {up ? (
        <Controller control={control} name="termsAccepted" render={({ field }) => <TermsCheckbox checked={field.value} onChange={field.onChange} />} />
      ) : null}
      <Button
        title={up ? en.auth.signUpAction : en.auth.signInAction}
        loading={pending}
        disabled={!ready}
        onPress={() => void handleSubmit((values) => onSubmit({ email: values.email, password: values.password, displayName: values.displayName }))()}
      />
    </View>
  );
}
