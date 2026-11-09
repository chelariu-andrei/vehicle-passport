/* The Supabase client and the AuthPort built on it. Tests replace this whole module (test/fakes/auth.ts). */
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { AuthPort } from './authPort';
import { setAuthPort } from './authPort';
import { LargeSecureStore } from './largeSecureStore';

export const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '', {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refreshing in the background wastes battery and fails offline; refresh only while the app is in front.
AppState.addEventListener('change', (state) => {
  if (state === 'active') void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});
void supabase.auth.startAutoRefresh();

const port: AuthPort = {
  getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  refresh: async () => {
    const { data, error } = await supabase.auth.refreshSession();
    // A dropped connection says nothing about the session: fail the request, do not sign out.
    if (error?.name === 'AuthRetryableFetchError') throw error;
    return error ? null : (data.session?.access_token ?? null);
  },
  signOutLocal: async () => {
    await supabase.auth.signOut({ scope: 'local' });
  },
};

setAuthPort(port);
