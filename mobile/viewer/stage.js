/* The turntable stage the car stands on: renderer, light, floor, drag-to-rotate.
 * It draws no background of its own, so the app ground shows through.
 *
 *   const stage = createStage(THREE, RoomEnvironment, hostElement, { colors });
 *   stage.setCar(car);            // a car from car-kit.js
 *   stage.turnTo(VIEW.rear);      // eased turn, used when the customiser changes topic
 */

export const VIEW = { front: -0.62, side: 0, rear: Math.PI - 0.62, top: -0.35 };

export function createStage(THREE, RoomEnvironment, host, options = {}) {
  const colors = { floor: '#050706', tick: '#9aaba2', mark: '#22e58f', ...(options.colors || {}) };
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  let fit = 4.7;
  function frame() {
    const aspect = host.clientWidth / Math.max(1, host.clientHeight);
    camera.aspect = aspect;
    const distance = (fit * 1.5 + 1.0) * Math.max(1, 1.5 / aspect);
    camera.position.set(0, 0.2 + distance * 0.17, distance);
    camera.lookAt(0, 0.2, 0);
    camera.updateProjectionMatrix();
  }

  // One soft key from the front, a cool rim from behind, nothing coloured.
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(3.5, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdff3ea, 1.1);
  rim.position.set(-4, 3, -6);
  scene.add(rim);

  // Floor: a polished disc that fades into the ground instead of ending in an edge.
  const fade = document.createElement('canvas');
  fade.width = 256;
  fade.height = 256;
  const fadeContext = fade.getContext('2d');
  const gradient = fadeContext.createRadialGradient(128, 128, 30, 128, 128, 128);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.62, '#ffffff');
  gradient.addColorStop(1, '#000000');
  fadeContext.fillStyle = gradient;
  fadeContext.fillRect(0, 0, 256, 256);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(4.6, 96),
    new THREE.MeshStandardMaterial({ color: colors.floor, roughness: 0.85, metalness: 0, envMapIntensity: 0.05, transparent: true, alphaMap: new THREE.CanvasTexture(fade) }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // The turntable scale: fine ticks that turn with the car, and one fixed index mark.
  const pivot = new THREE.Group();
  scene.add(pivot);
  const tickPoints = [];
  for (let i = 0; i < 120; i += 1) {
    const a = (i / 120) * Math.PI * 2;
    const inner = i % 10 === 0 ? 3.28 : 3.38;
    tickPoints.push(Math.cos(a) * inner, 0.004, Math.sin(a) * inner, Math.cos(a) * 3.46, 0.004, Math.sin(a) * 3.46);
  }
  const tickGeometry = new THREE.BufferGeometry();
  tickGeometry.setAttribute('position', new THREE.Float32BufferAttribute(tickPoints, 3));
  const ticks = new THREE.LineSegments(tickGeometry, new THREE.LineBasicMaterial({ color: colors.tick, transparent: true, opacity: 0.34 }));
  pivot.add(ticks);
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.26), new THREE.MeshBasicMaterial({ color: colors.mark }));
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(0, 0.006, 3.62);
  scene.add(mark);

  let car = null;
  let dragging = false;
  let horizontal = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let velocity = 0;
  let auto = options.autoSpin !== false;
  let target = null;
  let reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let running = false;
  let last = 0;
  pivot.rotation.y = VIEW.front;

  const element = renderer.domElement;
  element.addEventListener('pointerdown', (event) => {
    dragging = true;
    horizontal = false;
    auto = false;
    target = null;
    startX = event.clientX;
    startY = event.clientY;
    lastX = event.clientX;
    velocity = 0;
    element.setPointerCapture(event.pointerId);
    if (options.onTouch) options.onTouch();
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
    pivot.rotation.y += velocity;
  });
  ['pointerup', 'pointercancel'].forEach((type) => element.addEventListener(type, () => {
    dragging = false;
  }));

  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
    last = now;
    if (!dragging) {
      if (target !== null) {
        const gap = target - pivot.rotation.y;
        pivot.rotation.y += gap * (1 - Math.exp(-dt * 7));
        if (Math.abs(gap) < 0.002) target = null;
      } else {
        velocity *= Math.pow(0.94, dt * 60);
        pivot.rotation.y += velocity;
        if (auto && !reduceMotion) pivot.rotation.y += 0.22 * dt;
      }
    }
    renderer.render(scene, camera);
  }

  function resize() {
    if (!host.clientWidth || !host.clientHeight) return;
    renderer.setSize(host.clientWidth, host.clientHeight);
    frame();
    if (!running) renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  frame();

  const stage = {
    scene,
    pivot,
    setCar(next) {
      if (car) pivot.remove(car.group);
      car = next;
      if (car) pivot.add(car.group);
      stage.refit();
    },
    /** Call after the body type changes: longer cars pull the camera back. */
    refit() {
      if (car) fit = car.length;
      frame();
      if (!running) renderer.render(scene, camera);
    },
    /** Ease to a view angle by the shortest way round. Under Reduce Motion it cuts. */
    turnTo(angle) {
      auto = false;
      velocity = 0;
      const turn = Math.PI * 2;
      const current = pivot.rotation.y;
      const next = angle + Math.round((current - angle) / turn) * turn;
      if (reduceMotion) {
        pivot.rotation.y = next;
        target = null;
      } else target = next;
      if (!running) renderer.render(scene, camera);
    },
    /** Recolour the floor, the scale ticks and the index mark (theme change), then draw once. */
    colors(floorColor, tickColor, markColor) {
      floor.material.color.set(floorColor);
      ticks.material.color.set(tickColor);
      mark.material.color.set(markColor);
      renderer.render(scene, camera);
    },
    setReduceMotion(value) {
      reduceMotion = value === true;
    },
    resume() {
      if (running) return;
      running = true;
      last = 0;
      renderer.setAnimationLoop(tick);
    },
    pause() {
      running = false;
      renderer.setAnimationLoop(null);
    },
    render() {
      renderer.render(scene, camera);
    },
    destroy() {
      stage.pause();
      observer.disconnect();
      renderer.dispose();
      element.remove();
    },
  };
  stage.resume();
  return stage;
}
