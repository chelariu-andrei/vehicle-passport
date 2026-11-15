/* Runs inside the WebView. Bundled with three.js into one HTML file by scripts/build-viewer.mjs.
 *
 * The car is built in code (viewer/car-kit.js) and stands on the turntable stage (viewer/stage.js).
 * No model file, no network.
 *
 * Native -> viewer: {type:'setLook',look} {type:'turnTo',view} {type:'setColors',floor,tick,mark}
 *                   {type:'pause'} {type:'resume'} {type:'setReduceMotion',value}
 * Viewer -> native: {type:'ready'} {type:'error'} {type:'fps',value}
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { NEUTRAL_LOOK, createCarKit } from './car-kit.js';
import { VIEW, createStage } from './stage.js';

const HEX = /^#[0-9a-f]{6}$/i;

function post(message) {
  const bridge = window.ReactNativeWebView;
  if (bridge) bridge.postMessage(JSON.stringify(message));
}

function fail() {
  post({ type: 'error' });
}

window.addEventListener('error', fail);
window.addEventListener('unhandledrejection', fail);

let stage;
let car;
try {
  stage = createStage(THREE, RoomEnvironment, document.getElementById('stage'), { autoSpin: true });
  car = createCarKit(THREE).createCar(NEUTRAL_LOOK);
  stage.setCar(car);
} catch {
  fail();
  throw new Error('WebGL unavailable');
}

// fps report: counts rendered frames by wrapping the renderer's loop through requestAnimationFrame timing.
let frames = 0;
let fpsSince = 0;
let counting = true;
function count(now) {
  if (!counting) return;
  frames += 1;
  if (!fpsSince) fpsSince = now;
  if (now - fpsSince >= 1000) {
    post({ type: 'fps', value: Math.round((frames * 1000) / (now - fpsSince)) });
    frames = 0;
    fpsSince = now;
  }
  requestAnimationFrame(count);
}
function startCounting() {
  counting = true;
  frames = 0;
  fpsSince = 0;
  requestAnimationFrame(count);
}
startCounting();

function onNativeMessage(event) {
  let message;
  try {
    message = JSON.parse(event.data);
  } catch {
    return;
  }
  if (!message || typeof message !== 'object') return;
  try {
    if (message.type === 'setLook' && message.look && typeof message.look === 'object') {
      car.apply(message.look);
      stage.refit();
    } else if (message.type === 'turnTo' && Object.prototype.hasOwnProperty.call(VIEW, message.view)) {
      stage.turnTo(VIEW[message.view]);
    } else if (
      message.type === 'setColors' &&
      HEX.test(message.floor) &&
      HEX.test(message.tick) &&
      HEX.test(message.mark)
    ) {
      stage.colors(message.floor, message.tick, message.mark);
    } else if (message.type === 'pause') {
      stage.pause();
      counting = false;
    } else if (message.type === 'resume') {
      stage.resume();
      if (!counting) startCounting();
    } else if (message.type === 'setReduceMotion') {
      stage.setReduceMotion(message.value === true);
    }
  } catch {
    fail();
  }
}
// iOS delivers to window, Android to document; every handler is idempotent.
window.addEventListener('message', onNativeMessage);
document.addEventListener('message', onNativeMessage);

// The stage already rendered once while being built; report ready after the first frame is on screen.
stage.render();
post({ type: 'ready' });
