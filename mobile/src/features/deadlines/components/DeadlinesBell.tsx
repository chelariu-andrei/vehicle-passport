import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { CountBadge, Icon } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useDeadlines } from '../api/useDeadlines';

/** The bell in the car header. The count is the documents that are expiring or expired; while the status loads or fails there is no badge, never a guess. */
export function DeadlinesBell({ vin }: { vin: string }) {
  const router = useRouter();
  const { data } = useDeadlines(vin);
  const items = data?.items;
  const attention = items ? items.filter((i) => i.status === 'EXPIRING' || i.status === 'EXPIRED') : [];
  const expired = attention.some((i) => i.status === 'EXPIRED');
  return (
    <Pressable
      testID="deadlines-bell"
      accessibilityRole="button"
      accessibilityLabel={en.deadlines.bellLabel}
      accessibilityValue={items ? { text: en.deadlines.bellValue(attention.length) } : undefined}
      onPress={() => router.push(`/vehicles/${vin}/deadlines`)}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="bell" />
      <View style={{ position: 'absolute', top: 4, right: 2 }}>
        <CountBadge testID="deadlines-badge" count={attention.length} tone={expired ? 'bad' : 'warn'} />
      </View>
    </Pressable>
  );
}
