import { Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';

/** The body of the claim-filed screen; the screen supplies the bar with "Done". */
export function ClaimFiled() {
  return (
    <>
      <Text variant="display-xl" accessibilityRole="header">
        {en.vehicleForm.filedTitle}
      </Text>
      <Text variant="body-lg">{en.vehicleForm.filedBody}</Text>
    </>
  );
}
