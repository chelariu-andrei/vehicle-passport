import type { ComponentType } from 'react';

import { InsuranceDetailsView } from './InsuranceDetailsView';
import { ItpDetailsView } from './ItpDetailsView';
import { RovinietaDetailsView } from './RovinietaDetailsView';
import { SafetyEquipmentDetailsView } from './SafetyEquipmentDetailsView';
import { ScanDetailsView } from './ScanDetailsView';
import type { DetailsOf, DetailsOutput } from './types';

export { ComponentsView } from './ComponentsView';
export { CustomFieldsView } from './CustomFieldsView';
export { DetailsView } from './DetailsView';
export { Fact } from './Fact';
export type { DetailsOutput } from './types';

/** One renderer per details kind; a missing kind fails to compile. The detail screen looks it up instead of switching on a type. */
export const DETAILS_VIEW: { [K in DetailsOutput['kind']]: ComponentType<{ details: DetailsOf<K> }> } = {
  SCAN: ScanDetailsView,
  INSURANCE: InsuranceDetailsView,
  ROVINIETA: RovinietaDetailsView,
  ITP: ItpDetailsView,
  SAFETY_EQUIPMENT: SafetyEquipmentDetailsView,
};
