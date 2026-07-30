import { access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";

export const projectRoot = resolve(import.meta.dirname, "..");

export function getPackageTarget() {
  const platform = process.env.CURSORDANCE_PACKAGE_PLATFORM || process.platform;
  const architecture = process.env.CURSORDANCE_PACKAGE_ARCH || process.arch;
  return {
    platform,
    architecture,
    outputDirectory: join(projectRoot, "release", `ci-${platform}-${architecture}`),
  };
}

export async function getPackagedDesktopPaths() {
  const target = getPackageTarget();
  let appDirectory;
  let executablePath;
  let resourcesDirectory;

  if (target.platform === "darwin") {
    const unpackedDirectory = target.architecture === "arm64" ? "mac-arm64" : "mac";
    appDirectory = join(target.outputDirectory, unpackedDirectory, "CursorDance.app");
    executablePath = join(appDirectory, "Contents", "MacOS", "CursorDance");
    resourcesDirectory = join(appDirectory, "Contents", "Resources");
  } else if (target.platform === "win32") {
    appDirectory = join(target.outputDirectory, "win-unpacked");
    executablePath = join(appDirectory, "CursorDance.exe");
    resourcesDirectory = join(appDirectory, "resources");
  } else {
    throw new Error(`Unsupported packaged desktop platform: ${target.platform}`);
  }

  await access(executablePath, constants.F_OK);
  return { ...target, appDirectory, executablePath, resourcesDirectory };
}

export async function listFilesRecursively(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listFilesRecursively(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}
