import { en } from '@/shared/i18n/en';

import type { DetailsOf } from './types';
import { Fact } from './Fact';

export function SafetyEquipmentDetailsView({ details }: { details: DetailsOf<'SAFETY_EQUIPMENT'> }) {
  return <Fact label={en.event.check.item} value={en.event.safetyItem[details.item]} />;
}
