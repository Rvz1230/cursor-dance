import { gzipSync } from "node:zlib";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const rendererRoot = resolve(projectRoot, "out/renderer");

const budgets = {
  workbenchInitialRawBytes: 1_250_000,
  workbenchInitialGzipBytes: 270_000,
  overlayInitialRawBytes: 180_000,
  overlayInitialGzipBytes: 45_000,
  largestJavaScriptChunkBytes: 1_100_000,
  rendererOutputBytes: 2_200_000,
};

async function measureInitialAssets(entryName) {
  const htmlPath = resolve(rendererRoot, entryName, "index.html");
  const html = await readFile(htmlPath, "utf8");
  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => path.includes("/assets/"))
    .map((path) => resolve(dirname(htmlPath), path));
  const contents = await Promise.all([...new Set(assetPaths)].map((path) => readFile(path)));
  return {
    rawBytes: contents.reduce((sum, content) => sum + content.byteLength, 0),
    gzipBytes: contents.reduce((sum, content) => sum + gzipSync(content).byteLength, 0),
  };
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const path = resolve(root, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }))).flat();
}

const [workbench, overlay, outputFiles] = await Promise.all([
  measureInitialAssets("workbench"),
  measureInitialAssets("overlay"),
  listFiles(rendererRoot),
]);
const fileSizes = await Promise.all(outputFiles.map(async (path) => ({
  path,
  bytes: (await stat(path)).size,
})));
const largestJavaScriptChunk = fileSizes
  .filter(({ path }) => extname(path) === ".js")
  .reduce((largest, file) => file.bytes > largest.bytes ? file : largest, { path: "", bytes: 0 });

const measurements = {
  workbenchInitialRawBytes: workbench.rawBytes,
  workbenchInitialGzipBytes: workbench.gzipBytes,
  overlayInitialRawBytes: overlay.rawBytes,
  overlayInitialGzipBytes: overlay.gzipBytes,
  largestJavaScriptChunkBytes: largestJavaScriptChunk.bytes,
  rendererOutputBytes: fileSizes.reduce((sum, file) => sum + file.bytes, 0),
};

for (const [name, bytes] of Object.entries(measurements)) {
  const budget = budgets[name];
  const status = bytes <= budget ? "PASS" : "FAIL";
  console.log(`${status} ${name}: ${bytes} / ${budget} bytes`);
}

const failures = Object.entries(measurements).filter(([name, bytes]) => bytes > budgets[name]);
if (failures.length > 0) {
  process.exitCode = 1;
}
