import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Modal, StyleSheet, View } from "react-native";

import { useSession } from "@/shared/auth/session";
import { Button, Ground, Icon, Text, tokens } from "@/shared/design";
import { useStrings } from "@/shared/i18n";

import {
  appLock,
  authenticate,
  checkingIdentity,
  shouldLock,
  useAppLock,
} from "../model/appLock";

/**
 * Opaque, above everything: nothing of the app shows or can be touched until it is unlocked. It is a Modal of its own, because a
 * sheet or a native-stack modal that was open when the app went away is presented above the root view and would stay reachable.
 */
function LockScreen({ ready }: { ready: boolean }) {
  const s = useStrings();
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  const unlock = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const ok = await authenticate(s.security.promptMessage);
      setFailed(!ok);
      if (ok) appLock.setLocked(false);
    } finally {
      busy.current = false;
    }
  }, [s]);

  // The prompt opens by itself; Unlock is there for when it was dismissed.
  useEffect(() => {
    if (ready) void unlock();
    // Only when the lock screen appears, not whenever the language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <Modal
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        <Ground>
          {ready ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: tokens.space["space-4"],
                padding: tokens.space["space-6"],
              }}
            >
              <Icon name="shield" size={40} color="brand" />
              <Text
                variant="title-lg"
                accessibilityRole="header"
                style={{ textAlign: "center" }}
              >
                {s.appLock.title}
              </Text>
              <Text color="ink-muted" style={{ textAlign: "center" }}>
                {s.appLock.body}
              </Text>
              {failed ? (
                <Text
                  accessibilityRole="alert"
                  color="danger"
                  style={{ textAlign: "center" }}
                >
                  {s.appLock.failed}
                </Text>
              ) : null}
              <Button title={s.appLock.unlock} onPress={() => void unlock()} />
            </View>
          ) : null}
        </Ground>
      </View>
    </Modal>
  );
}

/**
 * Wraps the app. When the lock is on and the person has been away for longer than the timeout (or the app has just started),
 * a lock screen covers everything and the app underneath is hidden from screen readers.
 */
export function AppLockBoundary({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const { enabled, timeout, locked, loaded } = useAppLock();
  const signedIn = status === "signedIn";
  const timeoutRef = useRef(timeout);
  const activeRef = useRef(false);
  const leftAt = useRef<number | null>(null);

  const armed = enabled && signedIn;
  useEffect(() => {
    timeoutRef.current = timeout;
    activeRef.current = armed;
  }, [timeout, armed]);

  useEffect(() => {
    // Whoever signs in next is not behind the previous person's lock.
    if (status === "signedOut" && locked) appLock.setLocked(false);
  }, [status, locked]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        const away = leftAt.current;
        leftAt.current = null;
        // The system's own prompt (Face ID) also passes through "inactive"; it is not leaving the app.
        if (
          activeRef.current &&
          !checkingIdentity() &&
          shouldLock(away, Date.now(), timeoutRef.current)
        )
          appLock.setLocked(true);
      } else if (leftAt.current === null) {
        leftAt.current = Date.now();
      }
    });
    return () => subscription.remove();
  }, []);

  // Until the saved settings are read, a signed-in app stays covered rather than flashing open.
  const covered = signedIn && (!loaded || (enabled && locked));
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        accessibilityElementsHidden={covered}
        importantForAccessibility={covered ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      {covered ? <LockScreen ready={loaded} /> : null}
    </View>
  );
}
