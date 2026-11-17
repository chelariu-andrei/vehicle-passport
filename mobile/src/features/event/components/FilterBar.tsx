import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { Button, FilterChip, Icon, SelectSheet, Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { useStrings } from '@/shared/i18n';

import { COMPONENT_CONFIG, COMPONENTS } from '../model/components';
import { formatLocalDate } from '../model/eventForm';
import { EVENT_TYPE_CONFIG, EVENT_TYPES } from '../model/eventTypes';
import { activeCount, EMPTY_FILTERS, PERIOD_PRESETS, periodPreset, setPeriod, type TimelineFilters } from '../model/timelineFilters';
import { formatDate } from '../model/validity';
import { DateField } from './DateField';

type Sheet = 'type' | 'component' | 'period' | null;

const TYPE_OPTIONS = EVENT_TYPES.map((value) => ({ value, label: EVENT_TYPE_CONFIG[value].label(), icon: EVENT_TYPE_CONFIG[value].icon }));
const COMPONENT_OPTIONS = COMPONENTS.map((value) => ({ value, label: COMPONENT_CONFIG[value].label(), icon: COMPONENT_CONFIG[value].icon }));

/** The Period chip's badge: the range of a period chosen here. A year chip's period shows on the year chip instead. */
function periodBadge(f: TimelineFilters, t: ReturnType<typeof useStrings>['timeline']): string | undefined {
  if (f.year !== null) return undefined;
  if (f.from !== null && f.to !== null) return t.range(formatDate(f.from), formatDate(f.to));
  if (f.from !== null) return t.since(formatDate(f.from));
  if (f.to !== null) return t.until(formatDate(f.to));
  return undefined;
}

/** Presets and a custom from/to. Choosing applies at once and closes; the custom period applies with its button. */
function PeriodSheet({ visible, filters, onChange, onClose }: { visible: boolean; filters: TimelineFilters; onChange: (f: TimelineFilters) => void; onClose: () => void }) {
  const { colors, scheme } = useTheme();
  const t = useStrings().timeline;
  const [from, setFrom] = useState(filters.year === null ? (filters.from ?? '') : '');
  const [to, setTo] = useState(filters.year === null ? (filters.to ?? '') : '');
  const today = formatLocalDate(new Date());
  const inverted = from !== '' && to !== '' && from > to;
  const apply = (next: { from: string | null; to: string | null }) => {
    onChange(setPeriod(filters, next.from, next.to));
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim }}>
        <Pressable accessibilityLabel={en.common.dismiss} style={{ flex: 1 }} onPress={onClose} />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '85%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: tokens.radius['radius-lg'],
            borderTopRightRadius: tokens.radius['radius-lg'],
            padding: tokens.space['space-5'],
            gap: tokens.space['space-4'],
            boxShadow: tokens.shadow[scheme]['shadow-card'],
          }}
        >
          <Text variant="title-lg" accessibilityRole="header">
            {t.period}
          </Text>
          <ScrollView contentContainerStyle={{ gap: tokens.space['space-4'] }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
              {PERIOD_PRESETS.map((preset) => {
                const bounds = periodPreset(preset, today);
                const active = filters.year === null && filters.from === bounds.from && filters.to === bounds.to;
                return <FilterChip key={preset} label={t.preset[preset]} active={active} onPress={() => apply(bounds)} />;
              })}
            </View>
            <Text variant="label" color="ink-muted">
              {t.preset.CUSTOM}
            </Text>
            <DateField
              label={t.from}
              accessibilityLabel={en.event.chooseDateFor(t.from, from)}
              testID="timeline-period-from"
              value={from}
              maxDate={today}
              onChange={setFrom}
              onClear={() => setFrom('')}
            />
            <DateField
              label={t.to}
              accessibilityLabel={en.event.chooseDateFor(t.to, to)}
              testID="timeline-period-to"
              value={to}
              onChange={setTo}
              onClear={() => setTo('')}
              error={inverted ? en.event.invalidPeriod : undefined}
            />
            <Button
              title={t.apply}
              disabled={inverted || (from === '' && to === '')}
              onPress={() => apply({ from: from === '' ? null : from, to: to === '' ? null : to })}
            />
          </ScrollView>
          <Button kind="quiet" title={en.common.done} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/** Type, Component and Period chips, each opening its sheet, and "Clear" while anything is on. Active chips carry a count or the range. */
export function FilterBar({ filters, onChange }: { filters: TimelineFilters; onChange: (f: TimelineFilters) => void }) {
  const t = useStrings().timeline;
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = () => setSheet(null);
  const period = periodBadge(filters, t);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-2'] }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: tokens.space['space-2'], paddingVertical: tokens.space['space-1'] }}>
        <FilterChip
          label={t.type}
          active={filters.types.length > 0}
          badge={filters.types.length > 0 ? String(filters.types.length) : undefined}
          onPress={() => setSheet('type')}
        />
        <FilterChip
          label={t.component}
          active={filters.components.length > 0}
          badge={filters.components.length > 0 ? String(filters.components.length) : undefined}
          onPress={() => setSheet('component')}
        />
        <FilterChip label={t.period} active={period !== undefined} badge={period} onPress={() => setSheet('period')} />
      </ScrollView>
      {activeCount(filters) > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.clear}
          onPress={() => onChange(EMPTY_FILTERS)}
          hitSlop={8}
          style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-1'] }}
        >
          <Icon name="close" size={16} color="brand" />
          <Text variant="label" color="brand">
            {t.clear}
          </Text>
        </Pressable>
      ) : null}
      <SelectSheet
        visible={sheet === 'type'}
        title={t.type}
        options={TYPE_OPTIONS}
        selected={filters.types}
        multiple
        onChange={(types) => onChange({ ...filters, types })}
        onClose={close}
      />
      <SelectSheet
        visible={sheet === 'component'}
        title={t.component}
        options={COMPONENT_OPTIONS}
        selected={filters.components}
        multiple
        onChange={(components) => onChange({ ...filters, components })}
        onClose={close}
      />
      {/* Mounted only while open, so it starts from the period in force each time. */}
      {sheet === 'period' ? <PeriodSheet visible filters={filters} onChange={onChange} onClose={close} /> : null}
    </View>
  );
}
