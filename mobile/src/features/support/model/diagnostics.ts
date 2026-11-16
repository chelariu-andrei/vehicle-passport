import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import type { components } from '@/shared/api/generated/schema';

export type Diagnostics = components['schemas']['SupportDiagnostics'];

/** The only fields ever sent as diagnostics; the screen lists these same keys under the switch. */
export const DIAGNOSTIC_FIELDS = ['appVersion', 'platform', 'osVersion', 'deviceModel'] as const satisfies readonly (keyof Diagnostics)[];

/** What this phone reports about itself. Unavailable values travel as "unknown" rather than being left out. */
export function collectDiagnostics(): Diagnostics {
  return {
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    platform: Platform.OS,
    osVersion: Device.osVersion ?? String(Platform.Version),
    deviceModel: Device.modelName ?? 'unknown',
  };
}
