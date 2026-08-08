import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertReleaseCommit,
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
  await mkdir(mac);
  await Promise.all([
    writeFile(join(mac, "CursorDance-0.6.0-arm64.dmg"), "mac-dmg"),
    writeFile(join(mac, "CursorDance-0.6.0-arm64-mac.zip"), "mac"),
    writeFile(join(mac, "CursorDance-0.6.0-arm64-mac.zip.blockmap"), "mac-map"),
    writeFile(join(mac, "latest-mac.yml"), "mac-yml"),
  ]);
  return root;
}

describe("release artifact gates", () => {
  it("requires the tag to exactly match the package version", () => {
    expect(() => assertReleaseTag("v0.6.0", "0.6.0")).not.toThrow();
    expect(() => assertReleaseTag("v0.6.1", "0.6.0")).toThrow(/does not match/);
  });

  it("requires the release tag to point at the current main commit", () => {
    expect(() => assertReleaseCommit("abc", "abc")).not.toThrow();
    expect(() => assertReleaseCommit("abc", "def")).toThrow(/current origin\/main/);
  });

  it("does not allow a release without all signing credentials", () => {
    expect(() => assertSigningEnvironment("darwin", {
      CSC_LINK: "certificate",
      CSC_KEY_PASSWORD: "password",
      CURSORDANCE_MAC_IDENTITY: "Developer ID Application: CursorDance (TEAMID)",
      APPLE_ID: "release@example.com",
      APPLE_APP_SPECIFIC_PASSWORD: "password",
      APPLE_TEAM_ID: "TEAMID",
    })).not.toThrow();
    expect(() => assertSigningEnvironment("darwin", {})).toThrow(/Missing darwin release signing variables/);
  });

  it("writes stable checksums for the complete macOS artifact set", async () => {
    const root = await createArtifactDirectory();
    const result = await createReleaseChecksums(root);
    const contents = await readFile(result.outputPath, "utf8");

    expect(result.entries).toHaveLength(4);
    expect(contents).toMatch(/^[a-f0-9]{64}  CursorDance-0\.6\.0-arm64\.dmg$/m);
    expect(contents).toMatch(/^[a-f0-9]{64}  CursorDance-0\.6\.0-arm64-mac\.zip$/m);
    expect(contents.endsWith("\n")).toBe(true);
  });

  it("rejects incomplete release artifacts", async () => {
    const root = await createArtifactDirectory();
    await rm(join(root, "mac", "CursorDance-0.6.0-arm64.dmg"));
    await expect(createReleaseChecksums(root)).rejects.toThrow(/macOS DMG/);
  });
});
