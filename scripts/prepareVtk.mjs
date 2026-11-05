import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  readlink,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const cache = join(root, ".cache");
const source = join(cache, "vtk.js");
const stampPath = join(cache, "vtk.js-build.json");
const packageLink = join(root, "node_modules/@kitware/vtk.js");
const artifact = join(source, "dist/esm");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const exists = async (path) => {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

function run(command, args, cwd, capture = false) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, CI: "1" },
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    });
    const output = [];
    child.stdout?.on("data", (chunk) => output.push(chunk));
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolveRun(Buffer.concat(output));
      else reject(new Error(`${command} failed (${signal ?? code}).`));
    });
  });
}

async function treeDigest(directory) {
  const hash = createHash("sha256");
  async function visit(path) {
    const entries = await readdir(path, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) await visit(child);
      else if (entry.isFile()) {
        hash.update(relative(directory, child).replaceAll("\\", "/"));
        hash.update("\0");
        hash.update(digest(await readFile(child)));
        hash.update("\n");
      } else throw new Error(`Unexpected artifact entry: ${child}`);
    }
  }
  await visit(directory);
  return hash.digest("hex");
}

async function verifySource(directory, revision, patchSha256) {
  const head = (await run("git", ["rev-parse", "HEAD"], directory, true))
    .toString()
    .trim();
  const diff = await run(
    "git",
    ["diff", "--no-ext-diff", "--binary", "--full-index", "HEAD", "--"],
    directory,
    true,
  );
  const extra = await run(
    "git",
    ["ls-files", "--others", "--exclude-standard"],
    directory,
    true,
  );
  if (head !== revision || digest(diff) !== patchSha256 || extra.length) {
    throw new Error(
      "The cached vtk.js source differs from its pinned revision and patch. Remove .cache/vtk.js and .cache/vtk.js-build.json to rebuild it.",
    );
  }
}

async function verifyLink() {
  const stat = await exists(packageLink);
  if (!stat) return;
  if (
    !stat.isSymbolicLink() ||
    resolve(dirname(packageLink), await readlink(packageLink)) !== artifact
  ) {
    throw new Error(
      "node_modules/@kitware/vtk.js already exists and is not this demo's prepared vtk.js link.",
    );
  }
}

const configBytes = await readFile(join(root, "vtk-source.json"));
const config = JSON.parse(configBytes);
if (!/^[0-9a-f]{40}$/.test(config.revision)) {
  throw new Error("vtk-source.json must pin a full Git commit SHA.");
}
const patchPath = resolve(root, config.patch);
const patch = await readFile(patchPath);
if (digest(patch) !== config.patchSha256) {
  throw new Error("The vtk.js patch does not match its pinned SHA-256.");
}
const key = digest(
  Buffer.concat([
    configBytes,
    patch,
    await readFile(fileURLToPath(import.meta.url)),
    Buffer.from(`${process.version}/${process.platform}/${process.arch}`),
  ]),
);

await mkdir(cache, { recursive: true });
const lockPath = join(cache, "vtk.js-build.lock");
const lock = await open(lockPath, "wx").catch((error) => {
  if (error.code === "EEXIST") {
    throw new Error(
      "A vtk.js preparation lock exists. Wait for that build, or remove .cache/vtk.js-build.lock if it was interrupted.",
    );
  }
  throw error;
});
let staging;
try {
  await verifyLink();
  let stamp;
  if (await exists(stampPath)) stamp = JSON.parse(await readFile(stampPath));
  if (await exists(source)) {
    if (!stamp) throw new Error("The vtk.js cache has no completed build stamp.");
    await verifySource(source, stamp.revision, stamp.patchSha256);
    if ((await treeDigest(artifact)) !== stamp.artifactSha256) {
      throw new Error(
        "The cached vtk.js artifact changed or is incomplete. Remove .cache/vtk.js and .cache/vtk.js-build.json to rebuild it.",
      );
    }
  } else stamp = undefined;

  if (stamp?.key !== key) {
    await rm(packageLink, { force: true });
    staging = await mkdtemp(join(cache, "vtk-build-"));
    await run("git", ["init", "--quiet"], staging);
    await run(
      "git",
      ["fetch", "--depth=1", config.repository, config.revision],
      staging,
    );
    await run("git", ["checkout", "--detach", "--quiet", "FETCH_HEAD"], staging);
    await run("git", ["apply", "--check", patchPath], staging);
    await run("git", ["apply", "--index", patchPath], staging);
    await verifySource(staging, config.revision, config.patchSha256);
    await run("npm", ["ci", "--no-audit", "--no-fund"], staging);
    await run("npm", ["run", "build:esm"], staging);
    await verifySource(staging, config.revision, config.patchSha256);
    const built = join(staging, "dist/esm");
    for (const file of [
      "package.json",
      "index.js",
      "Rendering/Core/PointGaussianMapper.js",
      "Rendering/Core/PointGaussianMapper.d.ts",
      "Rendering/OpenGL/PointGaussianMapper.js",
      "Rendering/OpenGL/ForwardPass.d.ts",
      "Rendering/OpenGL/Profiles/Geometry.js",
    ]) {
      if (!(await exists(join(built, file)))) {
        throw new Error(`The vtk.js build is missing ${file}.`);
      }
    }
    stamp = {
      key,
      revision: config.revision,
      patchSha256: config.patchSha256,
      artifactSha256: await treeDigest(built),
    };
    await rm(source, { recursive: true, force: true });
    await rename(staging, source);
    staging = undefined;
    await writeFile(`${stampPath}.tmp`, `${JSON.stringify(stamp, null, 2)}\n`);
    await rename(`${stampPath}.tmp`, stampPath);
    console.log(`Built vtk.js ${config.upstreamVersion} with the Gaussian patch.`);
  } else {
    console.log("Verified the prepared vtk.js source and ESM artifact.");
  }

  await mkdir(dirname(packageLink), { recursive: true });
  if (!(await exists(packageLink))) {
    await symlink(relative(dirname(packageLink), artifact), packageLink, "dir");
  }
  console.log(`vtk.js is ready: ${relative(root, artifact)}`);
} finally {
  if (staging) await rm(staging, { recursive: true, force: true });
  await lock.close();
  await rm(lockPath, { force: true });
}
