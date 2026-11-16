import { View } from 'react-native';

import { useTheme } from '../theme';
import { Text } from './Text';

type Props = { name: string | null; email?: string | null; size?: number };

/** First letters of the first and last word of the name; the email's first letter when there is no name. */
export function initialsOf(name: string | null, email?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const first = Array.from(words[0])[0] ?? '';
    const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? '') : '';
    return (first + last).toUpperCase();
  }
  return (Array.from((email ?? '').trim())[0] ?? '').toUpperCase();
}

/** A round badge with the person's initials. Decorative: the name next to it is what is read. */
export function Avatar({ name, email, size = 56 }: Props) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors['surface-raised'],
        borderWidth: 1,
        borderColor: colors['line-strong'],
      }}
    >
      <Text variant="title" color="brand">
        {initialsOf(name, email)}
      </Text>
    </View>
  );
}
