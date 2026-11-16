import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { AppBar, Card, Field, Icon, Screen, Text, tokens } from '@/shared/design';
import { useStrings } from '@/shared/i18n';
import { useBack } from '@/shared/navigation/useBack';

import { packages, texts, type LicensedPackage } from '../model/licenses';

function PackageRow({ pkg }: { pkg: LicensedPackage }) {
  const s = useStrings();
  const [open, setOpen] = useState(false);
  // The text is only looked up (and rendered) for an expanded row.
  const text = open && pkg.textId ? texts[pkg.textId] : undefined;
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
          {pkg.generatedFrom ? (
            <Text variant="caption" color="ink-muted">
              {s.acknowledgements.generatedNote(pkg.generatedFrom)}
            </Text>
          ) : null}
          {pkg.holderInferred ? (
            <Text variant="caption" color="ink-muted">
              {s.acknowledgements.holderNote}
            </Text>
          ) : null}
          <Text variant="caption" selectable>
            {text ?? (pkg.textId ? '' : s.acknowledgements.noText)}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

/** Account > Acknowledgements: every open-source package the app ships with, from the generated licence file. */
export function AcknowledgementsScreen() {
  const s = useStrings();
  const back = useBack('/account');
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? packages.filter((pkg) => pkg.name.toLowerCase().includes(needle)) : packages;
  }, [query]);
  return (
    <Screen header={<AppBar onBack={back} title={s.acknowledgements.title} />}>
      <FlatList
        data={shown}
        keyExtractor={(pkg) => `${pkg.name}@${pkg.version}`}
        renderItem={({ item }) => <PackageRow pkg={item} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: tokens.space['space-4'] }}
        initialNumToRender={12}
        windowSize={7}
        ListHeaderComponent={
          <View style={{ gap: tokens.space['space-4'], marginBottom: tokens.space['space-4'] }}>
            <Text color="ink-muted">{s.acknowledgements.intro}</Text>
            <Field label={s.acknowledgements.search} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} />
          </View>
        }
        ListEmptyComponent={<Text color="ink-muted">{s.acknowledgements.none}</Text>}
      />
    </Screen>
  );
}
