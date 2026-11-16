import { z } from 'zod';

import { en } from '../i18n/en';

const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, en.validation.displayNameRequired)
  .max(80, en.validation.displayNameTooLong)
  .refine((v) => !CONTROL_CHARS.test(v), en.validation.displayNameInvalid);
