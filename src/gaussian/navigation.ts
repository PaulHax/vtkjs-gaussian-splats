import {
  cameraDirection,
  cross,
  levelForward,
  normalized,
  rotateCamera,
  translateCamera,
  vector,
  type CameraPose,
  type CameraVector,
  type NavigationMode,
} from "../cameraNavigation";

export type NavigationOptions = {
  readonly viewer: HTMLElement;
  readonly getPose: () => CameraPose;
  readonly setPose: (pose: CameraPose) => void;
  readonly worldUp?: CameraVector;
  readonly sceneRadius: () => number | null;
  readonly viewAngle?: () => number;
};

const MOVEMENT_KEYS = new Set([
  "KeyW",
  "KeyS",
  "KeyA",
  "KeyD",
  "KeyQ",
  "KeyE",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

const isControl = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  !!target.closest("input, select, button, a, textarea, [contenteditable]");

const radius = (options: NavigationOptions, pose: CameraPose): number =>
  Math.max(
    options.sceneRadius() ??
      Math.hypot(...pose.position.map((value, axis) => value - pose.target[axis]!)),
    1e-3,
  );

/** Movement keys belong to the focused viewer and leave form controls alone. */
export const installKeyboardNavigation = (
  options: NavigationOptions & { readonly getMode?: () => NavigationMode },
): (() => void) => {
  const { viewer } = options;
  const worldUp = normalized(options.worldUp ?? [0, 0, 1]);
  const controller = new AbortController();
  const { signal } = controller;
  const oldTabIndex = viewer.getAttribute("tabindex");
  if (viewer.tabIndex < 0) viewer.tabIndex = 0;
  const keys = new Set<string>();
  let frame = 0;
  let previousTime = 0;
  let faster = false;
  const stop = (): void => {
    keys.clear();
    faster = false;
    cancelAnimationFrame(frame);
    frame = 0;
  };
  const animate = (now: number): void => {
    frame = 0;
    if (!keys.size || (options.getMode?.() ?? "look") !== "look") return stop();
    const elapsed = Math.min((now - previousTime) / 1000, 0.1);
    previousTime = now;
    const pose = options.getPose();
    const forward = levelForward(pose, worldUp);
    const right = normalized(cross(forward, worldUp));
    const pressed = (...codes: string[]): number => Number(codes.some((code) => keys.has(code)));
    const ahead = pressed("KeyW", "ArrowUp") - pressed("KeyS", "ArrowDown");
    const across = pressed("KeyD", "ArrowRight") - pressed("KeyA", "ArrowLeft");
    const above = pressed("KeyE") - pressed("KeyQ");
    const length = Math.max(1, Math.hypot(ahead, across, above));
    const distance = (radius(options, pose) * 0.25 * (faster ? 4 : 1) * elapsed) / length;
    options.setPose(
      translateCamera(
        pose,
        vector(
          worldUp.map(
            (up, axis) => (forward[axis]! * ahead + right[axis]! * across + up * above) * distance,
          ),
        ),
      ),
    );
    frame = requestAnimationFrame(animate);
  };
  viewer.addEventListener(
    "pointerdown",
    (event) => {
      if (!isControl(event.target)) viewer.focus({ preventScroll: true });
    },
    { signal },
  );
  viewer.addEventListener(
    "keydown",
    (event) => {
      if (isControl(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
      if ((options.getMode?.() ?? "look") !== "look") return;
      faster = event.shiftKey;
      if (!MOVEMENT_KEYS.has(event.code)) return;
      event.preventDefault();
      keys.add(event.code);
      if (!frame) {
        previousTime = performance.now();
        frame = requestAnimationFrame(animate);
      }
    },
    { signal },
  );
  viewer.addEventListener(
    "keyup",
    (event) => {
      faster = event.shiftKey;
      keys.delete(event.code);
      if (!keys.size) stop();
    },
    { signal },
  );
  viewer.addEventListener("blur", stop, { signal });
  window.addEventListener("blur", stop, { signal });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) stop();
    },
    { signal },
  );
  return () => {
    stop();
    controller.abort();
    if (oldTabIndex === null) viewer.removeAttribute("tabindex");
    else viewer.setAttribute("tabindex", oldTabIndex);
  };
};

/** DOM controls for renderers without vtk.js manipulators, using the same pose math. */
export const installNavigation = (
  options: NavigationOptions & { readonly mode?: NavigationMode },
): { setMode(mode: NavigationMode): void; dispose(): void } => {
  const { viewer } = options;
  const worldUp = normalized(options.worldUp ?? [0, 0, 1]);
  const controller = new AbortController();
  const { signal } = controller;
  let mode = options.mode ?? "look";
  let drag: { id: number; x: number; y: number; button: number } | undefined;
  const disposeKeyboard = installKeyboardNavigation({
    ...options,
    getMode: () => mode,
  });
  const moveForward = (amount: number): void => {
    const pose = options.getPose();
    options.setPose(
      translateCamera(pose, vector(cameraDirection(pose).map((value) => value * amount))),
    );
  };
  const dolly = (factor: number): void => {
    const pose = options.getPose();
    const offset = vector(pose.position.map((value, axis) => value - pose.target[axis]!));
    const distance = Math.hypot(...offset);
    const next = Math.max(distance / factor, radius(options, pose) * 1e-5);
    options.setPose({
      position: vector(pose.target.map((value, axis) => value + (offset[axis]! * next) / distance)),
      target: pose.target,
    });
  };
  viewer.addEventListener("contextmenu", (event) => event.preventDefault(), {
    signal,
  });
  viewer.addEventListener(
    "pointerdown",
    (event) => {
      if (isControl(event.target) || event.button > 2) return;
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        button: event.button,
      };
      viewer.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    { signal },
  );
  viewer.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      const width = Math.max(viewer.clientWidth, 1);
      const height = Math.max(viewer.clientHeight, 1);
      const pose = options.getPose();
      if (drag.button === (mode === "orbit" ? 2 : 0)) {
        options.setPose(
          rotateCamera(
            pose,
            (-dx / width) * Math.PI * 2,
            (dy / height) * Math.PI * 2,
            worldUp,
            mode,
          ),
        );
      } else if (drag.button === 1) {
        if (mode === "orbit") dolly(Math.exp((-dy / height) * 1.6));
        else moveForward((-dy / height) * radius(options, pose) * 1.6);
      } else {
        const forward = cameraDirection(pose);
        const right = normalized(cross(forward, worldUp));
        const up = normalized(cross(right, forward));
        const distance = Math.hypot(
          ...pose.position.map((value, axis) => value - pose.target[axis]!),
        );
        const worldPerPixel =
          (2 * distance * Math.tan(((options.viewAngle?.() ?? 45) * Math.PI) / 360)) / height;
        options.setPose(
          translateCamera(
            pose,
            vector(up.map((value, axis) => (value * dy - right[axis]! * dx) * worldPerPixel)),
          ),
        );
      }
      drag = { ...drag, x: event.clientX, y: event.clientY };
    },
    { signal },
  );
  const endDrag = (): void => {
    drag = undefined;
  };
  viewer.addEventListener("pointerup", endDrag, { signal });
  viewer.addEventListener("pointercancel", endDrag, { signal });
  viewer.addEventListener("lostpointercapture", endDrag, { signal });
  viewer.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const pixels =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewer.clientHeight : 1);
      if (mode === "orbit") dolly(1.12 ** (-pixels / 100));
      else moveForward((-pixels / 100) * radius(options, options.getPose()) * 0.08);
    },
    { signal, passive: false },
  );
  return {
    setMode(next) {
      mode = next;
      endDrag();
    },
    dispose() {
      controller.abort();
      disposeKeyboard();
    },
  };
};
