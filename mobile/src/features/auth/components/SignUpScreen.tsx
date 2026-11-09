import { useRouter } from 'expo-router';

import { Button, Screen, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { authErrorMessage, useSignUp } from '../api/useAuth';
import { CredentialsForm } from './CredentialsForm';

export function SignUpScreen() {
  const router = useRouter();
  const signUp = useSignUp();
  const needsConfirmation = signUp.data === 'confirmationRequired';
  return (
    <Screen scroll>
      <Text variant="display-xl" accessibilityRole="header">
        {en.auth.signUpTitle}
      </Text>
      {needsConfirmation ? (
        <Text accessibilityRole="alert">{en.auth.confirmationRequired}</Text>
      ) : (
        <CredentialsForm
          action={en.auth.signUpAction}
          newPassword
          pending={signUp.isPending}
          error={signUp.isError ? authErrorMessage(signUp.error) : null}
          onSubmit={(email, password) => signUp.mutate({ email, password })}
        />
      )}
      <Button kind="secondary" title={en.auth.toSignIn} onPress={() => router.back()} />
    </Screen>
  );
}
