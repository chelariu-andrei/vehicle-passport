import type { ReactNode } from 'react';

import { AppBar, ErrorState, Screen, Skeleton } from '@/shared/design';
import { useStrings } from '@/shared/i18n';
import { useBack } from '@/shared/navigation/useBack';

import { useSettings, type Settings } from '../api/useSettings';

type Props = { title: string; children: (settings: Settings) => ReactNode };

/** A screen of Account > settings: its bar, and the settings once they are loaded (a skeleton, or a retry, before). */
export function SettingsPage({ title, children }: Props) {
  const s = useStrings();
  const back = useBack('/account');
  const query = useSettings();
  return (
    <Screen scroll header={<AppBar onBack={back} title={title} />}>
      {query.data ? (
        children(query.data)
      ) : query.isError ? (
        <ErrorState title={s.settings.loadError} onRetry={() => void query.refetch()} />
      ) : (
        <Skeleton height={160} />
      )}
    </Screen>
  );
}
