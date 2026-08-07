import { gzipSync } from "node:zlib";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const rendererRoot = resolve(projectRoot, "out/renderer");

const budgets = {
  workbenchInitialRawBytes: 1_250_000,
  workbenchInitialGzipBytes: 270_000,
  // 键盘动效运行时新增窗口锚点、色相推导、拖尾与四种消散方式。
  // 重构前实测基线为 177,415 / 42,147 bytes；能力完整接入后约增加 10 KB / 3 KB。
  overlayInitialRawBytes: 190_000,
  overlayInitialGzipBytes: 47_000,
  largestJavaScriptChunkBytes: 1_100_000,
  // 新键盘工作台本身为懒加载，初始工作台预算不变；这里只容纳其独立页面与样式产物。
  // 重构前 renderer 总量实测 2,194,210 bytes，本批新增约 45 KB。
  rendererOutputBytes: 2_250_000,
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
