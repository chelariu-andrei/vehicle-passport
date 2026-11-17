import { en } from '@/shared/i18n/en';

import type { DetailsOf } from './types';
import { Fact } from './Fact';

export function ItpDetailsView({ details }: { details: DetailsOf<'ITP'> }) {
  return (
    <>
      {details.station ? <Fact label={en.event.check.station} value={details.station} /> : null}
      {details.result ? <Fact label={en.event.check.result} value={en.event.itpResultValue[details.result]} /> : null}
    </>
  );
}
