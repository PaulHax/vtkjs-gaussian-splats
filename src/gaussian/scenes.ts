import type { CameraPose, CameraVector, NavigationMode } from "../cameraNavigation";

export type GaussianScene = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly assetUrl: string;
  readonly pose: CameraPose;
  readonly worldUp: CameraVector;
  readonly viewAngle: number;
  readonly viewAngleAxis: "longest" | "vertical";
  readonly clippingRange: readonly [number, number];
  readonly sceneRadius: number;
  readonly navigation: NavigationMode;
  readonly credit: string;
  readonly sourceUrl: string;
};

export const scenes: readonly GaussianScene[] = [
  {
    id: "urban",
    title: "Urban drone survey",
    description: "A neighborhood reconstructed from 100 aerial images.",
    category: "Drone imagery",
    assetUrl: `${import.meta.env.BASE_URL}data/urban.splat`,
    pose: {
      position: [449.806488, -376.986999, 197.310333],
      target: [0, -0.5, 0],
    },
    worldUp: [0, -1, 0],
    viewAngle: 75,
    viewAngleAxis: "longest",
    clippingRange: [0.5, 3000],
    sceneRadius: 400,
    navigation: "orbit",
    credit: "PIX4D drone sample · Seeget3D · CC BY 4.0",
    sourceUrl: "https://superspl.at/scene/e92a7e9b",
  },
  {
    id: "hall",
    title: "Knock Community Hall",
    description: "A Phantom 4 drone capture reconstructed from 185 aerial images.",
    category: "Drone imagery",
    assetUrl: `${import.meta.env.BASE_URL}data/hall.splat`,
    pose: {
      position: [13.096988, -6.953827, 14.048527],
      target: [-0.799408, -4.250976, -1.063691],
    },
    worldUp: [0, -1, 0],
    viewAngle: 75,
    viewAngleAxis: "vertical",
    clippingRange: [0.05, 1000],
    sceneRadius: 15,
    navigation: "orbit",
    credit: "Knock Community Hall · scbenoit · CC BY 4.0",
    sourceUrl: "https://superspl.at/scene/0ff2e6dc",
  },
];
