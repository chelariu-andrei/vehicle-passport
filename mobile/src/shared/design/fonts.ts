import { Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold } from '@expo-google-fonts/figtree';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';

import type { TypeVariant } from './tokens.generated';
import { tokens } from './tokens.generated';

/** Passed to useFonts in the root layout. */
export const fontAssets = {
  Sora_700Bold,
  Sora_600SemiBold,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  JetBrainsMono_500Medium,
};

// React Native needs one family name per weight. Weight 650 has no file, so it uses 600.
const familyByWeight: Record<string, Record<number, string>> = {
  display: { 700: 'Sora_700Bold', 600: 'Sora_600SemiBold' },
  sans: { 400: 'Figtree_400Regular', 500: 'Figtree_500Medium', 650: 'Figtree_600SemiBold' },
  mono: { 500: 'JetBrainsMono_500Medium' },
};

export function fontFamilyFor(variant: TypeVariant): string {
  const { family, fontWeight } = tokens.type[variant];
  return familyByWeight[family][fontWeight];
}
