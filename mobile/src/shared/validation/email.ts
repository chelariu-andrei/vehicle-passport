import { z } from 'zod';

import { en } from '../i18n/en';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, en.validation.emailTooLong)
  .regex(EMAIL_PATTERN, en.validation.emailInvalid);
