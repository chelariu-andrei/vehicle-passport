import { z } from 'zod';

import { en } from '../i18n/en';

export const supportMessageSchema = z
  .string()
  .min(10, en.validation.supportMessageTooShort)
  .max(4000, en.validation.supportMessageTooLong);
