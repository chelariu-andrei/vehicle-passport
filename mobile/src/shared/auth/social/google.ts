/* Sign in with Google. */
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

let configured = false;

function configure(): void {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  configured = true;
}

/** Resolves null when the person cancelled. Throws for any other failure. */
export async function getGoogleCredential(): Promise<{ idToken: string } | null> {
  configure();
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
