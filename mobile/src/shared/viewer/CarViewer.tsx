import { Asset } from 'expo-asset';
import { useCallback, useEffect, useRef, useState, type ComponentProps, type Ref } from 'react';
import { AccessibilityInfo, AppState, View, useWindowDimensions } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { useTheme } from '@/shared/design';

import { CarSilhouette } from './CarSilhouette';
import { CAR_VIEWER_ENABLED } from './config';
import type { Look } from './look';

type WebViewHandle = { postMessage: (message: string) => void };
// The package types WebView as a plain function component, so its ref is not in the props.
const RefWebView = WebView as unknown as (props: ComponentProps<typeof WebView> & { ref?: Ref<WebViewHandle> }) => React.JSX.Element;

const viewerModule = require('../../../assets/viewer/viewer.html') as number;

type Props = {
  look: Look;
  /** Which side the car turns to; the stage eases there (or cuts, under Reduce Motion). */
  view?: 'front' | 'side' | 'rear' | 'top';
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

const SILHOUETTE_SHARE = 0.7;

/** The silhouette centred in its stage, at 70% of the stage width. */
function Silhouette({ look }: { look: Look }) {
  const [width, setWidth] = useState(useWindowDimensions().width);
  return (
    <View
      pointerEvents="none"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <CarSilhouette look={look} width={width * SILHOUETTE_SHARE} />
    </View>
  );
}

export function CarViewer(props: Props) {
  // The disabled branch mounts nothing, so the hooks below never run for it.
  if (!CAR_VIEWER_ENABLED) return <Silhouette look={props.look} />;
  return <Viewer {...props} />;
}

function Viewer({ look, view, active, onFps }: Props) {
  const { colors } = useTheme();
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
    if (ready) send({ type: 'setLook', look });
  }, [ready, look, send]);
  useEffect(() => {
    if (ready && view) send({ type: 'turnTo', view });
  }, [ready, view, send]);
  useEffect(() => {
    if (ready) send({ type: 'setColors', floor: colors.bg, tick: colors['ink-muted'], mark: colors.brand });
  }, [ready, colors, send]);
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

  const showSilhouette = !ready || failed;
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
      {showSilhouette ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
          <Silhouette look={look} />
        </View>
      ) : null}
    </View>
  );
}
