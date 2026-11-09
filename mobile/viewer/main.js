/* Runs inside the WebView. Bundled with three.js into one HTML file by scripts/build-viewer.mjs.
 *
 * Looks ported from the approved preview (project/components/CarViewer/preview.html): lighting,
 * camera, materials, turntable and colours. The colour chips, hint and status text are native UI.
 *
 * Native -> viewer: {type:'setColor',hex} {type:'pause'} {type:'resume'} {type:'setReduceMotion',value}
 * Viewer -> native: {type:'ready'} {type:'error'} {type:'fps',value}
 */
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* Replaced at build time by esbuild `define` (see scripts/build-viewer.mjs). */
/* global __GLB_BASE64__, __DRACO_WRAPPER__, __DRACO_WASM_BASE64__ */

const MAX_PIXEL_RATIO = 2;
const AUTO_SPIN_PER_SECOND = 0.24; // 0.004 rad per frame at 60 fps in the preview
const HEX = /^#[0-9a-f]{6}$/i;

function post(message) {
  const bridge = window.ReactNativeWebView;
  if (bridge) bridge.postMessage(JSON.stringify(message));
}

function fail() {
  post({ type: 'error' });
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

window.addEventListener('error', fail);
window.addEventListener('unhandledrejection', fail);

const host = document.getElementById('stage');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
} catch {
  fail();
  throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
renderer.setSize(host.clientWidth, host.clientHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled = true;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(36, host.clientWidth / host.clientHeight, 0.1, 100);

// The preview's camera (0, 1.5, 8.4) suits a wide stage; back off on narrow ones so the car fits.
function frameCamera() {
  const distance = 8.4 * Math.max(1, 1.15 / camera.aspect);
  camera.position.set(0, 1.5 * (distance / 8.4), distance);
  camera.lookAt(0, 0.7, 0);
}
frameCamera();

// soft key + green rim lights
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(4, 7, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);
const rimA = new THREE.PointLight(0x22e58f, 9, 14);
rimA.position.set(-4.5, 1.2, -3);
scene.add(rimA);
const rimB = new THREE.PointLight(0x22e58f, 5, 12);
rimB.position.set(4.5, 0.8, -4);
scene.add(rimB);

// turntable: dark disc + green rings + contact shadow
const floor = new THREE.Group();
const disc = new THREE.Mesh(
  new THREE.CircleGeometry(3.9, 96),
  new THREE.MeshStandardMaterial({ color: 0x0a110d, roughness: 0.55, metalness: 0.3 }),
);
disc.rotation.x = -Math.PI / 2;
disc.receiveShadow = true;
floor.add(disc);
[
  [3.9, 0.035, 0.85],
  [4.4, 0.012, 0.3],
].forEach(([radius, width, opacity]) => {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius, radius + width, 128),
    new THREE.MeshBasicMaterial({ color: 0x22e58f, transparent: true, opacity, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  floor.add(ring);
});
scene.add(floor);

const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = 128;
shadowCanvas.height = 128;
const shadowContext = shadowCanvas.getContext('2d');
const gradient = shadowContext.createRadialGradient(64, 64, 8, 64, 64, 64);
gradient.addColorStop(0, 'rgba(0,0,0,.85)');
gradient.addColorStop(1, 'rgba(0,0,0,0)');
shadowContext.fillStyle = gradient;
shadowContext.fillRect(0, 0, 128, 128);
const blob = new THREE.Mesh(
  new THREE.PlaneGeometry(7, 3.6),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }),
);
blob.rotation.x = -Math.PI / 2;
blob.position.y = 0.012;
scene.add(blob);

// materials (tintable body, clearcoat paint)
const body = new THREE.MeshPhysicalMaterial({
  color: 0x0f1a15,
  metalness: 1,
  roughness: 0.45,
  clearcoat: 1,
  clearcoatRoughness: 0.03,
});
const detail = new THREE.MeshStandardMaterial({ color: 0xe9eeeb, metalness: 1, roughness: 0.5 });
const glass = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  metalness: 0,
  roughness: 0.1,
  transmission: 1,
  transparent: true,
});

const group = new THREE.Group();
scene.add(group);

// Everything is inlined: blob URLs stand in for the Draco files the loader would fetch.
const blobUrls = {
  'draco_wasm_wrapper.js': URL.createObjectURL(new Blob([__DRACO_WRAPPER__], { type: 'text/javascript' })),
  'draco_decoder.wasm': URL.createObjectURL(new Blob([base64ToBytes(__DRACO_WASM_BASE64__)], { type: 'application/wasm' })),
};
const manager = new THREE.LoadingManager();
manager.setURLModifier((url) => {
  const name = url.split('/').pop();
  return blobUrls[name] || url;
});
const dracoLoader = new DRACOLoader(manager).setDecoderPath('./');
dracoLoader.setDecoderConfig({ type: 'wasm' });
const loader = new GLTFLoader(manager).setDRACOLoader(dracoLoader);

// drag to rotate with inertia; slow auto-spin until first touch
let dragging = false;
let startX = 0;
let startY = 0;
let lastX = 0;
let horizontal = false;
let velocity = 0;
let auto = true;
let reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
group.rotation.y = -0.65;

// Only horizontal drags rotate. The canvas has touch-action: pan-y, so a vertical drag is taken
// by the page (pointercancel) and scrolls the screen behind the WebView.
const element = renderer.domElement;
element.addEventListener('pointerdown', (event) => {
  dragging = true;
  horizontal = false;
  auto = false;
  startX = event.clientX;
  startY = event.clientY;
  lastX = event.clientX;
  velocity = 0;
  element.setPointerCapture(event.pointerId);
});
element.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  if (!horizontal) {
    const dx = Math.abs(event.clientX - startX);
    const dy = Math.abs(event.clientY - startY);
    if (dx < 6 && dy < 6) return;
    if (dy > dx) return;
    horizontal = true;
  }
  velocity = (event.clientX - lastX) * 0.01;
  lastX = event.clientX;
  group.rotation.y += velocity;
});
['pointerup', 'pointercancel'].forEach((type) =>
  element.addEventListener(type, () => {
    dragging = false;
  }),
);

function resize() {
  const width = host.clientWidth;
  const height = host.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  frameCamera();
}
new ResizeObserver(resize).observe(host);

// render loop: stopped entirely while paused
let last = 0;
let frames = 0;
let fpsSince = 0;

function frame(now) {
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
  last = now;
  if (!dragging) {
    velocity *= Math.pow(0.94, dt * 60);
    group.rotation.y += velocity;
    if (auto && !reduceMotion) group.rotation.y += AUTO_SPIN_PER_SECOND * dt;
  }
  renderer.render(scene, camera);

  frames += 1;
  if (!fpsSince) fpsSince = now;
  if (now - fpsSince >= 1000) {
    post({ type: 'fps', value: Math.round((frames * 1000) / (now - fpsSince)) });
    frames = 0;
    fpsSince = now;
  }
}

function run() {
  last = 0;
  frames = 0;
  fpsSince = 0;
  renderer.setAnimationLoop(frame);
}

function pause() {
  renderer.setAnimationLoop(null);
}

function onNativeMessage(event) {
  let message;
  try {
    message = JSON.parse(event.data);
  } catch {
    return;
  }
  if (!message || typeof message !== 'object') return;
  if (message.type === 'setColor' && HEX.test(message.hex)) {
    body.color.set(message.hex);
    renderer.render(scene, camera); // repaint even while paused
  } else if (message.type === 'pause') {
    pause();
  } else if (message.type === 'resume') {
    run();
  } else if (message.type === 'setReduceMotion') {
    reduceMotion = message.value === true;
  }
}
// iOS delivers to window, Android to document; every handler is idempotent.
window.addEventListener('message', onNativeMessage);
document.addEventListener('message', onNativeMessage);

try {
  const glb = base64ToBytes(__GLB_BASE64__).buffer;
  loader.parse(
    glb,
    '',
    (gltf) => {
      const car = gltf.scene.children[0];
      const set = (name, material) => {
        const object = car.getObjectByName(name);
        if (object) object.material = material;
      };
      set('body', body);
      ['rim_fl', 'rim_fr', 'rim_rr', 'rim_rl', 'trim'].forEach((name) => set(name, detail));
      set('glass', glass);
      car.traverse((object) => {
        if (object.isMesh) object.castShadow = true;
      });
      // fit: centre, ground, scale to ~5.6 units long
      const box = new THREE.Box3().setFromObject(car);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      car.scale.multiplyScalar(5.6 / Math.max(size.x, size.z));
      box.setFromObject(car);
      box.getCenter(centre);
      car.position.sub(new THREE.Vector3(centre.x, box.min.y, centre.z));
      group.add(car);
      renderer.render(scene, camera);
      post({ type: 'ready' });
    },
    fail,
  );
} catch {
  fail();
}
// Start running; native sends pause straight away if the screen is not in view.
run();
