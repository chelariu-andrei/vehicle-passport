import { useRouter } from 'expo-router';

import { Button, Screen, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { authErrorField, authErrorMessage, useSignIn } from '../api/useAuth';
import { CredentialsForm } from './CredentialsForm';
import { ProvidersBlock } from './ProvidersBlock';

export function SignInScreen() {
  const router = useRouter();
  const signIn = useSignIn();
  return (
    <Screen scroll>
      <Text variant="display-xl" accessibilityRole="header">
        {en.auth.signInTitle}
      </Text>
      <ProvidersBlock mode="in" />
      <CredentialsForm
        mode="in"
        pending={signIn.isPending}
        serverError={signIn.isError ? { field: authErrorField(signIn.error), message: authErrorMessage(signIn.error) } : null}
        onSubmit={({ email, password }) => signIn.mutate({ email, password })}
        onForgotPassword={() => router.push('/forgot-password')}
      />
      <Button kind="secondary" title={en.auth.toSignUp} onPress={() => router.push('/sign-up')} />
    </Screen>
  );
}
