import { View } from 'react-native';

import { Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import type { DetailsOf } from './types';
import { Fact } from './Fact';

/** What a scanned invoice read: service name, parts and labor. Old ITP events may carry it too. */
export function ScanDetailsView({ details }: { details: DetailsOf<'SCAN'> }) {
  const parts = details.parts ?? [];
  return (
    <>
      {details.serviceName ? <Fact label={en.event.serviceName} value={details.serviceName} /> : null}
      {parts.length > 0 ? (
        <View style={{ gap: tokens.space['space-1'] }}>
          <Text variant="label" color="ink-muted">
            {en.event.parts}
          </Text>
          {parts.map((part, index) => (
            <Text key={`${part.name}-${index}`} variant="body-lg">
              {en.event.part(part.name, part.qty, part.price)}
            </Text>
          ))}
        </View>
      ) : null}
      {details.labor != null ? <Fact label={en.event.labor} value={String(details.labor)} /> : null}
    </>
  );
}
