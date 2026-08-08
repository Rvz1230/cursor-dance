import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { updateDmgMetadata } from "./notarize-macos-dmg.mjs";

let root;

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
  root = undefined;
});

describe("notarized DMG metadata", () => {
  it("refreshes sha512 and size and removes the stale blockmap", async () => {
    root = await mkdtemp(join(tmpdir(), "cursordance-dmg-metadata-"));
    const dmgPath = join(root, "CursorDance-0.6.1-arm64.dmg");
    const metadataPath = join(root, "latest-mac.yml");
    const contents = Buffer.from("stapled-dmg-contents");
    await writeFile(dmgPath, contents);
    await writeFile(`${dmgPath}.blockmap`, "stale");
    await writeFile(metadataPath, [
      "version: 0.6.1",
      "files:",
      "  - url: CursorDance-0.6.1-arm64-mac.zip",
      "    sha512: zip-hash",
      "    size: 10",
      "  - url: CursorDance-0.6.1-arm64.dmg",
      "    sha512: old-hash",
      "    size: 1",
      "path: CursorDance-0.6.1-arm64-mac.zip",
      "sha512: zip-hash",
      "",
    ].join("\n"));

    await updateDmgMetadata(dmgPath, metadataPath);

    const expectedHash = createHash("sha512").update(contents).digest("base64");
    const metadata = await readFile(metadataPath, "utf8");
    expect(metadata).toContain(`    sha512: ${expectedHash}`);
    expect(metadata).toContain(`    size: ${contents.length}`);
    await expect(readFile(`${dmgPath}.blockmap`)).rejects.toThrow();
  });
});
