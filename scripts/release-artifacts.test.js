import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertReleaseTag,
  assertSigningEnvironment,
  createReleaseChecksums,
} from "./release-artifacts.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function createArtifactDirectory() {
  const root = await mkdtemp(join(tmpdir(), "cursordance-release-"));
  temporaryDirectories.push(root);
  const mac = join(root, "mac");
  const windows = join(root, "windows");
  await Promise.all([mkdir(mac), mkdir(windows)]);
  await Promise.all([
    writeFile(join(mac, "CursorDance-0.6.0-arm64-mac.zip"), "mac"),
    writeFile(join(mac, "CursorDance-0.6.0-arm64-mac.zip.blockmap"), "mac-map"),
    writeFile(join(mac, "latest-mac.yml"), "mac-yml"),
    writeFile(join(windows, "CursorDance Setup 0.6.0.exe"), "win"),
    writeFile(join(windows, "CursorDance Setup 0.6.0.exe.blockmap"), "win-map"),
    writeFile(join(windows, "latest.yml"), "win-yml"),
  ]);
  return root;
}

describe("release artifact gates", () => {
  it("requires the tag to exactly match the package version", () => {
    expect(() => assertReleaseTag("v0.6.0", "0.6.0")).not.toThrow();
    expect(() => assertReleaseTag("v0.6.1", "0.6.0")).toThrow(/does not match/);
  });

  it("does not allow a release without all signing credentials", () => {
    expect(() => assertSigningEnvironment("win32", {
      CSC_LINK: "certificate",
      CSC_KEY_PASSWORD: "password",
    })).not.toThrow();
    expect(() => assertSigningEnvironment("darwin", {})).toThrow(/Missing darwin release signing variables/);
  });

  it("writes stable checksums for the complete cross-platform artifact set", async () => {
    const root = await createArtifactDirectory();
    const result = await createReleaseChecksums(root);
    const contents = await readFile(result.outputPath, "utf8");

    expect(result.entries).toHaveLength(6);
    expect(contents).toMatch(/^[a-f0-9]{64}  CursorDance-0\.6\.0-arm64-mac\.zip$/m);
    expect(contents).toContain("CursorDance Setup 0.6.0.exe");
    expect(contents.endsWith("\n")).toBe(true);
  });

  it("rejects incomplete release artifacts", async () => {
    const root = await createArtifactDirectory();
    await rm(join(root, "windows", "latest.yml"));
    await expect(createReleaseChecksums(root)).rejects.toThrow(/Windows update metadata/);
  });
});
