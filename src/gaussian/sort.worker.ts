import { createDepthSorter } from "./depthOrder";

type SortRequest = {
  positions?: Float32Array;
  direction: [number, number, number];
  revision: number;
};

let positions: Float32Array = new Float32Array();
const sorter = createDepthSorter();

self.onmessage = ({ data }: MessageEvent<SortRequest>): void => {
  if (data.positions) positions = data.positions;
  const started = performance.now();
  const order = sorter.sort(positions, data.direction);
  self.postMessage(
    { order, revision: data.revision, sortMs: performance.now() - started },
    { transfer: [order.buffer] },
  );
};

export {};
