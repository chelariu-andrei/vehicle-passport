import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { AppBar, Card, ErrorState, Screen, Skeleton, Text } from '@/shared/design';
import { useStrings } from '@/shared/i18n';
import { useBack } from '@/shared/navigation/useBack';

import { useLegalDocuments } from '../api/useLegal';
import { versionLine } from '../model/display';
import { useLegalLocale } from '../model/locale';

/** Account > Legal: every document with its version and effective date. */
export function LegalListScreen() {
  const router = useRouter();
  const back = useBack('/account');
  const s = useStrings();
  const query = useLegalDocuments(useLegalLocale());
  return (
    <Screen scroll header={<AppBar onBack={back} title={s.legal.title} />}>
      {query.isError && !query.data ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data ? (
        query.data.map((doc) => (
          <Pressable
            key={doc.type}
            accessibilityRole="button"
            accessibilityLabel={doc.title}
            onPress={() => router.push({ pathname: '/account/legal/[type]', params: { type: doc.type } })}
          >
            <Card>
              <Text variant="title">{doc.title}</Text>
              <Text variant="caption" color="ink-muted">
                {versionLine(doc.version, doc.effectiveDate)}
              </Text>
            </Card>
          </Pressable>
        ))
      ) : (
        <Skeleton height={96} />
      )}
    </Screen>
  );
}
