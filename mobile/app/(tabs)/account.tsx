import { Screen, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';

export default function AccountScreen() {
  return (
    <Screen>
      <Text variant="display">{en.tabs.account}</Text>
    </Screen>
  );
}
