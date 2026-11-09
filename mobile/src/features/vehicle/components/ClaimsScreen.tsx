import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage, forgetVehicle, useRefetchOnFocus } from '@/shared/api';
import { AsyncList, Button, Card, ConfirmSheet, Screen, Text, toast, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { goToGarage } from '@/shared/navigation/goToGarage';

import { useApproveClaim, useClaims, useRejectClaim } from '../api/useClaims';
import type { PendingClaim } from '../api/useClaims';

type Decision = { kind: 'approve' | 'reject'; claim: PendingClaim };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function ClaimsScreen({ vin }: { vin: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const claims = useClaims(vin);
  const approve = useApproveClaim(vin);
  const reject = useRejectClaim(vin);
  const [deciding, setDeciding] = useState<Decision | null>(null);
  useRefetchOnFocus(claims.refetch);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/vehicles/${vin}`));
  const busy = approve.isPending || reject.isPending;

  const confirm = () => {
    if (!deciding || busy) return;
    const { kind, claim } = deciding;
    const fail = (error: unknown) => {
      setDeciding(null);
      toast(errorMessage(error));
    };
    if (kind === 'approve') {
      approve.mutate(claim.claimId, {
        onSuccess: () => {
          setDeciding(null);
          // The car is no longer ours: leave first, then drop what is cached for it.
          goToGarage();
          forgetVehicle(queryClient, vin);
        },
        onError: fail,
      });
    } else {
      reject.mutate(claim.claimId, { onSuccess: () => setDeciding(null), onError: fail });
    }
  };

  const approving = deciding?.kind === 'approve';
  return (
    <Screen>
      <Text variant="display-xl" accessibilityRole="header">
        {en.claims.title}
      </Text>
      <AsyncList
        query={claims}
        data={claims.data}
        keyExtractor={(claim) => claim.claimId}
        renderItem={({ item }) => (
          <Card style={{ gap: tokens.space['space-3'] }}>
            <Text variant="title">{en.claims.filed(formatDate(item.filedAt))}</Text>
            <View style={{ gap: tokens.space['space-2'] }}>
              <Button title={en.claims.approve} onPress={() => setDeciding({ kind: 'approve', claim: item })} />
              <Button kind="danger" title={en.claims.reject} onPress={() => setDeciding({ kind: 'reject', claim: item })} />
            </View>
          </Card>
        )}
        empty={
          <Text color="ink-muted" style={{ textAlign: 'center', paddingTop: tokens.space['space-8'] }}>
            {en.claims.empty}
          </Text>
        }
      />
      <Button kind="secondary" title={en.common.back} onPress={back} />
      <ConfirmSheet
        visible={deciding !== null}
        title={approving ? en.claims.approveTitle : en.claims.rejectTitle}
        body={approving ? en.claims.approveBody : en.claims.rejectBody}
        confirmLabel={approving ? en.claims.approveConfirm : en.claims.rejectConfirm}
        danger
        onConfirm={confirm}
        onCancel={() => setDeciding(null)}
      />
    </Screen>
  );
}
