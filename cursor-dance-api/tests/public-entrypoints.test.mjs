import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as core from "cursor-dance-api/core";
import * as client from "cursor-dance-api/client";
import * as service from "cursor-dance-api/service";

describe("cursor-dance-api public entrypoints", () => {
  it("exposes browser-safe core helpers", () => {
    assert.equal(typeof core.AI_SCHEMA_VERSION, "string");
    assert.equal(typeof core.normalizeAiSchemeProposal, "function");
    assert.equal(typeof core.sanitizeAiSchemePatch, "function");
  });

  it("exposes the remote client without internal paths", () => {
    assert.equal(typeof client.requestAiSchemeEditStreaming, "function");
    assert.equal(typeof client.requestAiAgentRun, "function");
  });

  it("exposes the in-process service used by Electron", () => {
    assert.equal(typeof service.createAiSchemeProposalStreaming, "function");
    assert.equal(typeof service.createAiAgentProposal, "function");
  });
});
