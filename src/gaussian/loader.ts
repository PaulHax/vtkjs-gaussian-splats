export type GaussianData = {
  positions: Float32Array;
  scales: Float32Array;
  rotations: Float32Array;
  colors: Uint8Array;
};

const RECORD_BYTES = 32;

/** Decode little-endian .splat records; quaternion components are W, X, Y, Z. */
export function decodeSplat(buffer: ArrayBuffer): GaussianData {
  if (buffer.byteLength === 0 || buffer.byteLength % RECORD_BYTES !== 0) {
    throw new Error("A splat file must contain complete 32-byte records.");
  }
  const count = buffer.byteLength / RECORD_BYTES;
  const view = new DataView(buffer);
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 4);
  const colors = new Uint8Array(count * 4);

  for (let i = 0; i < count; i++) {
    const offset = i * RECORD_BYTES;
    for (let component = 0; component < 3; component++) {
      const position = view.getFloat32(offset + component * 4, true);
      const scale = view.getFloat32(offset + 12 + component * 4, true);
      if (!Number.isFinite(position) || !Number.isFinite(scale) || scale <= 0) {
        throw new Error(`Splat ${i} has an invalid position or scale.`);
      }
      positions[i * 3 + component] = position;
      scales[i * 3 + component] = scale;
    }
    let rotationLengthSquared = 0;
    for (let component = 0; component < 4; component++) {
      colors[i * 4 + component] = view.getUint8(offset + 24 + component);
      const rotation = (view.getUint8(offset + 28 + component) - 128) / 128;
      rotations[i * 4 + component] = rotation;
      rotationLengthSquared += rotation * rotation;
    }
    if (rotationLengthSquared === 0) {
      throw new Error(`Splat ${i} has a zero quaternion.`);
    }
    const inverseLength = 1 / Math.sqrt(rotationLengthSquared);
    for (let component = 0; component < 4; component++) {
      rotations[i * 4 + component] = rotations[i * 4 + component]! * inverseLength;
    }
  }

  return { positions, scales, rotations, colors };
}

export async function loadGaussianScene(url: string, signal?: AbortSignal): Promise<GaussianData> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Could not load the Gaussian scene (${response.status}).`);
  }
  return decodeSplat(await response.arrayBuffer());
}
