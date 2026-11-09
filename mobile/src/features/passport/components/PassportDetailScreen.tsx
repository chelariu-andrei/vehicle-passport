import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Share, View } from 'react-native';

import { useVehicles } from '@/features/vehicle';
import { errorMessage, useRefetchOnFocus } from '@/shared/api';
import { Button, Card, ConfirmSheet, EmptyState, ErrorState, Screen, Skeleton, Text, toast, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { usePassportQr, useSavePassportPdf } from '../api/usePassportFiles';
import { usePassports } from '../api/usePassports';
import { useRevokePassport } from '../api/useRevokePassport';
import { formatDate, passportHeader, truncateHash } from '../model/display';
import type { PassportResponse } from '../model/display';

const QR_SIZE = 220;

function Qr({ passport }: { passport: PassportResponse }) {
  const { source, reload } = usePassportQr(passport.id, true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
    reload();
  };

  if (failed) {
    return (
      <View style={{ alignItems: 'center', gap: tokens.space['space-2'] }}>
        <Text color="ink-muted" style={{ textAlign: 'center' }}>
          {en.passport.qrFailed}
        </Text>
        <Button kind="secondary" title={en.passport.qrRetry} onPress={retry} />
      </View>
    );
  }
  if (!source) return <Skeleton width={QR_SIZE} height={QR_SIZE} />;
  return (
    <Image
      key={attempt}
      accessibilityLabel={en.passport.qrLabel}
      source={source}
      cachePolicy="none"
      contentFit="contain"
      onError={() => setFailed(true)}
      style={{ width: QR_SIZE, height: QR_SIZE, backgroundColor: '#ffffff' }}
    />
  );
}

function Detail({ passport, header }: { passport: PassportResponse; header: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const revoke = useRevokePassport(passport.id);
  const pdf = useSavePassportPdf(passport.id, passport.vin);
  const active = passport.status === 'ACTIVE';

  const back = () => (router.canGoBack() ? router.back() : router.replace('/passports'));
  const doRevoke = () => {
    if (revoke.isPending) return;
    revoke.mutate(undefined, {
      onSettled: () => setConfirming(false),
      onError: (error) => toast(errorMessage(error)),
    });
  };

  return (
    <Screen scroll>
      <Button kind="secondary" title={en.common.back} onPress={back} />
      <Card style={{ gap: tokens.space['space-3'], alignItems: 'center' }}>
        <Text variant="caption" color="ink-muted">
          {en.passport.frozen}
        </Text>
        <Text variant="title-lg" accessibilityRole="header">
          {header}
        </Text>
        {header !== passport.vin ? (
          <Text variant="vin-sm" color="ink-muted">
            {passport.vin}
          </Text>
        ) : null}
        <Text variant="label">{en.passport.status[passport.status]}</Text>
        {active ? <Qr passport={passport} /> : null}
        <Text color="ink-muted">{passport.expiresAt ? en.passport.expires(formatDate(passport.expiresAt)) : en.passport.noExpiry}</Text>
        <Text color="ink-muted">{en.passport.created(formatDate(passport.createdAt))}</Text>
        <View style={{ alignItems: 'center', gap: tokens.space['space-1'] }}>
          <Text variant="caption" color="ink-muted">
            {en.passport.integrity}
          </Text>
          <Text variant="vin-sm">{truncateHash(passport.hash)}</Text>
          <Text variant="caption" color="ink-muted" style={{ textAlign: 'center' }}>
            {en.passport.integrityNote}
          </Text>
        </View>
      </Card>

      {active ? (
        <View style={{ gap: tokens.space['space-3'] }}>
          <Button title={en.passport.shareLink} onPress={() => void Share.share({ message: passport.publicUrl })} />
          <Button
            kind="secondary"
            title={en.passport.savePdf}
            loading={pdf.isPending}
            onPress={() => pdf.mutate(undefined, { onError: (error) => toast(errorMessage(error)) })}
          />
          <Button kind="secondary" title={en.passport.buyerView} onPress={() => void WebBrowser.openBrowserAsync(passport.publicUrl)} />
          <Button kind="danger" title={en.passport.revoke} onPress={() => setConfirming(true)} />
        </View>
      ) : null}

      <ConfirmSheet
        visible={confirming}
        title={en.passport.revokeTitle}
        body={en.passport.revokeBody}
        confirmLabel={en.passport.revokeConfirm}
        danger
        onConfirm={doRevoke}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}

/** Reads from the list: there is no get-by-id (integration 3.5). */
export function PassportDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const passports = usePassports();
  const vehicles = useVehicles();
  useRefetchOnFocus(passports.refetch);
  const passport = passports.data?.find((p) => p.id === id);

  if (passport) return <Detail passport={passport} header={passportHeader(passport, vehicles.data ?? [])} />;
  return (
    <Screen>
      {passports.isError ? (
        <ErrorState onRetry={() => void passports.refetch()} />
      ) : passports.isPending ? (
        <View accessible accessibilityLabel={en.common.loading} style={{ gap: tokens.space['space-2'] }}>
          <Skeleton height={32} width="70%" />
          <Skeleton height={220} />
        </View>
      ) : (
        <EmptyState
          icon="doc"
          title={en.passport.unavailable}
          action={{ title: en.common.back, onPress: () => (router.canGoBack() ? router.back() : router.replace('/passports')) }}
        />
      )}
    </Screen>
  );
}
