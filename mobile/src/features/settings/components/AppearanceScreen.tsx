import { AppBar, Screen, useTheme, type Preference } from '@/shared/design';
import { useStrings } from '@/shared/i18n';
import { useBack } from '@/shared/navigation/useBack';

import { useUpdateSettings } from '../api/useSettings';
import { OptionGroup } from './OptionGroup';

/** Account > Appearance. The phone's own preference applies at once (offline too); the account's copy follows when it can. */
export function AppearanceScreen() {
  const s = useStrings();
  const back = useBack('/account');
  const { preference, setPreference } = useTheme();
  const { change } = useUpdateSettings();
  const choose = (appearance: Preference) => {
    setPreference(appearance);
    change((current) => ({ ...current, appearance }));
  };
  return (
    <Screen scroll header={<AppBar onBack={back} title={s.settings.appearance.title} />}>
      <OptionGroup
        title={s.settings.appearance.title}
        value={preference}
        onChange={choose}
        options={[
          { value: 'system', label: s.account.system },
          { value: 'dark', label: s.account.dark },
          { value: 'light', label: s.account.light },
        ]}
      />
    </Screen>
  );
}
