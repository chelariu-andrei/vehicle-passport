import type { ComponentType } from 'react';

import { DETAILS_VIEW } from './index';
import type { DetailsOutput } from './types';

/** Picks the renderer for the details' `kind` from the registry. */
export function DetailsView({ details }: { details: DetailsOutput }) {
  const View = DETAILS_VIEW[details.kind] as ComponentType<{ details: DetailsOutput }>;
  return <View details={details} />;
}
