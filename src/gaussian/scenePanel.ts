import { normalized, type CameraPose, type CameraVector } from "../cameraNavigation";
import { scenes } from "./scenes";
import { stockViewerUrl } from "./stockViewer";

const element = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element ${id}`);
  return node as T;
};

export const initializeScenePanel = () => {
  const params = new URLSearchParams(location.search);
  const modelId = params.get("model") ?? "urban";
  const scene = scenes.find((candidate) => candidate.id === modelId);
  if (!scene) throw new Error(`Unknown Gaussian model: ${modelId}`);
  const cameraVector = (name: string, fallback: CameraVector): CameraVector => {
    const value = params.get(name);
    if (value === null) return fallback;
    const parts = value.split(",").map(Number);
    if (parts.length !== 3 || !parts.every(Number.isFinite)) {
      throw new Error(`Camera ${name} must contain three finite numbers.`);
    }
    return parts as [number, number, number];
  };
  const requestedRatio = params.has("dpr") ? Number(params.get("dpr")) : null;
  if (
    requestedRatio !== null &&
    (!Number.isFinite(requestedRatio) || requestedRatio < 0.5 || requestedRatio > 2)
  ) {
    throw new Error("DPR must be a finite number between 0.5 and 2.");
  }
  const initialPose: CameraPose = {
    position: cameraVector("position", scene.pose.position),
    target: cameraVector("target", scene.pose.target),
  };
  const worldUp = normalized(cameraVector("up", scene.worldUp));
  const panel = document.createElement("aside");
  panel.id = "scene-panel";
  panel.setAttribute("aria-label", "Scene controls");
  panel.innerHTML = `
    <header>
      <a class="repository-link" href="https://github.com/PaulHax/vtkjs-gaussian-splats" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
    </header>
    <label class="field model-field" for="model">Model<select id="model"></select></label>
    <div class="intro">
      <span class="eyebrow" id="scene-category"></span>
      <h1 id="scene-title"></h1>
      <p id="scene-description"></p>
      <a class="model-credit" id="scene-credit" target="_blank" rel="noopener noreferrer"></a>
      <a class="model-credit" href="https://github.com/PaulHax/vtkjs-gaussian-splats/blob/main/public/ATTRIBUTION.md" target="_blank" rel="noopener noreferrer">Attribution</a>
    </div>
    <div class="controls">
      <label class="field" for="navigation">Navigation
        <select id="navigation"><option value="look">Walk</option><option value="orbit">Orbit</option></select>
      </label>
      <label class="field" for="mode">View<select id="mode"><option value="splats">Splats</option><option value="points">Point cloud</option></select></label>
      <button id="reset" type="button">Reset view</button>
    </div>
    <p class="gesture"></p>
    <div class="scene-status">
      <div id="loading" role="status" data-state="loading"><span class="loading-dot"></span><span id="status">Loading model…</span></div>
      <output id="render-info" aria-label="Renderer information"></output>
    </div>
    <section class="comparison" aria-label="Compare in a stock viewer">
      <h2>Compare in another viewer</h2>
      <div class="viewer-links">
        <a id="stock-viewer" target="_blank" rel="noopener noreferrer">View this model ↗</a>
        <a id="spark-demos" href="https://sparkjs.dev/examples/#hello-world" target="_blank" rel="noopener noreferrer">Spark demos ↗</a>
      </div>
    </section>
  `;
  document.body.append(panel);
  element("scene-category").textContent = scene.category;
  element("scene-title").textContent = scene.title;
  element("scene-description").textContent = scene.description;
  document.title = `${scene.title} · VTK.js · tiled-vtkjs`;
  const selector = element<HTMLSelectElement>("model");
  for (const candidate of scenes) selector.add(new Option(candidate.title, candidate.id));
  selector.value = scene.id;
  selector.addEventListener("change", () => {
    const query = new URLSearchParams(location.search);
    query.set("model", selector.value);
    for (const key of ["position", "target", "up"]) query.delete(key);
    location.search = query.toString();
  });
  element<HTMLSelectElement>("navigation").value = scene.navigation;
  const help = (): void => {
    panel.querySelector(".gesture")!.textContent =
      element<HTMLSelectElement>("navigation").value === "orbit"
        ? "Left drag to pan · Right drag to orbit · Scroll to zoom"
        : "Drag to look · WASD to walk · Q/E up/down · Shift to move faster";
  };
  element("navigation").addEventListener("change", help);
  help();
  element<HTMLAnchorElement>("stock-viewer").href = stockViewerUrl(
    scene.assetUrl,
    initialPose,
    worldUp,
  );
  const credit = element<HTMLAnchorElement>("scene-credit");
  credit.textContent = scene.credit;
  credit.href = scene.sourceUrl;
  return {
    scene,
    params,
    initialPose,
    worldUp,
    pixelRatio: (): number => requestedRatio ?? window.devicePixelRatio ?? 1,
  };
};
