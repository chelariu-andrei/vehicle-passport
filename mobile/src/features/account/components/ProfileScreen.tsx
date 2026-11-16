import { useState } from 'react';

import { isApiError } from '@/shared/api';
import { errorMessage } from '@/shared/api/errorMessage';
import { AppBar, Button, ErrorState, Field, Screen, Skeleton, toast } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { useBack } from '@/shared/navigation/useBack';
import { displayNameSchema, normalizePhone, phoneSchema } from '@/shared/validation';

import { useMe } from '../api/useMe';
import { useUpdateProfile, type ProfilePatch } from '../api/useUpdateProfile';

type Errors = { name?: string; phone?: string };

type Me = NonNullable<ReturnType<typeof useMe>['data']>;

/** Account > Profile: name, the read-only email, and an optional phone number. */
export function ProfileScreen() {
  const back = useBack('/account');
  const me = useMe();
  const header = <AppBar onBack={back} title={en.profile.title} />;
  if (!me.data) {
    return (
      <Screen header={header}>
        {me.isError ? <ErrorState onRetry={() => void me.refetch()} /> : <Skeleton height={160} />}
      </Screen>
    );
  }
  return <ProfileForm account={me.data} header={header} back={back} />;
}

function ProfileForm({ account, header, back }: { account: Me; header: React.ReactElement; back: () => void }) {
  const update = useUpdateProfile();
  const [name, setName] = useState(account.displayName ?? '');
  const [phone, setPhone] = useState(account.phone ?? '');
  const [errors, setErrors] = useState<Errors>({});

  const submit = () => {
    const nextErrors: Errors = {};
    // A name-less account (an Apple user who shared none) is only prompted, so an empty name is left alone.
    const nameOptional = name.trim() === '' && !account.displayName?.trim();
    const parsedName = displayNameSchema.safeParse(name);
    if (!parsedName.success && !nameOptional) nextErrors.name = parsedName.error.issues[0]?.message;
    const normalized = normalizePhone(phone);
    const parsedPhone = phoneSchema.safeParse(normalized);
    if (!parsedPhone.success) nextErrors.phone = parsedPhone.error.issues[0]?.message;
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.phone) return;

    const patch: ProfilePatch = {};
    if (parsedName.success && parsedName.data !== (account.displayName ?? '')) patch.displayName = parsedName.data;
    const nextPhone = normalized === '' ? null : normalized;
    if (nextPhone !== account.phone) patch.phone = nextPhone;
    if (Object.keys(patch).length === 0) {
      back();
      return;
    }
    update.mutate(patch, {
      onSuccess: () => {
        toast(en.profile.saved);
        back();
      },
      onError: (error) => {
        // The server names no field, so the message goes under each one that was sent.
        if (isApiError(error, 'validation-failed')) {
          const message = errorMessage(error);
          setErrors({ name: 'displayName' in patch ? message : undefined, phone: 'phone' in patch ? message : undefined });
        } else {
          toast(errorMessage(error));
        }
      },
    });
  };

  return (
    <Screen scroll header={header}>
      <Field
        label={en.profile.name}
        value={name}
        onChangeText={setName}
        error={errors.name}
        helper={account.displayName === null ? en.profile.namePrompt : undefined}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
      />
      <Field label={en.profile.email} value={account.email ?? ''} editable={false} helper={account.emailVerified ? en.profile.verified : en.profile.notVerified} />
      <Field
        label={en.profile.phone}
        value={phone}
        onChangeText={setPhone}
        error={errors.phone}
        helper={en.profile.phoneHelper}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />
      <Button title={en.profile.save} loading={update.isPending} onPress={submit} />
    </Screen>
  );
}
