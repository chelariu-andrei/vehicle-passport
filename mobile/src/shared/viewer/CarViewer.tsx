import { Asset } from 'expo-asset';
import { useCallback, useEffect, useRef, useState, type ComponentProps, type Ref } from 'react';
import { AccessibilityInfo, AppState, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { CAR_VIEWER_ENABLED } from './config';
import { StagePlaceholder } from './StagePlaceholder';

type WebViewHandle = { postMessage: (message: string) => void };
// The package types WebView as a plain function component, so its ref is not in the props.
const RefWebView = WebView as unknown as (props: ComponentProps<typeof WebView> & { ref?: Ref<WebViewHandle> }) => React.JSX.Element;

const viewerModule = require('../../../assets/viewer/viewer.html') as number;

type Props = {
  color: string;
  /** False while the screen is not the one being looked at (tab or stack focus). */
  active: boolean;
  onFps?: (fps: number) => void;
};

type FromViewer = { type: 'ready' } | { type: 'error' } | { type: 'fps'; value: number };

function parse(data: string): FromViewer | null {
  try {
    const message = JSON.parse(data) as FromViewer;
    return typeof message === 'object' && message !== null ? message : null;
  } catch {
    return null;
  }
}

export function CarViewer(props: Props) {
  // The disabled branch mounts nothing, so the hooks below never run for it.
  if (!CAR_VIEWER_ENABLED) return <StagePlaceholder />;
  return <Viewer {...props} />;
}

function Viewer({ color, active, onFps }: Props) {
  const webView = useRef<WebViewHandle>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let live = true;
    Asset.fromModule(viewerModule)
      .downloadAsync()
      .then((asset) => {
        if (live) setUri(asset.localUri ?? asset.uri);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  // Screen focus does not change when the app is backgrounded, so watch AppState too.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (live) setReduceMotion(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  const send = useCallback((message: object) => webView.current?.postMessage(JSON.stringify(message)), []);
  const running = active && foreground;

  // Each effect also runs when `ready` flips, which pushes the current state to a freshly loaded page.
  useEffect(() => {
    if (ready) send({ type: 'setColor', hex: color });
  }, [ready, color, send]);
  useEffect(() => {
    if (ready) send({ type: 'setReduceMotion', value: reduceMotion });
  }, [ready, reduceMotion, send]);
  useEffect(() => {
    if (ready) send({ type: running ? 'resume' : 'pause' });
  }, [ready, running, send]);

  const onMessage = (event: WebViewMessageEvent) => {
    const message = parse(event.nativeEvent.data);
    if (!message) return;
    if (message.type === 'ready') {
      setFailed(false);
      setReady(true);
    } else if (message.type === 'error') {
      setFailed(true);
      setReady(false);
    } else if (message.type === 'fps' && typeof message.value === 'number') {
      onFps?.(message.value);
    }
  };

  const showPlaceholder = !ready || failed;
  return (
    <View style={{ flex: 1 }}>
      {uri && !failed ? (
        <RefWebView
          ref={webView}
          testID="car-webview"
          source={{ uri }}
          originWhitelist={['file://*', 'http://*', 'https://*']}
          allowFileAccess
          allowingReadAccessToURL={uri}
          javaScriptEnabled
          onMessage={onMessage}
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      {showPlaceholder ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
          <StagePlaceholder />
        </View>
      ) : null}
    </View>
  );
}
