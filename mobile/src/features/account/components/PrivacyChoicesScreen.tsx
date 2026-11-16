import { View } from 'react-native';

import { AppBar, ErrorState, Screen, Skeleton, Switch, Text, tokens } from '@/shared/design';
import { useStrings } from '@/shared/i18n';
import { useBack } from '@/shared/navigation/useBack';

import { useConsentStatus, useSetOptionalConsent } from '../api/usePrivacyChoices';

/** Account > Privacy choices: the optional marketing and analytics consents, which can be withdrawn here at any time. */
export function PrivacyChoicesScreen() {
  const s = useStrings();
  const back = useBack('/account');
  const query = useConsentStatus();
  const { mutate } = useSetOptionalConsent();
  return (
    <Screen scroll header={<AppBar onBack={back} title={s.privacy.title} />}>
      {query.data ? (
        <View style={{ gap: tokens.space['space-3'] }}>
          <Text color="ink-muted">{s.privacy.intro}</Text>
          <Switch label={s.privacy.marketing} value={query.data.marketing} onValueChange={(value) => mutate({ key: 'marketing', value })} />
          <Switch label={s.privacy.analytics} value={query.data.analytics} onValueChange={(value) => mutate({ key: 'analytics', value })} />
        </View>
      ) : query.isError ? (
        <ErrorState title={s.privacy.loadError} onRetry={() => void query.refetch()} />
      ) : (
        <Skeleton height={160} />
      )}
    </Screen>
  );
}
