import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { tokens } from '../tokens.generated';
import { Text } from './Text';

const VISIBLE_MS = 4000;
type Listener = (message: string) => void;
const listeners = new Set<Listener>();

/** Shows a short message. Does nothing if no ToastHost is mounted. */
export function toast(message: string): void {
  listeners.forEach((listener) => listener(message));
}

export function ToastHost() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    listeners.add(setMessage);
    return () => {
      listeners.delete(setMessage);
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        left: tokens.space['space-4'],
        right: tokens.space['space-4'],
        bottom: insets.bottom + tokens.space['space-12'] + tokens.space['space-4'],
        padding: tokens.space['space-4'],
        borderRadius: tokens.radius['radius-md'],
        backgroundColor: colors['surface-raised'],
        boxShadow: tokens.shadow[scheme]['shadow-card'],
      }}
    >
      <Text variant="body">{message}</Text>
    </View>
  );
}
