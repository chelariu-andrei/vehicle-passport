import { Screen, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';

export default function PassportsScreen() {
  return (
    <Screen>
      <Text variant="display">{en.tabs.passports}</Text>
    </Screen>
  );
}
