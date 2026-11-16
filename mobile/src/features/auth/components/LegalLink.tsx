import { useRouter } from 'expo-router';

import { useSession } from '@/shared/auth/session';
import { Text } from '@/shared/design';
import { useStrings } from '@/shared/i18n';

/** "Terms" or "Privacy Policy", inline in a sentence, opening the legal screen (the signed-in one once there is a session). */
export function LegalLink({ type }: { type: 'terms' | 'privacy' }) {
  const s = useStrings();
  const router = useRouter();
  const { status } = useSession();
  const title = type === 'terms' ? s.auth.terms : s.auth.privacy;
  return (
    <Text color="brand" accessibilityRole="link" onPress={() => router.push(status === 'signedIn' ? `/account/legal/${type}` : `/legal/${type}`)}>
      {title}
    </Text>
  );
}
