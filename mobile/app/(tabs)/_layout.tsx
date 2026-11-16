import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/shared/design';
import { useT } from '@/shared/i18n';

export default function TabsLayout() {
  const { colors } = useTheme();
  const t = useT();
  return (
    <NativeTabs
      tintColor={colors.brand}
      backgroundColor={colors.surface}
      iconColor={colors['ink-muted']}
      labelStyle={{ color: colors['ink-muted'] }}
      indicatorColor={colors['surface-raised']}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.car')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="car.fill" md="directions_car" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scans">
        <NativeTabs.Trigger.Label>{t('tabs.scans')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="doc.viewfinder" md="document_scanner" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="passports">
        <NativeTabs.Trigger.Label>{t('tabs.passports')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="doc.text.fill" md="description" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>{t('tabs.account')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
