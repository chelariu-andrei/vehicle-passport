import { useState } from 'react';
import { View } from 'react-native';

import { TermsCheckbox } from '@/features/auth';
import { errorMessage } from '@/shared/api';
import { signOut } from '@/shared/auth/session';
import { Button, Screen, Skeleton, Switch, Text, tokens } from '@/shared/design';
import { useStrings } from '@/shared/i18n';

import { useAcceptConsent } from '../api/useConsent';
import { useMe } from '../api/useMe';

/** Shown until the current terms and privacy are accepted. The app behind it stays closed. */
export function ConsentGateScreen() {
  const s = useStrings();
  const me = useMe();
  const accept = useAcceptConsent();
  // The box is ticked for one pair of versions; new texts need a fresh yes.
  const [tickedFor, setTickedFor] = useState<string | null>(null);
  const [marketing, setMarketing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const consent = me.data?.consent;
  const versions = consent ? `${consent.terms.currentVersion}/${consent.privacy.currentVersion}` : null;
  const terms = versions !== null && tickedFor === versions;

  return (
    <Screen
      scroll
      footer={
        <View style={{ gap: tokens.space['space-2'], paddingHorizontal: tokens.space['space-4'] }}>
          <Button
            title={s.consent.accept}
            disabled={!terms || !consent}
            loading={accept.isPending}
            onPress={() => consent && accept.mutate({ consent, marketing, analytics })}
          />
          <Button kind="quiet" title={s.consent.signOut} onPress={() => void signOut()} />
        </View>
      }
    >
      <Text variant="title-lg">{s.consent.title}</Text>
      <Text color="ink-muted">{s.consent.summary}</Text>
      {consent ? (
        <View style={{ gap: tokens.space['space-3'] }}>
          <TermsCheckbox checked={terms} onChange={(checked) => setTickedFor(checked ? versions : null)} />
          <Switch label={s.consent.marketing} value={marketing} onValueChange={setMarketing} />
          <Switch label={s.consent.analytics} value={analytics} onValueChange={setAnalytics} />
        </View>
      ) : (
        <Skeleton height={160} />
      )}
      {accept.isError ? (
        <Text accessibilityRole="alert" color="danger">
          {errorMessage(accept.error)}
        </Text>
      ) : null}
    </Screen>
  );
}
