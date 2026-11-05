export type CameraVector = readonly [number, number, number];
export type CameraPose = {
  readonly position: CameraVector;
  readonly target: CameraVector;
};
export type NavigationMode = "orbit" | "look";

export const vector = (values: readonly number[]): [number, number, number] => [
  values[0]!,
  values[1]!,
  values[2]!,
];
export const dot = (a: CameraVector, b: CameraVector): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: CameraVector, b: CameraVector): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const normalized = (value: CameraVector): [number, number, number] => {
  const length = Math.hypot(...value);
  if (!Number.isFinite(length) || length === 0) {
    throw new Error("Camera direction must be finite and nonzero.");
  }
  return vector(value.map((component) => component / length));
};

export const cameraDirection = (pose: CameraPose): [number, number, number] =>
  normalized(vector(pose.target.map((value, axis) => value - pose.position[axis]!)));

export const translateCamera = (pose: CameraPose, translation: CameraVector): CameraPose => ({
  position: vector(pose.position.map((value, axis) => value + translation[axis]!)),
  target: vector(pose.target.map((value, axis) => value + translation[axis]!)),
});

/** Rotate around fixed world up, keeping pitch one degree away from either pole. */
export const rotateCamera = (
  pose: CameraPose,
  yaw: number,
  orbitPitch: number,
  worldUp: CameraVector,
  mode: NavigationMode,
): CameraPose => {
  const center = mode === "orbit" ? pose.target : pose.position;
  const moving = mode === "orbit" ? pose.position : pose.target;
  const offset = vector(moving.map((value, axis) => value - center[axis]!));
  const distance = Math.hypot(...offset);
  if (!Number.isFinite(distance) || distance === 0) return pose;
  const vertical = dot(offset, worldUp);
  const horizontal = vector(offset.map((value, axis) => value - worldUp[axis]! * vertical));
  const horizontalLength = Math.hypot(...horizontal);
  const direction =
    horizontalLength > distance * 1e-12
      ? vector(horizontal.map((value) => value / horizontalLength))
      : normalized(cross(worldUp, Math.abs(worldUp[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  const side = cross(worldUp, direction);
  const maxPitch = (89 * Math.PI) / 180;
  const pitch = Math.max(
    -maxPitch,
    Math.min(
      maxPitch,
      Math.asin(Math.max(-1, Math.min(1, vertical / distance))) +
        (mode === "orbit" ? orbitPitch : -orbitPitch),
    ),
  );
  const horizontalRadius = Math.cos(pitch) * distance;
  const destination = vector(
    center.map(
      (value, axis) =>
        value +
        (direction[axis]! * Math.cos(yaw) + side[axis]! * Math.sin(yaw)) * horizontalRadius +
        worldUp[axis]! * Math.sin(pitch) * distance,
    ),
  );
  return mode === "orbit"
    ? { position: destination, target: pose.target }
    : { position: pose.position, target: destination };
};

export const levelForward = (pose: CameraPose, worldUp: CameraVector): [number, number, number] => {
  const forward = cameraDirection(pose);
  const vertical = dot(forward, worldUp);
  const horizontal = vector(forward.map((value, axis) => value - worldUp[axis]! * vertical));
  return Math.hypot(...horizontal) > 1e-12
    ? normalized(horizontal)
    : normalized(cross(worldUp, Math.abs(worldUp[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
};
