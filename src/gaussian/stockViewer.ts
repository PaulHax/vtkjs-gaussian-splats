import {
  cameraDirection,
  cross,
  dot,
  normalized,
  type CameraPose,
  type CameraVector,
} from "../cameraNavigation";

export const stockViewerUrl = (
  assetUrl: string,
  pose: CameraPose,
  worldUp: CameraVector,
): string => {
  const forward = cameraDirection(pose);
  const right = normalized(cross(forward, worldUp));
  const down = cross(forward, right);
  // The stock viewer's camera uses positive Z forward and positive Y down.
  const viewMatrix = [
    right[0],
    down[0],
    forward[0],
    0,
    right[1],
    down[1],
    forward[1],
    0,
    right[2],
    down[2],
    forward[2],
    0,
    -dot(right, pose.position),
    -dot(down, pose.position),
    -dot(forward, pose.position),
    1,
  ];
  const viewer = new URL(`${import.meta.env.BASE_URL}stock/`, location.href);
  viewer.searchParams.set("url", new URL(assetUrl, location.href).href);
  viewer.hash = encodeURIComponent(JSON.stringify(viewMatrix));
  return viewer.href;
};
