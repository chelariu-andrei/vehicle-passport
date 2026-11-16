import { AppBar, Screen } from '@/shared/design';
import { useLocale, useStrings, type LanguagePreference } from '@/shared/i18n';
import { useBack } from '@/shared/navigation/useBack';

import { useUpdateSettings } from '../api/useSettings';
import { OptionGroup } from './OptionGroup';

/** Account > Language. The app switches at once from the phone's own choice; the account's copy follows when it can. */
export function LanguageScreen() {
  const s = useStrings().settings.language;
  const back = useBack('/account');
  const { preference, setPreference } = useLocale();
  const { change } = useUpdateSettings();
  const choose = (language: LanguagePreference) => {
    setPreference(language);
    change((current) => ({ ...current, language }));
  };
  return (
    <Screen scroll header={<AppBar onBack={back} title={s.title} />}>
      <OptionGroup
        title={s.title}
        value={preference}
        onChange={choose}
        options={[
          { value: 'system', label: s.system },
          { value: 'ro', label: s.ro },
          { value: 'en', label: s.en },
        ]}
      />
    </Screen>
  );
}
