import { z } from 'zod';

import { en } from '../i18n/en';

export const passwordSchema = z
  .string()
  .min(8, en.validation.passwordTooShort)
  .max(72, en.validation.passwordTooLong);
