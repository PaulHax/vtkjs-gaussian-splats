import "@kitware/vtk.js/Rendering/OpenGL/Profiles/Geometry";
import vtkActor from "@kitware/vtk.js/Rendering/Core/Actor";
import vtkDataArray from "@kitware/vtk.js/Common/Core/DataArray";
import vtkPolyData from "@kitware/vtk.js/Common/DataModel/PolyData";
import vtkPointGaussianMapper from "@kitware/vtk.js/Rendering/Core/PointGaussianMapper";
import vtkRenderer from "@kitware/vtk.js/Rendering/Core/Renderer";
import vtkRenderWindow from "@kitware/vtk.js/Rendering/Core/RenderWindow";
import vtkRenderWindowInteractor from "@kitware/vtk.js/Rendering/Core/RenderWindowInteractor";
import vtkForwardPass from "@kitware/vtk.js/Rendering/OpenGL/ForwardPass";
import vtkOpenGLRenderWindow from "@kitware/vtk.js/Rendering/OpenGL/RenderWindow";
import { createAlphaPass } from "./alphaPass";
import { loadGaussianScene } from "./loader";
import { installCameraControls } from "../cameraControls";
import { vector, type CameraPose } from "../cameraNavigation";
import { initializeScenePanel } from "./scenePanel";
import { installKeyboardNavigation } from "./navigation";
import { createGpuFrameTimer } from "../gpuTimer";

const element = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element ${id}`);
  return node as T;
};

const { scene, params, initialPose, worldUp, pixelRatio } = initializeScenePanel();

const container = element("scene");
const status = element("status");
const loading = element("loading");
const mode = element<HTMLSelectElement>("mode");
const renderer = vtkRenderer.newInstance({ background: [0.045, 0.06, 0.07] });
const renderWindow = vtkRenderWindow.newInstance();
const openGL = vtkOpenGLRenderWindow.newInstance();
openGL.get3DContext({
  antialias: false,
  alpha: false,
  depth: true,
  powerPreference: "high-performance",
});
renderWindow.addRenderer(renderer);
renderWindow.addView(openGL);
openGL.setContainer(container);
const interactor = vtkRenderWindowInteractor.newInstance();
interactor.setView(openGL);
interactor.setEnableRender(false);
interactor.initialize();
interactor.bindEvents(container);
const alphaPass = createAlphaPass(() =>
  (openGL as typeof openGL & { getContext(): WebGL2RenderingContext }).getContext(),
);
openGL.setRenderPasses([vtkForwardPass.newInstance({ translucentPass: alphaPass })]);
const camera = renderer.getActiveCamera();
const polyData = vtkPolyData.newInstance();
const mapper = vtkPointGaussianMapper.newInstance({
  anisotropic: true,
  emissive: false,
  scaleFactor: 1,
  scaleArray: "scale",
  rotationArray: "rotation",
  boundScale: 3,
});
mapper.setInputData(polyData);
mapper.setColorModeToDirectScalars();
const actor = vtkActor.newInstance();
actor.setMapper(mapper);
actor.getProperty().setPointSize(2);
renderer.addActor(actor);

const worker = new Worker(new URL("./sort.worker.ts", import.meta.url), {
  type: "module",
});
let ready = false;
let disposed = false;
let count = 0;
let sorting = false;
let revision = 0;
let requestedDirection: [number, number, number] = [0, 0, 0];
let completedRevision = -1;
let frame = 0;
let renderedFrames = 0;
let sortMs = 0;
let cpuRenderMs = 0;
let gpuFrameMs: number | null = null;
let gpuTimer: ReturnType<typeof createGpuFrameTimer> | undefined;
let gpu = "Unavailable";
let softwareRenderer = false;
let antialias = false;
let samples = 0;
let previousFrame = 0;
const frameTimes: number[] = [];
const pointOrder = vtkDataArray.newInstance({
  name: "pointOrder",
  numberOfComponents: 1,
  values: new Uint32Array(),
});
mapper.setPointOrder(pointOrder);
const navigationMode = element<HTMLSelectElement>("navigation");
const renderInfo = element("render-info");
const getPose = (): CameraPose => ({
  position: vector(camera.getPosition()),
  target: vector(camera.getFocalPoint()),
});
const setPose = (pose: CameraPose): void => {
  camera.setPosition(...pose.position);
  camera.setFocalPoint(...pose.target);
  camera.setViewUp(...worldUp);
  renderer.resetCameraClippingRange();
};
const controls = installCameraControls({
  interactor,
  renderer,
  viewer: container,
  canvas: () => container.querySelector("canvas"),
  sceneRadius: () => scene.sceneRadius,
  worldUp,
  mode: scene.navigation,
});
const disposeKeyboard = installKeyboardNavigation({
  viewer: container,
  getPose,
  setPose,
  worldUp,
  sceneRadius: () => scene.sceneRadius,
  getMode: () => (navigationMode.value === "orbit" ? "orbit" : "look"),
});
const fail = (error: unknown): void => {
  if (disposed) return;
  loading.dataset.state = "error";
  status.textContent = error instanceof Error ? error.message : String(error);
};
const markReady = (): void => {
  loading.dataset.state = "ready";
  status.textContent = `${count.toLocaleString()} Gaussians`;
};
const requestSort = (): void => {
  if (!ready || disposed) return;
  const direction = vector(camera.getDirectionOfProjection());
  if (direction.some((value, i) => Math.abs(value - requestedDirection[i]!) > 1e-7)) {
    requestedDirection = direction;
    revision++;
  }
  if (sorting || completedRevision === revision) return;
  sorting = true;
  loading.dataset.state = "sorting";
  worker.postMessage({ direction: requestedDirection, revision });
};
const updateInfo = (): void => {
  const [width, height] = openGL.getSize();
  const fps =
    frameTimes.length >= 5
      ? 1000 / (frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length)
      : null;
  renderInfo.textContent = `${width} × ${height} · DPR ${pixelRatio().toFixed(2)}${fps === null ? "" : ` · ${fps.toFixed(0)} FPS moving`} · Sort ${sortMs.toFixed(1)} ms${softwareRenderer ? " · Software WebGL" : ""}`;
  renderInfo.title = gpu;
};
const render = (now: number): void => {
  frame = 0;
  if (disposed || completedRevision < 0) return;
  requestSort();
  camera.setClippingRange(...scene.clippingRange);
  const start = performance.now();
  gpuTimer?.begin();
  try {
    openGL.traverseAllPasses();
  } finally {
    gpuTimer?.end();
  }
  cpuRenderMs = performance.now() - start;
  renderedFrames++;
  if (completedRevision === revision) markReady();
  if (previousFrame && now - previousFrame < 250) {
    frameTimes.push(now - previousFrame);
    if (frameTimes.length > 60) frameTimes.shift();
  } else frameTimes.length = 0;
  previousFrame = now;
  if (gpu === "Unavailable") {
    const gl = (openGL as typeof openGL & { getContext(): WebGL2RenderingContext }).getContext();
    antialias = gl.getContextAttributes()?.antialias ?? false;
    samples = gl.getParameter(gl.SAMPLES) as number;
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    gpu = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : "Unknown";
    softwareRenderer = /swiftshader|llvmpipe|softpipe|software rasterizer/i.test(gpu);
    if (params.get("profile") === "1")
      gpuTimer = createGpuFrameTimer(gl, {
        onResult: (result) => {
          gpuFrameMs = result.status === "valid" ? result.gpuMs : null;
        },
      });
  }
  updateInfo();
};
const requestRender = (): void => {
  if (!disposed && !frame && completedRevision >= 0) frame = requestAnimationFrame(render);
};
worker.onmessage = ({
  data,
}: MessageEvent<{
  order: Uint32Array;
  revision: number;
  sortMs: number;
}>): void => {
  if (disposed) return;
  sorting = false;
  // Display completed orders while the worker catches up with camera movement.
  completedRevision = data.revision;
  pointOrder.setData(data.order, 1);
  sortMs = data.sortMs;
  requestSort();
  requestRender();
};
worker.onerror = (event): void => fail(new Error(event.message));
const resize = (): void => {
  const bounds = container.getBoundingClientRect();
  const ratio = pixelRatio();
  const width = Math.max(1, Math.floor(bounds.width * ratio));
  const height = Math.max(1, Math.floor(bounds.height * ratio));
  openGL.setSize(width, height);
  mapper.setLowpassMatrix(1.2 / (width * width), 0, 1.2 / (height * height));
  requestRender();
};
const observer = new ResizeObserver(resize);
observer.observe(container);
const subscription = camera.onModified(requestRender);
element("reset").addEventListener("click", () => {
  setPose(initialPose);
});
navigationMode.addEventListener("change", () => {
  controls.setNavigationMode(navigationMode.value === "orbit" ? "orbit" : "look");
});
mode.addEventListener("change", () => {
  mapper.setScaleFactor(mode.value === "points" ? 0 : 1);
  requestRender();
});
Object.defineProperty(window, "gaussianExample", {
  value: Object.freeze({
    getStats: () => ({
      renderer: "VTK.js",
      scene: scene.id,
      gpu,
      softwareRenderer,
      antialias,
      samples,
      count,
      renderedFrames,
      width: openGL.getSize()[0],
      height: openGL.getSize()[1],
      dpr: pixelRatio(),
      ...getPose(),
      worldUp: [...worldUp],
      fov: camera.getViewAngle(),
      clippingRange: [...camera.getClippingRange()],
      sortMs,
      cpuRenderMs,
      gpuFrameMs,
      sorting,
    }),
  }),
});
const abort = new AbortController();
void loadGaussianScene(scene.assetUrl, abort.signal)
  .then((data) => {
    if (disposed) return;
    count = data.positions.length / 3;
    polyData.getPoints().setData(data.positions, 3);
    polyData.getPointData().setScalars(
      vtkDataArray.newInstance({
        name: "color",
        numberOfComponents: 4,
        values: data.colors,
      }),
    );
    polyData.getPointData().addArray(
      vtkDataArray.newInstance({
        name: "scale",
        numberOfComponents: 3,
        values: data.scales,
      }),
    );
    polyData.getPointData().addArray(
      vtkDataArray.newInstance({
        name: "rotation",
        numberOfComponents: 4,
        values: data.rotations,
      }),
    );
    setPose(initialPose);
    camera.setViewAngle(scene.viewAngle);
    ready = true;
    requestedDirection = vector(camera.getDirectionOfProjection());
    sorting = true;
    status.textContent = "Preparing the first view…";
    worker.postMessage({
      positions: data.positions,
      direction: requestedDirection,
      revision,
    });
  })
  .catch(fail);
window.addEventListener("pagehide", (event) => {
  cancelAnimationFrame(frame);
  frame = 0;
  if (event.persisted) return;
  disposed = true;
  abort.abort();
  observer.disconnect();
  subscription?.unsubscribe();
  disposeKeyboard();
  worker.terminate();
  gpuTimer?.dispose();
  interactor.unbindEvents();
  interactor.delete();
  openGL.setContainer(null);
  openGL.delete();
  renderWindow.delete();
  renderer.delete();
  actor.delete();
  mapper.delete();
  polyData.delete();
  pointOrder.delete();
});
