import { useRouter } from 'expo-router';

import { Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';

/** "Terms" or "Privacy Policy", inline in a sentence, opening the legal screen. */
export function LegalLink({ type }: { type: 'terms' | 'privacy' }) {
  const router = useRouter();
  const title = type === 'terms' ? en.auth.terms : en.auth.privacy;
  return (
    <Text color="brand" accessibilityRole="link" onPress={() => router.push(`/legal/${type}`)}>
      {title}
    </Text>
  );
}
