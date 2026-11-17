import { en } from '@/shared/i18n/en';

import type { DetailsOf } from './types';
import { Fact } from './Fact';

export function InsuranceDetailsView({ details }: { details: DetailsOf<'INSURANCE'> }) {
  return (
    <>
      <Fact label={en.event.check.coverage} value={en.event.coverageValue[details.coverage]} />
      <Fact label={en.event.check.insurer} value={details.insurer} />
      {details.policyNumber ? <Fact label={en.event.check.policyNumber} value={details.policyNumber} /> : null}
    </>
  );
}
