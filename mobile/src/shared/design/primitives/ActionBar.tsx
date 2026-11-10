import { View } from 'react-native';

import { tokens } from '../tokens.generated';
import { Button } from './Button';

type Props = {
  primary: { title: string; onPress: () => void; loading?: boolean; disabled?: boolean };
  quiet?: { title: string; onPress: () => void; danger?: boolean };
};

/** The bar pinned to the bottom of a screen: one primary action and at most one quiet action. */
export function ActionBar({ primary, quiet }: Props) {
  return (
    <View
      style={{
        paddingHorizontal: tokens.space['space-4'],
        paddingTop: tokens.space['space-3'],
        gap: tokens.space['space-1'],
      }}
    >
      <Button
        title={primary.title}
        onPress={primary.onPress}
        loading={primary.loading}
        disabled={primary.disabled}
      />
      {quiet ? (
        <Button kind="quiet" title={quiet.title} onPress={quiet.onPress} danger={quiet.danger} />
      ) : null}
    </View>
  );
}
