import { Platform, View } from 'react-native';

import { SocialButton, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { authErrorMessage, useSocialSignIn } from '../api/useAuth';
import { LegalLink } from './LegalLink';

/** Apple (iOS only) then Google; nothing on the web. A cancelled sheet leaves everything as it was. */
export function ProvidersBlock({ mode }: { mode: 'in' | 'up' }) {
  const social = useSocialSignIn();
  if (Platform.OS === 'web') return null;
  const busy = social.isPending ? social.variables : null;
  return (
    <View style={{ gap: tokens.space['space-3'] }}>
      {Platform.OS === 'ios' ? (
        <SocialButton
          provider="apple"
          title={en.auth.continueWithApple}
          loading={busy === 'apple'}
          disabled={social.isPending}
          onPress={() => social.mutate('apple')}
        />
      ) : null}
      <SocialButton
        provider="google"
        title={en.auth.continueWithGoogle}
        loading={busy === 'google'}
        disabled={social.isPending}
        onPress={() => social.mutate('google')}
      />
      {social.isError ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {authErrorMessage(social.error)}
        </Text>
      ) : null}
      {mode === 'up' ? (
        <Text variant="caption" color="ink-muted">
          {en.auth.continueCaption} <LegalLink type="terms" /> {en.auth.and} <LegalLink type="privacy" />
        </Text>
      ) : null}
      <Text variant="caption" color="ink-muted" style={{ textAlign: 'center' }}>
        {en.auth.orWithEmail}
      </Text>
    </View>
  );
}
