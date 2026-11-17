import { en } from '@/shared/i18n/en';

import type { DetailsOf } from './types';
import { Fact } from './Fact';

export function RovinietaDetailsView({ details }: { details: DetailsOf<'ROVINIETA'> }) {
  return <Fact label={en.event.check.duration} value={en.event.durationOption[details.duration]} />;
}
