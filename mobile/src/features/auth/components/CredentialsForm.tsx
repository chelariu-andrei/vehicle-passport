import { useState } from 'react';
import { View } from 'react-native';

import { Button, Field } from '@/shared/design';
import { en } from '@/shared/i18n/en';

type Props = {
  action: string;
  newPassword?: boolean;
  pending: boolean;
  error: string | null;
  onSubmit(email: string, password: string): void;
};

/** The two fields and the button both auth screens share. */
export function CredentialsForm({ action, newPassword = false, pending, error, onSubmit }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const ready = email.trim() !== '' && password !== '';

  return (
    <View style={{ gap: 16 }}>
      <Field
        label={en.auth.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Field
        label={en.auth.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={newPassword ? 'new-password' : 'current-password'}
        textContentType={newPassword ? 'newPassword' : 'password'}
        error={error ?? undefined}
      />
      <Button title={action} loading={pending} disabled={!ready} onPress={() => onSubmit(email.trim(), password)} />
    </View>
  );
}
