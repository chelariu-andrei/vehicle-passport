/* Sign in with Google. */
type GoogleModule = typeof import('@react-native-google-signin/google-signin');

/** Loaded on first use: the native module is absent in Expo Go and would crash the app at import time. */
function loadGoogle(): GoogleModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-google-signin/google-signin') as GoogleModule;
  } catch {
    throw new Error('Google sign-in is not available in this build (needs a development build).');
  }
}

let configured = false;

function configure(): void {
  if (configured) return;
  const { GoogleSignin } = loadGoogle();
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  configured = true;
}

/** Resolves null when the person cancelled. Throws for any other failure. */
export async function getGoogleCredential(): Promise<{ idToken: string } | null> {
  configure();
  const { GoogleSignin, statusCodes } = loadGoogle();
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') return null;
    if (!response.data.idToken) throw new Error('Google returned no id token');
    return { idToken: response.data.idToken };
  } catch (error) {
    if ((error as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw error;
  }
}
