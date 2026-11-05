const DIGIT_BITS = 11;
const BUCKETS = 1 << DIGIT_BITS;
const DIGIT_MASK = BUCKETS - 1;

export type DepthSorter = {
  /** Descending Float32 depth, with original point IDs breaking equal-depth ties. */
  sort(positions: Float32Array, direction: readonly [number, number, number]): Uint32Array;
};

export const createDepthSorter = (): DepthSorter => {
  let depths: Float32Array = new Float32Array();
  let keys: Uint32Array = new Uint32Array();
  let scratch: Uint32Array = new Uint32Array();
  const offsets = new Uint32Array(BUCKETS * 3);

  return {
    sort(positions, direction) {
      const count = positions.length / 3;
      if (keys.length !== count) {
        depths = new Float32Array(count);
        keys = new Uint32Array(depths.buffer);
        scratch = new Uint32Array(count);
      }
      const order = new Uint32Array(count);
      offsets.fill(0);
      const [x, y, z] = direction;

      for (let id = 0; id < count; id++) {
        const position = id * 3;
        const depth =
          positions[position]! * x + positions[position + 1]! * y + positions[position + 2]! * z;
        depths[id] = depth;
        const bits = keys[id]!;
        // Ascending unsigned keys encode descending signed Float32 values.
        // Signed zeros, including underflow to -0, retain point-ID order.
        const key = bits === 0x80000000 ? 0x7fffffff : bits ^ (bits >>> 31 ? 0 : 0x7fffffff);
        keys[id] = key;
        offsets[key & DIGIT_MASK]!++;
        offsets[BUCKETS + ((key >>> DIGIT_BITS) & DIGIT_MASK)]!++;
        offsets[BUCKETS * 2 + (key >>> (DIGIT_BITS * 2))]!++;
      }

      for (let pass = 0; pass < 3; pass++) {
        const base = pass * BUCKETS;
        let start = 0;
        for (let bucket = 0; bucket < BUCKETS; bucket++) {
          const length = offsets[base + bucket]!;
          offsets[base + bucket] = start;
          start += length;
        }
      }

      // Every scatter is stable. Starting with ascending IDs preserves ties
      // without a second key or a comparison callback per pair of points.
      for (let id = 0; id < count; id++) {
        const bucket = keys[id]! & DIGIT_MASK;
        order[offsets[bucket]!] = id;
        offsets[bucket]!++;
      }
      for (let index = 0; index < count; index++) {
        const id = order[index]!;
        const bucket = BUCKETS + ((keys[id]! >>> DIGIT_BITS) & DIGIT_MASK);
        scratch[offsets[bucket]!] = id;
        offsets[bucket]!++;
      }
      for (let index = 0; index < count; index++) {
        const id = scratch[index]!;
        const bucket = BUCKETS * 2 + (keys[id]! >>> (DIGIT_BITS * 2));
        order[offsets[bucket]!] = id;
        offsets[bucket]!++;
      }
      return order;
    },
  };
};
