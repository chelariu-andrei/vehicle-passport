import { useRouter } from 'expo-router';

import { Button, Screen, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { authErrorMessage, useSignIn } from '../api/useAuth';
import { CredentialsForm } from './CredentialsForm';

export function SignInScreen() {
  const router = useRouter();
  const signIn = useSignIn();
  return (
    <Screen scroll>
      <Text variant="display-xl" accessibilityRole="header">
        {en.auth.signInTitle}
      </Text>
      <CredentialsForm
        action={en.auth.signInAction}
        pending={signIn.isPending}
        error={signIn.isError ? authErrorMessage(signIn.error) : null}
        onSubmit={(email, password) => signIn.mutate({ email, password })}
      />
      <Button kind="secondary" title={en.auth.toSignUp} onPress={() => router.push('/sign-up')} />
    </Screen>
  );
}
