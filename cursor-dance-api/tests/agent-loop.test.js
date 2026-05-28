import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createToolExecutor, describeAgentToolCall, AGENT_TOOLS } from "../src/agent-tools.js";
import { sanitizeAiSchemePatch } from "../src/sanitize.js";

describe("createToolExecutor", () => {
  let executor;

  beforeEach(() => {
    executor = createToolExecutor({
      leftClick: {
        textEnabled: true,
        textKind: "数字飘字",
        textMode: "默认模式 (+1)",
        textContent: "+1",
        particle: true,
        particleCount: 18,
        ripple: true,
        rippleSize: 60,
        sound: false,
        volume: 0,
      },
    });
  });

  it("apply_config_patch: sanitizes and merges fields", () => {
    const result = executor.execute("apply_config_patch", {
      actionId: "leftClick",
      patch: { particle: false, particleCount: 0, textColor: "#0369A1" },
    });

    assert.ok(result.ok);
    assert.equal(result.actionId, "leftClick");
    assert.ok(result.appliedCount >= 2);
    assert.ok(result.appliedFields.includes("particle"));
    assert.ok(result.appliedFields.includes("particleCount"));
  });

  it("apply_config_patch: rejects invalid actionId", () => {
    const result = executor.execute("apply_config_patch", {
      actionId: "",
      patch: { textEnabled: true },
    });

    assert.equal(result.ok, false);
    assert.ok(result.error.includes("actionId"));
  });

  it("apply_config_patch: rejects missing patch", () => {
    const result = executor.execute("apply_config_patch", { actionId: "leftClick" });

    assert.equal(result.ok, false);
  });

  it("get_current_config: returns config with effect description", () => {
    const result = executor.execute("get_current_config", { actionId: "leftClick" });

    assert.ok(result.ok);
    assert.equal(result.actionId, "leftClick");
    assert.ok(typeof result.config === "object");
    assert.equal(result.config.textEnabled, true);
    assert.ok(typeof result.effect === "string");
    assert.ok(result.effect.length > 0);
  });

  it("get_current_config: returns empty config for unknown actionId", () => {
    const result = executor.execute("get_current_config", { actionId: "rightClick" });

    assert.ok(result.ok);
    assert.deepStrictEqual(result.config, {});
  });

  it("rollback: restores previous snapshot after apply", () => {
    const before = executor.getConfigs().leftClick;

    executor.execute("apply_config_patch", {
      actionId: "leftClick",
      patch: { particle: false, particleCount: 0 },
    });

    assert.equal(executor.getConfigs().leftClick.particle, false);

    const result = executor.execute("rollback", {});

    assert.ok(result.ok);
    assert.equal(result.remainingSnapshots, 0);
    assert.equal(executor.getConfigs().leftClick.particle, before.particle);
  });

  it("rollback: fails without snapshots", () => {
    const result = executor.execute("rollback", {});

    assert.equal(result.ok, false);
    assert.ok(result.error.includes("没有可回滚"));
  });

  it("apply_config_patch: creates snapshot for each apply", () => {
    assert.equal(executor.getSnapshots(), 0);

    executor.execute("apply_config_patch", {
      actionId: "leftClick",
      patch: { shake: 20 },
    });

    assert.equal(executor.getSnapshots(), 1);

    executor.execute("apply_config_patch", {
      actionId: "leftClick",
      patch: { shake: 40 },
    });

    assert.equal(executor.getSnapshots(), 2);
  });

  it("apply_config_patch: applies intent repair via requestState", () => {
    const result = executor.execute(
      "apply_config_patch",
      { actionId: "leftClick", patch: { sound: false } },
      { prompt: "不要声音", actionId: "leftClick", currentConfig: executor.getConfigs().leftClick }
    );

    assert.ok(result.ok);
    const configs = executor.getConfigs();
    assert.equal(configs.leftClick.sound, false);
    assert.equal(configs.leftClick.volume, 0);
  });

  it("apply_config_patch: rejects non-patch values via sanitize", () => {
    const result = executor.execute("apply_config_patch", {
      actionId: "leftClick",
      patch: { textEnabled: 123, fontSize: 999, unknownField: "xss" },
    });

    assert.ok(result.ok);
    const configs = executor.getConfigs();
    assert.ok(typeof configs.leftClick.textEnabled === "boolean");
    assert.ok(configs.leftClick.fontSize === undefined || configs.leftClick.fontSize <= 36);
    assert.equal(configs.leftClick.unknownField, undefined);
  });

  it("unknown tool returns error", () => {
    const result = executor.execute("unknown_tool", {});

    assert.equal(result.ok, false);
    assert.ok(result.error.includes("未知工具"));
  });
});

describe("AGENT_TOOLS", () => {
  it("has four tool definitions", () => {
    assert.equal(AGENT_TOOLS.length, 4);
  });

  it("all tools have required fields", () => {
    for (const tool of AGENT_TOOLS) {
      assert.equal(tool.type, "function");
      assert.ok(tool.function.name);
      assert.ok(tool.function.description);
      assert.ok(tool.function.parameters);
      assert.equal(tool.function.parameters.type, "object");
    }
  });

  it("tool names are unique", () => {
    const names = AGENT_TOOLS.map((t) => t.function.name);
    assert.equal(new Set(names).size, names.length);
  });

  it("apply_config_patch requires actionId and patch", () => {
    const tool = AGENT_TOOLS.find((t) => t.function.name === "apply_config_patch");
    assert.ok(tool);
    assert.deepStrictEqual(tool.function.parameters.required, ["actionId", "patch"]);
  });

  it("get_current_config requires actionId", () => {
    const tool = AGENT_TOOLS.find((t) => t.function.name === "get_current_config");
    assert.ok(tool);
    assert.deepStrictEqual(tool.function.parameters.required, ["actionId"]);
  });

  it("finalize_proposal requires scheme, reply, riskLevel, tuningOptions", () => {
    const tool = AGENT_TOOLS.find((t) => t.function.name === "finalize_proposal");
    assert.ok(tool);
    assert.deepStrictEqual(
      tool.function.parameters.required,
      ["scheme", "reply", "riskLevel", "tuningOptions"]
    );
  });
});

describe("describeAgentToolCall", () => {
  it("describes apply_config_patch", () => {
    const result = describeAgentToolCall({
      function: {
        name: "apply_config_patch",
        arguments: { actionId: "leftClick", patch: { particle: false, particleCount: 0, sound: false } },
      },
    });

    assert.ok(result.includes("leftClick"));
    assert.ok(result.includes("3"));
    assert.ok(result.includes("particle"));
  });

  it("describes get_current_config", () => {
    const result = describeAgentToolCall({
      function: {
        name: "get_current_config",
        arguments: { actionId: "rightClick" },
      },
    });

    assert.ok(result.includes("rightClick"));
    assert.ok(result.includes("读取"));
  });

  it("describes finalize_proposal", () => {
    const result = describeAgentToolCall({
      function: { name: "finalize_proposal", arguments: {} },
    });

    assert.ok(result.includes("最终方案"));
  });

  it("handles unknown tool name", () => {
    const result = describeAgentToolCall({
      function: { name: "some_tool", arguments: {} },
    });

    assert.equal(result, "some_tool");
  });

  it("handles null toolCall", () => {
    assert.equal(describeAgentToolCall(null), "未知工具调用");
    assert.equal(describeAgentToolCall(undefined), "未知工具调用");
  });
});

describe("agent loop integration", () => {
  it("runAgentLoop is importable", async () => {
    const { runAgentLoop } = await import("../src/agent-loop.mjs");
    assert.equal(typeof runAgentLoop, "function");
  });

  it("runAgentLoop returns error without API key", async () => {
    const { runAgentLoop } = await import("../src/agent-loop.mjs");

    const result = await runAgentLoop({
      prompt: "test",
      actionId: "leftClick",
      currentConfig: {},
      env: {},
      maxSteps: 1,
    });

    assert.equal(result.ok, false);
    assert.ok(result.error || result.steps?.length >= 0);
  });
});
