import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppBar, Card, Icon, Screen, Text, tokens } from '@/shared/design';
import { useStrings } from '@/shared/i18n';
import { useBack } from '@/shared/navigation/useBack';

import { packages, texts, type LicensedPackage } from '../model/licenses';

function PackageRow({ pkg }: { pkg: LicensedPackage }) {
  const s = useStrings();
  const [open, setOpen] = useState(false);
  const text = pkg.textId ? texts[pkg.textId] : undefined;
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${pkg.name} ${pkg.version}`}
        accessibilityHint={s.acknowledgements.expand(pkg.name)}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-3'] }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="title">{pkg.name}</Text>
          <Text variant="caption" color="ink-muted">
            {`${s.acknowledgements.version(pkg.version)} · ${pkg.license}`}
          </Text>
        </View>
        <Icon name="chevron" size={18} color="ink-muted" />
      </Pressable>
      {open ? (
        <View style={{ gap: tokens.space['space-2'] }}>
          <Text variant="label">{`${s.acknowledgements.license}: ${pkg.license}`}</Text>
          {pkg.repository ? (
            <Text variant="caption" color="ink-muted" selectable>
              {pkg.repository}
            </Text>
          ) : null}
          <Text variant="caption" selectable>
            {text ?? s.acknowledgements.noText}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

/** Account > Acknowledgements: the open-source packages the app ships with, from the generated licence file. */
export function AcknowledgementsScreen() {
  const s = useStrings();
  const back = useBack('/account');
  return (
    <Screen scroll header={<AppBar onBack={back} title={s.acknowledgements.title} />}>
      <Text color="ink-muted">{s.acknowledgements.intro}</Text>
      {packages.map((pkg) => (
        <PackageRow key={pkg.name} pkg={pkg} />
      ))}
    </Screen>
  );
}
