import { Modal, Pressable, ScrollView, View } from 'react-native';

import { en } from '../../i18n/en';
import { useTheme } from '../theme';
import { tokens } from '../tokens.generated';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const ROW_MIN_HEIGHT = 48;

type Props<T extends string> = {
  visible: boolean;
  title: string;
  options: { value: T; label: string; icon?: IconName }[];
  selected: T[];
  /** Several values can be on at once; otherwise choosing replaces the value. */
  multiple: boolean;
  onChange: (next: T[]) => void;
  onClose: () => void;
};

/** A bottom sheet of checkbox rows. */
export function SelectSheet<T extends string>({ visible, title, options, selected, multiple, onChange, onClose }: Props<T>) {
  const { colors, scheme } = useTheme();
  const choose = (value: T) => {
    if (!multiple) return onChange([value]);
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim }}>
        <Pressable accessibilityLabel={en.common.dismiss} style={{ flex: 1 }} onPress={onClose} />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '80%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: tokens.radius['radius-lg'],
            borderTopRightRadius: tokens.radius['radius-lg'],
            padding: tokens.space['space-5'],
            gap: tokens.space['space-4'],
            boxShadow: tokens.shadow[scheme]['shadow-card'],
          }}
        >
          <Text variant="title-lg" accessibilityRole="header">
            {title}
          </Text>
          <ScrollView>
            {options.map((o) => {
              const checked = selected.includes(o.value);
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="checkbox"
                  accessibilityLabel={o.label}
                  accessibilityState={{ checked }}
                  onPress={() => choose(o.value)}
                  style={{ minHeight: ROW_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-3'] }}
                >
                  {o.icon ? <Icon name={o.icon} color="ink-muted" /> : null}
                  <Text variant="body-lg" style={{ flex: 1 }}>
                    {o.label}
                  </Text>
                  <View
                    style={{
                      width: tokens.space['space-6'],
                      height: tokens.space['space-6'],
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: tokens.radius['radius-sm'] / 2,
                      borderWidth: 1,
                      borderColor: checked ? colors.brand : colors['line-strong'],
                      backgroundColor: checked ? colors.brand : 'transparent',
                    }}
                  >
                    {checked ? <Icon name="check" size={16} color="on-brand" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <Button kind="quiet" title={en.common.done} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
