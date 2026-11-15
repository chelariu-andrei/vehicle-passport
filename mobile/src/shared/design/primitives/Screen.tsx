import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '../tokens.generated';
import { Ground } from './Ground';

type Props = { children: ReactNode; scroll?: boolean; header?: ReactNode; footer?: ReactNode };

export function Screen({ children, scroll = false, header, footer }: Props) {
  const insets = useSafeAreaInsets();
  const padding = { padding: tokens.space['space-4'], gap: tokens.space['space-4'] };
  return (
    <Ground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1, paddingTop: insets.top }}>
          {header}
          {scroll ? (
            <ScrollView testID="screen-scroll" style={{ flex: 1 }} contentContainerStyle={padding} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              {children}
            </ScrollView>
          ) : (
            <View style={[{ flex: 1 }, padding]}>{children}</View>
          )}
        </View>
        {footer ? <View style={{ paddingBottom: Math.max(insets.bottom, tokens.space['space-4']) }}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </Ground>
  );
}
