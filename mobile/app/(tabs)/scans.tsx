import { Screen, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';

export default function ScansScreen() {
  return (
    <Screen>
      <Text variant="display">{en.tabs.scans}</Text>
    </Screen>
  );
}
