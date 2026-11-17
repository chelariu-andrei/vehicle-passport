import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useSession } from '@/shared/auth/session';

import { routeForNotification } from './routeForNotification';

/** Each tap is followed once, even when the app shell mounts again and the cold-start response is still reported. */
const followed = new Set<string>();

/**
 * Opens the Document status screen of the car a tapped reminder is about: taps while the app runs, and the tap that
 * started it. Signed out, a tap goes nowhere and the person stays on sign-in, like any other link into the app.
 */
export function useNotificationTap(): void {
  const { status } = useSession();
  const signedIn = useRef(status === 'signedIn');
  useEffect(() => {
    signedIn.current = status === 'signedIn';
  }, [status]);

  useEffect(() => {
    const follow = (response: Notifications.NotificationResponse | null) => {
      if (!response || !signedIn.current) return;
      const id = response.notification.request.identifier;
      if (followed.has(id)) return;
      followed.add(id);
      const route = routeForNotification(response.notification.request.content.data);
      if (route) router.push(route as Href);
    };
    follow(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(follow);
    return () => subscription.remove();
  }, []);
}
