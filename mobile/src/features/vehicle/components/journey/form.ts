import type { z } from 'zod';

import type { vehicleFormSchema } from '../../model/vehicleForm';

/** What the journey's single form holds while the person types: text, before the schema turns it into a request. */
export type JourneyFormInput = z.input<ReturnType<typeof vehicleFormSchema>>;
