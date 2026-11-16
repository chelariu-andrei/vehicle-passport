import { useRouter } from 'expo-router';

import { Button, Screen, Text } from '@/shared/design';
import { useStrings } from '@/shared/i18n';

import { authErrorField, authErrorMessage, useSignUp } from '../api/useAuth';
import { CredentialsForm } from './CredentialsForm';
import { ProvidersBlock } from './ProvidersBlock';

export function SignUpScreen() {
  const s = useStrings();
  const router = useRouter();
  const signUp = useSignUp();
  const needsConfirmation = signUp.data === 'confirmationRequired';
  return (
    <Screen scroll>
      <Text variant="display-xl" accessibilityRole="header">
        {s.auth.signUpTitle}
      </Text>
      {needsConfirmation ? (
        <Text accessibilityRole="alert">{s.auth.confirmationRequired}</Text>
      ) : (
        <>
          <ProvidersBlock mode="up" />
          <CredentialsForm
            mode="up"
            pending={signUp.isPending}
            serverError={signUp.isError ? { field: authErrorField(signUp.error), message: authErrorMessage(signUp.error, s) } : null}
            onSubmit={(values) => signUp.mutate(values)}
          />
        </>
      )}
      <Button kind="secondary" title={s.auth.toSignIn} onPress={() => router.back()} />
    </Screen>
  );
}
