import { View } from 'react-native';

import { errorMessage } from '@/shared/api';
import { Button, Card, Text, toast, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useWithdrawClaim } from '../api/useWithdrawClaim';
import type { LocalClaim } from '../model/claimStore';

/** A claim this phone filed and the current owner has not answered. */
export function PendingClaimRow({ claim }: { claim: LocalClaim }) {
  const withdraw = useWithdrawClaim();
  return (
    <Card style={{ gap: tokens.space['space-3'] }}>
      <View style={{ gap: tokens.space['space-1'] }}>
        <Text variant="vin-sm">{claim.vin}</Text>
        <Text color="ink-muted">{en.garage.waiting}</Text>
      </View>
      <Button
        kind="secondary"
        title={en.garage.withdraw}
        loading={withdraw.isPending}
        onPress={() => withdraw.mutate(claim.claimId, { onError: (error) => toast(errorMessage(error)) })}
      />
    </Card>
  );
}
