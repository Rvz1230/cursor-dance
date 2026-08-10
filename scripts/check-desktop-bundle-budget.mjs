import { gzipSync } from "node:zlib";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const rendererRoot = resolve(projectRoot, "out/renderer");

const budgets = {
  // 主题级鼠标拖尾新增编辑卡、循环预览、八种材质与独立配方操作。
  // 完整编辑器实测约 1.335 MB / 288.1 KB，gzip 保留约 1% 窄幅余量。
  workbenchInitialRawBytes: 1_340_000,
  workbenchInitialGzipBytes: 291_000,
  // 键盘动效运行时新增窗口锚点、色相推导、拖尾与四种消散方式。
  // 重构前实测基线为 177,415 / 42,147 bytes；能力完整接入后约增加 10 KB / 3 KB。
  // 共享样式调整后 overlay 实测 190,043 bytes；保留不到 1 KB 的窄幅余量。
  // 八种材质完整接入后 overlay 实测 227,504 / 54,631 bytes，保留约 1% 余量。
  overlayInitialRawBytes: 230_000,
  overlayInitialGzipBytes: 55_000,
  largestJavaScriptChunkBytes: 1_100_000,
  // 键盘工作台与应用规则页均为懒加载，初始工作台预算不变；这里只容纳独立页面与样式产物。
  // 当前总量约 2.33 MB；应用规则的脚本与独立样式按需加载，不进入首屏预算。
  // 双入口共享拖尾、轨迹编辑器与独立配方后的完整产物实测约 2.623 MB。
  rendererOutputBytes: 2_650_000,
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
