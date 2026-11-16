import { View } from 'react-native';

import { tokens } from '@/shared/design';
import { useStrings } from '@/shared/i18n';

import { useUpdateSettings, type Settings } from '../api/useSettings';
import { OptionGroup } from './OptionGroup';
import { SettingsPage } from './SettingsPage';

type Units = Settings['units'];

function Form({ settings }: { settings: Settings }) {
  const s = useStrings().settings.units;
  const { change } = useUpdateSettings();
  const set = (patch: Partial<Units>) => change((current) => ({ ...current, units: { ...current.units, ...patch } }));
  return (
    <View style={{ gap: tokens.space['space-5'] }}>
      <OptionGroup
        title={s.distanceGroup}
        value={settings.units.distance}
        onChange={(distance) => set({ distance })}
        options={[
          { value: 'km', label: s.km },
          { value: 'mi', label: s.mi },
        ]}
      />
      <OptionGroup
        title={s.currencyGroup}
        value={settings.units.currency}
        onChange={(currency) => set({ currency })}
        options={[
          { value: 'RON', label: s.RON },
          { value: 'EUR', label: s.EUR },
          { value: 'USD', label: s.USD },
        ]}
      />
    </View>
  );
}

/** Account > Units: distance and currency. */
export function UnitsScreen() {
  const s = useStrings();
  return <SettingsPage title={s.settings.units.title}>{(settings) => <Form settings={settings} />}</SettingsPage>;
}
