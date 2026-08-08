import { constants } from "node:fs";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { basename, join, relative } from "node:path";
import { listPackage } from "@electron/asar";
import { getPackagedDesktopPaths, listFilesRecursively } from "./packaged-desktop-paths.mjs";

const paths = await getPackagedDesktopPaths();
const resources = paths.resourcesDirectory;
const asarPath = join(resources, "app.asar");
const unpacked = join(resources, "app.asar.unpacked", "node_modules");
const helperName = paths.platform === "win32"
  ? "cursordance-cursor-helper.exe"
  : "cursordance-cursor-helper";
const helperPath = join(resources, "native", helperName);
const uiohookBinary = join(unpacked, "uiohook-napi", "build", "Release", "uiohook_napi.node");
const getWindowsRoot = join(unpacked, "get-windows");

async function requirePath(path, mode = constants.F_OK) {
  await access(path, mode);
  console.info(`[desktop-package] found ${relative(paths.outputDirectory, path)}`);
}

async function verifyMacArchitecture(path) {
  const result = spawnSync("lipo", ["-archs", path], { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim());
  const architectures = result.stdout.trim().split(/\s+/);
  if (!architectures.includes(paths.architecture)) {
    throw new Error(`${relative(paths.outputDirectory, path)} has ${architectures.join(", ")}, expected ${paths.architecture}`);
  }
}

async function verifyWindowsArchitecture(path) {
  const binary = await readFile(path);
  if (binary.toString("ascii", 0, 2) !== "MZ") throw new Error(`${path} is not a PE binary`);
  const peOffset = binary.readUInt32LE(0x3c);
  if (binary.toString("ascii", peOffset, peOffset + 4) !== "PE\0\0") {
    throw new Error(`${path} has an invalid PE header`);
  }
  const machine = binary.readUInt16LE(peOffset + 4);
  if (machine !== 0x8664) throw new Error(`${path} has PE machine 0x${machine.toString(16)}, expected x64`);
}

async function verifyArchitecture(path) {
  if (paths.platform === "darwin") await verifyMacArchitecture(path);
  else await verifyWindowsArchitecture(path);
}

function verifyWindowsSignature(path) {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "(Get-AuthenticodeSignature -LiteralPath $env:CURSORDANCE_VERIFY_SIGNATURE_PATH).Status",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, CURSORDANCE_VERIFY_SIGNATURE_PATH: path },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0 || result.stdout.trim() !== "Valid") {
    throw new Error(`Windows signature verification failed for ${basename(path)}: ${result.stdout.trim() || result.stderr.trim()}`);
  }
}

function runMacCheck(command, args, description) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${description} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  console.info(`[desktop-package] ${description}: verified`);
}

async function verifyHelperProtocol() {
  const child = spawn(helperPath, [], { stdio: ["pipe", "pipe", "pipe"] });
  const statuses = [];
  let stdoutBuffer = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdoutBuffer += String(chunk);
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      statuses.push(line);
      if (line === "ready") child.stdin.end("ping\nshow\nquit\n");
    }
  });
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });

  const timeout = setTimeout(() => child.kill(), 5_000);
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  clearTimeout(timeout);
  if (exitCode !== 0) throw new Error(`Packaged cursor helper exited with ${exitCode}: ${stderr.trim()}`);
  for (const status of ["ready", "pong", "shown"]) {
    if (!statuses.includes(status)) throw new Error(`Packaged cursor helper omitted ${status}: ${statuses.join(", ")}`);
  }
  console.info(`[desktop-package] helper protocol: ${statuses.join(" -> ")}`);
}

await Promise.all([
  requirePath(paths.executablePath, paths.platform === "darwin" ? constants.X_OK : constants.F_OK),
  requirePath(asarPath),
  requirePath(join(resources, "app-update.yml")),
  requirePath(join(resources, "extension", "manifest.json")),
  requirePath(join(resources, "extension", "icon-16.png")),
  requirePath(helperPath, paths.platform === "darwin" ? constants.X_OK : constants.F_OK),
  requirePath(uiohookBinary),
]);

const getWindowsBinaries = (await listFilesRecursively(getWindowsRoot)).filter((path) => {
  if (paths.platform === "darwin") return basename(path) === "main";
  return basename(path) === "node-get-windows.node" && path.includes("win32") && path.includes("x64");
});
if (getWindowsBinaries.length === 0) {
  throw new Error(`get-windows has no ${paths.platform}-${paths.architecture} runtime binary`);
}

await Promise.all([
  verifyArchitecture(paths.executablePath),
  verifyArchitecture(helperPath),
  verifyArchitecture(uiohookBinary),
  ...getWindowsBinaries.map(verifyArchitecture),
]);
await verifyHelperProtocol();

const asarEntries = new Set(listPackage(asarPath));
for (const requiredEntry of [
  "/package.json",
  "/out/main/index.js",
  "/out/preload/index.js",
  "/out/renderer/workbench/index.html",
  "/out/renderer/overlay/index.html",
]) {
  if (!asarEntries.has(requiredEntry)) throw new Error(`app.asar is missing ${requiredEntry}`);
}

const updateConfig = await readFile(join(resources, "app-update.yml"), "utf8");
for (const expectedLine of ["provider: github", "owner: Rvz1230", "repo: cursor-dance"]) {
  if (!updateConfig.includes(expectedLine)) throw new Error(`app-update.yml is missing ${expectedLine}`);
}

const outputNames = await readdir(paths.outputDirectory);
const artifactPattern = paths.platform === "darwin" ? /\.zip$/ : /\.exe$/i;
const installerPaths = outputNames
  .filter((name) => artifactPattern.test(name))
  .map((name) => join(paths.outputDirectory, name));
const dmgPaths = outputNames
  .filter((name) => name.toLowerCase().endsWith(".dmg"))
  .map((name) => join(paths.outputDirectory, name));
const metadataName = paths.platform === "darwin" ? "latest-mac.yml" : "latest.yml";
if (installerPaths.length === 0) throw new Error("Packaged desktop installer artifact is missing");
if (paths.platform === "darwin" && process.env.CURSORDANCE_PACKAGE_DMG === "1" && dmgPaths.length !== 1) {
  throw new Error(`Expected exactly one macOS DMG; found ${dmgPaths.length}`);
}
if (!outputNames.includes(metadataName)) throw new Error(`${metadataName} is missing`);
const updateBlockmapPattern = paths.platform === "darwin" ? /\.zip\.blockmap$/ : /\.exe\.blockmap$/i;
if (!outputNames.some((name) => updateBlockmapPattern.test(name))) throw new Error("Update blockmap is missing");
const updateMetadata = await readFile(join(paths.outputDirectory, metadataName), "utf8");
if (!installerPaths.some((path) => updateMetadata.includes(basename(path)))) {
  throw new Error(`${metadataName} does not reference the packaged update artifact`);
}

if (paths.platform === "darwin") {
  await requirePath(join(paths.appDirectory, "Contents", "Info.plist"));
  await requirePath(join(resources, "icon.icns"));
  const requireSignature = process.env.CURSORDANCE_REQUIRE_SIGNATURE === "1";
  const signature = spawnSync("codesign", ["--verify", "--deep", "--strict", paths.appDirectory], { encoding: "utf8" });
  if (requireSignature && signature.status !== 0) {
    throw new Error(`macOS signature verification failed: ${signature.stderr.trim()}`);
  }
  if (requireSignature) {
    const details = spawnSync("codesign", ["-dv", "--verbose=4", paths.appDirectory], { encoding: "utf8" });
    if (details.status !== 0 || !details.stderr.includes("Authority=Developer ID Application:")) {
      throw new Error(`macOS release is not signed with Developer ID Application: ${details.stderr.trim()}`);
    }
    runMacCheck(
      "spctl",
      ["--assess", "--type", "execute", "--verbose=4", paths.appDirectory],
      "Gatekeeper app assessment",
    );
  }
  for (const dmgPath of dmgPaths) {
    runMacCheck("hdiutil", ["verify", dmgPath], `DMG integrity (${basename(dmgPath)})`);
    if (requireSignature) {
      runMacCheck(
        "spctl",
        ["--assess", "--type", "open", "--context", "context:primary-signature", "--verbose=4", dmgPath],
        `Gatekeeper DMG assessment (${basename(dmgPath)})`,
      );
    }
  }
  if (process.env.CURSORDANCE_REQUIRE_NOTARIZATION === "1") {
    runMacCheck("xcrun", ["stapler", "validate", paths.appDirectory], "app notarization ticket");
    for (const dmgPath of dmgPaths) {
      runMacCheck(
        "xcrun",
        ["stapler", "validate", dmgPath],
        `DMG notarization ticket (${basename(dmgPath)})`,
      );
    }
  }
  console.info(`[desktop-package] signature: ${signature.status === 0 ? "verified" : "unsigned (expected until R6-4)"}`);
} else if (process.env.CURSORDANCE_REQUIRE_SIGNATURE === "1") {
  verifyWindowsSignature(paths.executablePath);
  verifyWindowsSignature(helperPath);
  installerPaths.forEach(verifyWindowsSignature);
  console.info("[desktop-package] Windows signatures: verified");
}

const appStats = await stat(paths.appDirectory);
if (!appStats.isDirectory()) throw new Error("Unpacked desktop application is not a directory");
console.info(`[desktop-package] verified ${paths.platform}-${paths.architecture}`);
