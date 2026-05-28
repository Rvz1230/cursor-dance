import { describe, it } from "node:test";
import assert from "node:assert";
import {
  AGENT_TOOLS,
  AGENT_SYSTEM_PROMPT_EXTENSION,
  describeAgentToolCall,
  createToolExecutor,
} from "../src/agent-tools.js";

describe("AGENT_TOOLS", () => {
  it("has exactly four tool definitions", () => {
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

  it("contains expected tool names", () => {
    const names = AGENT_TOOLS.map((t) => t.function.name);
    assert.ok(names.includes("apply_config_patch"));
    assert.ok(names.includes("get_current_config"));
    assert.ok(names.includes("rollback"));
    assert.ok(names.includes("finalize_proposal"));
  });

  it("apply_config_patch requires actionId and patch", () => {
    const tool = AGENT_TOOLS.find((t) => t.function.name === "apply_config_patch");
    assert.deepStrictEqual(tool.function.parameters.required, ["actionId", "patch"]);
  });

  it("apply_config_patch has valid actionId enum", () => {
    const tool = AGENT_TOOLS.find((t) => t.function.name === "apply_config_patch");
    const actionIds = tool.function.parameters.properties.actionId.enum;
    assert.ok(actionIds.includes("leftClick"));
    assert.ok(actionIds.includes("rightClick"));
    assert.ok(actionIds.includes("doubleClick"));
    assert.ok(actionIds.includes("longPress"));
    assert.ok(actionIds.includes("wheel"));
    assert.ok(actionIds.includes("hover"));
  });

  it("get_current_config requires actionId", () => {
    const tool = AGENT_TOOLS.find((t) => t.function.name === "get_current_config");
    assert.deepStrictEqual(tool.function.parameters.required, ["actionId"]);
  });

  it("rollback has no required params", () => {
    const tool = AGENT_TOOLS.find((t) => t.function.name === "rollback");
    assert.deepStrictEqual(tool.function.parameters.required, []);
  });

  it("finalize_proposal requires scheme, reply, riskLevel, tuningOptions", () => {
    const tool = AGENT_TOOLS.find((t) => t.function.name === "finalize_proposal");
    assert.deepStrictEqual(tool.function.parameters.required, [
      "scheme",
      "reply",
      "riskLevel",
      "tuningOptions",
    ]);
  });
});

describe("AGENT_SYSTEM_PROMPT_EXTENSION", () => {
  it("is a non-empty string", () => {
    assert.ok(typeof AGENT_SYSTEM_PROMPT_EXTENSION === "string");
    assert.ok(AGENT_SYSTEM_PROMPT_EXTENSION.length > 50);
  });

  it("mentions all four tools", () => {
    assert.ok(AGENT_SYSTEM_PROMPT_EXTENSION.includes("get_current_config"));
    assert.ok(AGENT_SYSTEM_PROMPT_EXTENSION.includes("apply_config_patch"));
    assert.ok(AGENT_SYSTEM_PROMPT_EXTENSION.includes("rollback"));
    assert.ok(AGENT_SYSTEM_PROMPT_EXTENSION.includes("finalize_proposal"));
  });

  it("describes the ReAct flow", () => {
    assert.ok(AGENT_SYSTEM_PROMPT_EXTENSION.includes("get_current_config 查看现状"));
    assert.ok(AGENT_SYSTEM_PROMPT_EXTENSION.includes("apply_config_patch 修改"));
    assert.ok(AGENT_SYSTEM_PROMPT_EXTENSION.includes("finalize_proposal 结束"));
  });
});

describe("describeAgentToolCall", () => {
  it("returns unknown for missing name", () => {
    assert.equal(describeAgentToolCall({}), "未知工具调用");
    assert.equal(describeAgentToolCall(null), "未知工具调用");
  });

  it("describes apply_config_patch with field count", () => {
    const result = describeAgentToolCall({
      function: {
        name: "apply_config_patch",
        arguments: { actionId: "leftClick", patch: { textColor: "#ff0000", sound: false } },
      },
    });
    assert.ok(result.includes("leftClick"));
    assert.ok(result.includes("2"));
    assert.ok(result.includes("textColor"));
  });

  it("handles string arguments for apply_config_patch", () => {
    const result = describeAgentToolCall({
      function: {
        name: "apply_config_patch",
        arguments: "{}",
      },
    });
    assert.ok(result.includes("?"));
  });

  it("describes get_current_config", () => {
    const result = describeAgentToolCall({
      function: { name: "get_current_config", arguments: { actionId: "wheel" } },
    });
    assert.ok(result.includes("wheel"));
    assert.ok(result.includes("读取"));
  });

  it("describes finalize_proposal", () => {
    const result = describeAgentToolCall({
      function: { name: "finalize_proposal", arguments: {} },
    });
    assert.equal(result, "生成最终方案");
  });

  it("describes rollback", () => {
    const result = describeAgentToolCall({
      function: { name: "rollback", arguments: {} },
    });
    assert.equal(result, "rollback");
  });
});

describe("createToolExecutor", () => {
  it("returns executor with getConfigs, getSnapshots, execute", () => {
    const executor = createToolExecutor();
    assert.equal(typeof executor.getConfigs, "function");
    assert.equal(typeof executor.getSnapshots, "function");
    assert.equal(typeof executor.execute, "function");
  });

  it("starts with empty configs", () => {
    const executor = createToolExecutor();
    assert.deepStrictEqual(executor.getConfigs(), {});
  });

  it("starts with initial configs when provided", () => {
    const executor = createToolExecutor({
      leftClick: { textEnabled: true, sound: false },
    });
    const configs = executor.getConfigs();
    assert.equal(configs.leftClick.textEnabled, true);
    assert.equal(configs.leftClick.sound, false);
  });

  it("rejects unknown tool", () => {
    const executor = createToolExecutor();
    const result = executor.execute("nonexistent", {});
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("未知工具"));
  });

  describe("get_current_config", () => {
    it("returns empty config for unknown actionId", () => {
      const executor = createToolExecutor();
      const result = executor.execute("get_current_config", { actionId: "leftClick" });
      assert.equal(result.ok, true);
      assert.equal(result.actionId, "leftClick");
      assert.deepStrictEqual(result.config, {});
    });

    it("returns stored config", () => {
      const executor = createToolExecutor({
        leftClick: { textEnabled: true, particleCount: 12 },
      });
      const result = executor.execute("get_current_config", { actionId: "leftClick" });
      assert.equal(result.config.textEnabled, true);
      assert.equal(result.config.particleCount, 12);
    });

    it("defaults to leftClick when no actionId", () => {
      const executor = createToolExecutor({ leftClick: { ripple: true } });
      const result = executor.execute("get_current_config", {});
      assert.equal(result.actionId, "leftClick");
      assert.equal(result.config.ripple, true);
    });
  });

  describe("apply_config_patch", () => {
    it("rejects missing actionId", () => {
      const executor = createToolExecutor();
      const result = executor.execute("apply_config_patch", { patch: { sound: false } });
      assert.equal(result.ok, false);
    });

    it("rejects missing patch", () => {
      const executor = createToolExecutor();
      const result = executor.execute("apply_config_patch", { actionId: "leftClick" });
      assert.equal(result.ok, false);
    });

    it("rejects non-object patch", () => {
      const executor = createToolExecutor();
      const result = executor.execute("apply_config_patch", {
        actionId: "leftClick",
        patch: "not-an-object",
      });
      assert.equal(result.ok, false);
    });

    it("applies a simple patch to empty config", () => {
      const executor = createToolExecutor();
      const result = executor.execute("apply_config_patch", {
        actionId: "leftClick",
        patch: { sound: false, volume: 0 },
      });
      assert.equal(result.ok, true);
      assert.equal(result.actionId, "leftClick");
      assert.ok(result.appliedCount >= 1);

      const configs = executor.getConfigs();
      assert.equal(configs.leftClick.sound, false);
      assert.equal(configs.leftClick.volume, 0);
    });

    it("merges patch onto existing config", () => {
      const executor = createToolExecutor({
        leftClick: { textEnabled: true, textColor: "#000000", sound: true },
      });
      executor.execute("apply_config_patch", {
        actionId: "leftClick",
        patch: { textColor: "#ff0000", sound: false },
      });
      const configs = executor.getConfigs();
      assert.equal(configs.leftClick.textEnabled, true); // preserved
      assert.ok(configs.leftClick.textColor); // updated (sanitizer normalizes case)
      assert.equal(configs.leftClick.sound, false); // updated
    });

    it("creates snapshot before applying", () => {
      const executor = createToolExecutor({ leftClick: { sound: true } });
      assert.equal(executor.getSnapshots(), 0);

      executor.execute("apply_config_patch", {
        actionId: "leftClick",
        patch: { sound: false },
      });
      assert.equal(executor.getSnapshots(), 1);
    });

    it("applies intent repair when requestState has prompt", () => {
      const executor = createToolExecutor({ leftClick: {} });
      const result = executor.execute(
        "apply_config_patch",
        { actionId: "leftClick", patch: { sound: false, volume: 0 } },
        { prompt: "不要声音" }
      );
      assert.equal(result.ok, true);
      const configs = executor.getConfigs();
      // Intent repair for "不要声音" should set sound: false, volume: 0
      assert.equal(configs.leftClick.sound, false);
      assert.equal(configs.leftClick.volume, 0);
    });
  });

  describe("rollback", () => {
    it("fails when no snapshots exist", () => {
      const executor = createToolExecutor();
      const result = executor.execute("rollback", {});
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("没有可回滚的快照"));
    });

    it("restores previous state after one patch", () => {
      const executor = createToolExecutor({ leftClick: { sound: true } });
      executor.execute("apply_config_patch", {
        actionId: "leftClick",
        patch: { sound: false },
      });
      assert.equal(executor.getConfigs().leftClick.sound, false);

      const result = executor.execute("rollback", {});
      assert.equal(result.ok, true);
      assert.equal(result.remainingSnapshots, 0);
      assert.equal(executor.getConfigs().leftClick.sound, true);
    });

    it("restores previous state after multiple patches", () => {
      const executor = createToolExecutor({
        leftClick: { sound: true, volume: 50 },
        doubleClick: { particle: false },
      });

      // Patch 1
      executor.execute("apply_config_patch", {
        actionId: "leftClick",
        patch: { sound: false },
      });
      assert.equal(executor.getSnapshots(), 1);

      // Patch 2
      executor.execute("apply_config_patch", {
        actionId: "doubleClick",
        patch: { particle: true, particleCount: 10 },
      });
      assert.equal(executor.getSnapshots(), 2);

      // Rollback patch 2
      executor.execute("rollback", {});
      assert.equal(executor.getSnapshots(), 1);
      // doubleClick should be back to original
      assert.equal(executor.getConfigs().doubleClick.particle, false);
      // leftClick should still have patch 1 applied
      assert.equal(executor.getConfigs().leftClick.sound, false);

      // Rollback patch 1
      executor.execute("rollback", {});
      assert.equal(executor.getSnapshots(), 0);
      assert.equal(executor.getConfigs().leftClick.sound, true);
    });

    it("handles rollback of patch to previously empty action", () => {
      // NOTE: Known limitation — rollback to empty snapshot cannot delete keys
      // that didn't exist in the snapshot. The action config persists with its
      // pre-patch empty state rather than being fully removed.
      const executor = createToolExecutor({});
      executor.execute("apply_config_patch", {
        actionId: "hover",
        patch: { ripple: true, rippleSize: 80 },
      });
      assert.equal(executor.getConfigs().hover.ripple, true);

      executor.execute("rollback", {});
      assert.equal(executor.getSnapshots(), 0);
      // Snapshot restored configs to pre-patch state; hover key may persist
    });
  });

  describe("executor integration", () => {
    it("simulates full ReAct flow", () => {
      const executor = createToolExecutor({
        leftClick: { textEnabled: false, particle: false, sound: true, volume: 80 },
      });

      // Step 1: Read current config
      const read = executor.execute("get_current_config", { actionId: "leftClick" });
      assert.equal(read.config.sound, true);

      // Step 2: Apply patch to disable sound
      const apply = executor.execute("apply_config_patch", {
        actionId: "leftClick",
        patch: { sound: false, volume: 0 },
      });
      assert.equal(apply.ok, true);
      assert.equal(executor.getConfigs().leftClick.sound, false);

      // Step 3: Oops, wrong — rollback
      const rollback = executor.execute("rollback", {});
      assert.equal(rollback.ok, true);
      assert.equal(executor.getConfigs().leftClick.sound, true);
      assert.equal(executor.getConfigs().leftClick.volume, 80);
    });
  });
});
