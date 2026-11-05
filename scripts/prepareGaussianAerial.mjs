import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const converterPackage = "@playcanvas/splat-transform";
const converterVersion = "3.10.3";
const converter = `${converterPackage}@${converterVersion}`;
const sources = JSON.parse(
  await readFile(
    new URL("./gaussianAerialSources.json", import.meta.url),
    "utf8",
  ),
);
const selection = process.argv[2];
if (selection && !sources.some((source) => source.id === selection)) {
  throw new Error(
    `Unknown model: ${selection}. Choose ${sources.map((source) => source.id).join(" or ")}.`,
  );
}
const outputDirectory = fileURLToPath(
  new URL("../public/data/", import.meta.url),
);
const converterDirectory = dirname(
  dirname(fileURLToPath(import.meta.resolve(converterPackage))),
);
const converterManifest = JSON.parse(
  await readFile(join(converterDirectory, "package.json"), "utf8"),
);
if (converterManifest.version !== converterVersion) {
  throw new Error(`Expected ${converter}; run npm ci before preparing models.`);
}
const converterCli = join(
  converterDirectory,
  converterManifest.bin["splat-transform"],
);
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const run = (args, cwd) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [converterCli, ...args], {
      cwd,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`Scene conversion failed (${signal ?? code}).`)),
    );
  });

for (const source of sources.filter(
  (candidate) => !selection || candidate.id === selection,
)) {
  const workingDirectory = await mkdtemp(join(tmpdir(), "gaussian-aerial-"));
  try {
    console.log(`Preparing ${source.title}.`);
    for (let index = 0; index < source.files.length; index += 4) {
      await Promise.all(
        source.files.slice(index, index + 4).map(async (file) => {
          const response = await fetch(new URL(file.path, source.baseUrl), {
            signal: AbortSignal.timeout(120_000),
          });
          if (!response.ok)
            throw new Error(
              `${file.path}: download failed (${response.status}).`,
            );
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length !== file.size || sha256(bytes) !== file.sha256) {
            throw new Error(
              `${file.path}: source differs from its pinned size or SHA-256.`,
            );
          }
          const path = join(workingDirectory, file.path);
          await mkdir(dirname(path), { recursive: true });
          await writeFile(path, bytes);
        }),
      );
    }
    const resultPath = join(workingDirectory, `${source.id}.splat`);
    await run(
      [
        ...source.inputs,
        resultPath,
        "--filter-harmonics",
        "0",
      ],
      workingDirectory,
    );
    const result = await readFile(resultPath);
    if (
      result.length !== source.bytes ||
      result.length !== source.count * 32 ||
      sha256(result) !== source.sha256
    ) {
      throw new Error(
        `${source.id}: converted output differs from its pinned size, count or SHA-256.`,
      );
    }
    await mkdir(outputDirectory, { recursive: true });
    const outputPath = join(outputDirectory, `${source.id}.splat`);
    await writeFile(`${outputPath}.tmp`, result);
    await rename(`${outputPath}.tmp`, outputPath);
    await writeFile(
      join(outputDirectory, `${source.id}.json`),
      `${JSON.stringify({ ...source, converter, format: "splat-32" }, null, 2)}\n`,
    );
    console.log(
      `Prepared ${source.count.toLocaleString("en-US")} Gaussians: ${outputPath}`,
    );
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}
