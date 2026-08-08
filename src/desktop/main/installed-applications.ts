import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { app, ipcMain } from "electron";
import type { InstalledApplication } from "../../shared/desktop-ipc-contracts";
import { APP_LIST_INSTALLED_APPLICATIONS } from "../../shared/ipc-channels";
import { assertIpcSender } from "./ipc-security";

const execFileAsync = promisify(execFile);
const MAC_APPLICATION_DIRECTORIES = [
  "/Applications",
  "/Applications/Utilities",
  "/System/Applications",
  "/System/Applications/Utilities",
  join(homedir(), "Applications"),
];

export function applicationNameFromBundlePath(path: string): string {
  return basename(path).replace(/\.app$/i, "");
}

async function readPlistValue(path: string, key: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("/usr/bin/plutil", [
      "-extract",
      key,
      "raw",
      join(path, "Contents", "Info.plist"),
    ]);
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function listApplicationBundles(): Promise<string[]> {
  const results = await Promise.all(MAC_APPLICATION_DIRECTORIES.map(async (directory) => {
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      return entries
        .filter((entry) => entry.name.toLocaleLowerCase().endsWith(".app"))
        .map((entry) => join(directory, entry.name));
    } catch {
      return [];
    }
  }));
  return [...new Set(results.flat())];
}

async function describeApplication(path: string): Promise<InstalledApplication> {
  const name = applicationNameFromBundlePath(path);
  const [bundleId, executable, icon] = await Promise.all([
    readPlistValue(path, "CFBundleIdentifier"),
    readPlistValue(path, "CFBundleExecutable"),
    app.getFileIcon(path, { size: "normal" }).catch(() => null),
  ]);
  return {
    name,
    processName: executable || name,
    ...(bundleId ? { bundleId } : {}),
    ...(icon && !icon.isEmpty() ? { iconDataUrl: icon.toDataURL() } : {}),
  };
}

async function listInstalledApplications(): Promise<InstalledApplication[]> {
  if (process.platform !== "darwin") return [];
  const paths = await listApplicationBundles();
  const applications: InstalledApplication[] = [];
  for (let index = 0; index < paths.length; index += 8) {
    applications.push(...await Promise.all(paths.slice(index, index + 8).map(describeApplication)));
  }
  return applications.sort((left, right) => left.name.localeCompare(right.name));
}

export function registerInstalledApplicationsIpc(): void {
  ipcMain.handle(APP_LIST_INSTALLED_APPLICATIONS, (event) => {
    assertIpcSender(event, APP_LIST_INSTALLED_APPLICATIONS);
    return listInstalledApplications();
  });
}

export function unregisterInstalledApplicationsIpc(): void {
  ipcMain.removeHandler(APP_LIST_INSTALLED_APPLICATIONS);
}
