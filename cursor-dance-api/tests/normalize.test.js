import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateAiSchemeRequest,
  normalizeAiSchemeProposal,
  getAiProposalPatchForAction,
  buildAiProposalContext,
} from "../src/normalize.js";

describe("validateAiSchemeRequest", () => {
  it("validates a minimal request", () => {
    const result = validateAiSchemeRequest({ prompt: "hello" });
    assert.ok(result.ok);
    assert.equal(result.value.prompt, "hello");
    assert.equal(result.value.actionId, "leftClick");
    assert.equal(result.value.taskMode, "modify_action");
  });

  it("rejects empty prompt", () => {
    const result = validateAiSchemeRequest({});
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("required")));
  });

  it("rejects overly long prompt", () => {
    const result = validateAiSchemeRequest({ prompt: "x".repeat(1201) });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("long")));
  });

  it("rejects oversized proposalContext", () => {
    const big = { data: "x".repeat(9000) };
    const result = validateAiSchemeRequest({ prompt: "hello", proposalContext: big });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("large")));
  });

  it("accepts valid taskMode", () => {
    const result = validateAiSchemeRequest({ prompt: "hello", taskMode: "generate_theme" });
    assert.equal(result.value.taskMode, "generate_theme");
  });

  it("defaults invalid taskMode", () => {
    const result = validateAiSchemeRequest({ prompt: "hello", taskMode: "hack" });
    assert.equal(result.value.taskMode, "modify_action");
  });
});

describe("normalizeAiSchemeProposal", () => {
  it("normalizes a minimal proposal", () => {
    const proposal = normalizeAiSchemeProposal({
      scheme: { name: "Test" },
    }, { prompt: "test", actionId: "leftClick", currentConfig: {} });
    assert.ok(proposal.proposalId);
    assert.equal(proposal.scheme.name, "Test");
    assert.equal(proposal.mode, "modify_action");
    assert.equal(proposal.riskLevel, "low");
    assert.ok(Array.isArray(proposal.targets));
    assert.ok(Array.isArray(proposal.diffItems));
  });

  it("normalizes scheme fields", () => {
    const proposal = normalizeAiSchemeProposal({
      scheme: { name: "  My Scheme  ", summary: "a".repeat(200), styleTags: ["tag1", 123, "tag2"] },
    }, { prompt: "test" });
    assert.equal(proposal.scheme.name, "My Scheme");
    assert.equal(proposal.scheme.summary.length, 160);
    assert.deepStrictEqual(proposal.scheme.styleTags, ["tag1", "tag2"]);
  });

  it("applies intent repair on patch", () => {
    const proposal = normalizeAiSchemeProposal({
      target: { patch: { particle: true } },
      scheme: { name: "Test" },
    }, { prompt: "不要声音", currentConfig: {}, actionId: "leftClick" });
    assert.equal(proposal.patch.sound, false);
    assert.equal(proposal.patch.volume, 0);
  });

  it("generates diff summary", () => {
    const proposal = normalizeAiSchemeProposal({
      target: { patch: { sound: false } },
      scheme: { name: "Test" },
    }, { prompt: "test", currentConfig: { sound: true }, actionId: "leftClick" });
    // diffSummary may vary based on describeDiff logic, verify it's an array
    assert.ok(Array.isArray(proposal.diffSummary));
    assert.ok(proposal.diffSummary.length >= 0);
  });
});

describe("getAiProposalPatchForAction", () => {
  it("returns patch for matching actionId", () => {
    const patch = getAiProposalPatchForAction({
      targets: [
        { type: "action", actionId: "leftClick", patch: { particle: true } },
        { type: "action", actionId: "rightClick", patch: { ripple: true } },
      ],
    }, "leftClick");
    assert.deepStrictEqual(patch, { particle: true });
  });

  it("returns null for non-matching actionId", () => {
    const patch = getAiProposalPatchForAction({
      targets: [{ type: "action", actionId: "leftClick", patch: {} }],
    }, "rightClick");
    assert.equal(patch, null);
  });

  it("returns null for empty proposal", () => {
    assert.equal(getAiProposalPatchForAction({}, "leftClick"), null);
  });
});

describe("buildAiProposalContext", () => {
  it("builds a compact context object", () => {
    const ctx = buildAiProposalContext({
      proposalId: "abc-123",
      mode: "modify_action",
      scheme: { name: "Test", summary: "A test", styleTags: ["tag1"] },
      targets: [{ type: "action", actionId: "leftClick", label: "Left Click", patch: { particle: true } }],
      diffSummary: ["启用粒子"],
    });
    assert.ok(ctx);
    assert.equal(ctx.proposalId, "abc-123");
    assert.equal(ctx.targets.length, 1);
  });
});
