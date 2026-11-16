import { useRouter } from 'expo-router';

import { Button, Screen, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { authErrorField, authErrorMessage, useSignUp } from '../api/useAuth';
import { rememberPendingConsent } from '../model/pendingConsent';
import { CredentialsForm } from './CredentialsForm';
import { ProvidersBlock } from './ProvidersBlock';

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
        <>
          <ProvidersBlock mode="up" />
          <CredentialsForm
            mode="up"
            pending={signUp.isPending}
            serverError={signUp.isError ? { field: authErrorField(signUp.error), message: authErrorMessage(signUp.error) } : null}
            onSubmit={(values) =>
              signUp.mutate(values, {
                // The terms were accepted in this form; the first signed-in session records them (Task 6 reads this).
                onSuccess: (result) => {
                  if (result === 'confirmationRequired') void rememberPendingConsent(values.email);
                },
              })
            }
          />
        </>
      )}
      <Button kind="secondary" title={en.auth.toSignIn} onPress={() => router.back()} />
    </Screen>
  );
}
