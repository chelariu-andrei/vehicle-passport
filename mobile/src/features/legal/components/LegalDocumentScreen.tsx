import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { useSession } from '@/shared/auth/session';
import { AppBar, ErrorState, Markdown, Screen, Skeleton, Text, tokens } from '@/shared/design';
import { useBack } from '@/shared/navigation/useBack';

import { useLegalDocument } from '../api/useLegal';
import { isLegalType, versionLine } from '../model/display';
import { currentLocale } from '../model/locale';

/** One legal document. Reached signed out (from the sign-up caption) and signed in (from Account). */
export function LegalDocumentScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const { status } = useSession();
  const back = useBack(status === 'signedIn' ? '/account/legal' : '/sign-in');
  const valid = isLegalType(type);
  const query = useLegalDocument(valid ? type : 'terms', currentLocale(), valid);
  const doc = query.data;
  return (
    <Screen scroll header={<AppBar onBack={back} title={doc?.title} />}>
      {!valid || (query.isError && !doc) ? (
        <ErrorState onRetry={valid ? () => void query.refetch() : undefined} />
      ) : doc ? (
        <View style={{ gap: tokens.space['space-3'] }}>
          <Text variant="caption" color="ink-muted">
            {versionLine(doc.version, doc.effectiveDate)}
          </Text>
          <Markdown source={doc.bodyMarkdown} />
        </View>
      ) : (
        <Skeleton height={240} />
      )}
    </Screen>
  );
}
