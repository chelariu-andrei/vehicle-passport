import { useEffect, useState } from 'react';

import { ConfirmSheet, toast } from '@/shared/design';
import { useStrings } from '@/shared/i18n';

import { useMe } from '../api/useMe';
import { appLock, authenticate, biometricCapability, useAppLock } from '../model/appLock';

/**
 * Offered once, after the first sign-in, when the phone can check a face or fingerprint. Either answer is remembered, so it is
 * never made again. Waits until the terms are accepted so it never competes with the consent screen.
 */
export function BiometricOfferSheet() {
  const s = useStrings();
  const { loaded, offered, enabled } = useAppLock();
  // Read-only: the consent gate itself (which may record a pending acceptance) is run once, by the root layout.
  const consentOwed = useMe().data?.consent.required;
  const [visible, setVisible] = useState(false);
  const eligible = loaded && !offered && !enabled && consentOwed === false;

  useEffect(() => {
    if (!eligible) return;
    let active = true;
    void biometricCapability().then((capability) => {
      if (active && capability === 'available') setVisible(true);
    });
    return () => {
      active = false;
    };
  }, [eligible]);

  const answer = async (enable: boolean) => {
    setVisible(false);
    await appLock.update({ offered: true });
    if (!enable) return;
    if (await authenticate(s.security.promptMessage)) await appLock.update({ enabled: true });
    else toast(s.security.authFailed);
  };

  return (
    <ConfirmSheet
      visible={visible}
      title={s.biometricOffer.title}
      body={s.biometricOffer.body}
      confirmLabel={s.biometricOffer.enable}
      dismissLabel={s.biometricOffer.later}
      onConfirm={() => void answer(true)}
      onCancel={() => void answer(false)}
    />
  );
}
