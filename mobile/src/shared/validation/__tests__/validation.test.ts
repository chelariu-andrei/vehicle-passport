import {
  displayNameSchema,
  emailSchema,
  normalizePhone,
  passwordSchema,
  phoneSchema,
  supportMessageSchema,
} from '..';

describe('validation', () => {
  it('emailRejectsMissingAt', () => {
    expect(emailSchema.safeParse('nobody.example.com').success).toBe(false);
    expect(emailSchema.safeParse('a@b.co').success).toBe(true);
  });

  it('emailTrimsAndLowercases', () => {
    expect(emailSchema.parse('  Foo@Example.COM ')).toBe('foo@example.com');
  });

  it('passwordRejectsSevenChars', () => {
    expect(passwordSchema.safeParse('1234567').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(true);
  });

  it('passwordRejectsOver72', () => {
    expect(passwordSchema.safeParse('a'.repeat(72)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(73)).success).toBe(false);
  });

  it('displayNameRejectsBlankAfterTrim', () => {
    expect(displayNameSchema.safeParse('   ').success).toBe(false);
    expect(displayNameSchema.parse('  Ana ')).toBe('Ana');
    expect(displayNameSchema.safeParse('a'.repeat(81)).success).toBe(false);
  });

  it('displayNameRejectsControlChars', () => {
    expect(displayNameSchema.safeParse('Ana\u0000').success).toBe(false);
    expect(displayNameSchema.safeParse('A\nna').success).toBe(false);
  });

  it('normalizePhoneStripsSeparators', () => {
    expect(normalizePhone('+40 712-345 678')).toBe('+40712345678');
    expect(normalizePhone('+40 (712) 345-678')).toBe('+40712345678');
  });

  it('phoneRejectsNoPlus', () => {
    expect(phoneSchema.safeParse('40712345678').success).toBe(false);
    expect(phoneSchema.safeParse('+0712345678').success).toBe(false);
    expect(phoneSchema.safeParse('+40712345678').success).toBe(true);
  });

  it('phoneAcceptsEmptyToClear', () => {
    expect(phoneSchema.safeParse('').success).toBe(true);
  });

  it('supportMessageBounds', () => {
    expect(supportMessageSchema.safeParse('a'.repeat(9)).success).toBe(false);
    expect(supportMessageSchema.safeParse('a'.repeat(10)).success).toBe(true);
    expect(supportMessageSchema.safeParse('a'.repeat(4000)).success).toBe(true);
    expect(supportMessageSchema.safeParse('a'.repeat(4001)).success).toBe(false);
  });
});
