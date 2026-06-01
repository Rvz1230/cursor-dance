import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runAgentLoop } from "../src/agent-loop.mjs";

function mockGenerateResponse(...responses) {
  let callIndex = 0;
  return async () => {
    const response = responses[callIndex] || responses[responses.length - 1];
    callIndex++;
    if (typeof response === "function") {
      const result = response();
      // Return a copy to prevent mutation between calls
      return JSON.parse(JSON.stringify(result));
    }
    return JSON.parse(JSON.stringify(response));
  };
}

const BASE_CONFIG = {
  leftClick: {
    textEnabled: true,
    textKind: "数字飘字",
    textMode: "默认模式 (+1)",
    textContent: "+1",
    textStyle: "阿拉伯数字 (1, 2, 3)",
    textTemplate: "${number}",
    textColor: "#0284C7",
    fontSize: 16,
    particle: true,
    particleCount: 12,
    particleStyle: "点状粒子",
    ripple: true,
    rippleSize: 60,
    rippleStyle: "单环",
    sound: false,
    volume: 0,
    shake: 0,
  },
};

describe("Agent E2E: happy path — standard ReAct flow", () => {
  it("calls get_current_config → apply_config_patch → finalize_proposal within 3 steps", async () => {
    const mockGenerate = mockGenerateResponse(
      {
        content: "让我先查看当前配置。",
        toolCalls: [
          { id: "call_1", name: "get_current_config", arguments: { actionId: "leftClick" } },
        ],
        finishReason: "tool_calls",
        usage: { total_tokens: 400 },
      },
      {
        content: "用户想要霓虹风格，调高粒子数量并改成绿色。",
        toolCalls: [
          {
            id: "call_2",
            name: "apply_config_patch",
            arguments: {
              actionId: "leftClick",
              patch: { textColor: "#00FF00", particleCount: 28, particleStyle: "星光" },
            },
          },
        ],
        finishReason: "tool_calls",
        usage: { total_tokens: 500 },
      },
      {
        content: "配置已修改完成，生成最终方案。",
        toolCalls: [
          {
            id: "call_3",
            name: "finalize_proposal",
            arguments: {
              scheme: {
                name: "霓虹风格",
                summary: "高亮霓虹绿色粒子效果。",
                styleTags: ["霓虹", "赛博"],
                rationale: "用户想要霓虹科技感风格。",
              },
              reply: "已将左键点击调整为霓虹绿色风格，粒子数量增加到 28。",
              riskLevel: "low",
              warnings: [],
              tuningOptions: ["再亮一点", "改成蓝色", "减少粒子"],
            },
          },
        ],
        finishReason: "tool_calls",
        usage: { total_tokens: 350 },
      }
    );

    const result = await runAgentLoop({
      prompt: "想要霓虹风格",
      actionId: "leftClick",
      currentConfig: BASE_CONFIG.leftClick,
      allConfigs: BASE_CONFIG,
      generateResponse: mockGenerate,
      maxSteps: 5,
    });

    assert.equal(result.ok, true);
    assert.ok(result.steps.length >= 2, `Expected ≥2 steps, got ${result.steps.length}`);
    assert.ok(result.steps.length <= 3, `Expected ≤3 steps, got ${result.steps.length}`);

    // Last step should include a finalize_proposal tool call
    const lastStep = result.steps[result.steps.length - 1];
    const finalizeCall = lastStep.toolCalls.find((tc) => tc.name === "finalize_proposal");
    assert.ok(finalizeCall, "Last step should call finalize_proposal");

    // Proposal should contain valid data
    assert.ok(result.proposal);
    assert.equal(result.proposal.source, "agent");
    assert.ok(result.proposal.scheme?.name);
    assert.ok(result.proposal.reply);
    assert.ok(Array.isArray(result.proposal.targets));
    assert.ok(result.proposal.targets.length > 0);

    // Token usage should be tracked
    assert.ok(result.totalTokens > 0, "totalTokens should be > 0");
    assert.ok(result.durationMs > 0, "durationMs should be > 0");
  });

  it("modifies config correctly via apply_config_patch", async () => {
    const mockGenerate = mockGenerateResponse(
      {
        content: "直接应用修改。",
        toolCalls: [
          {
            id: "call_1",
            name: "apply_config_patch",
            arguments: {
              actionId: "leftClick",
              patch: { particle: false, particleCount: 0, sound: true, volume: 60 },
            },
          },
        ],
        finishReason: "tool_calls",
        usage: { total_tokens: 300 },
      },
      {
        content: "完成。",
        toolCalls: [
          {
            id: "call_2",
            name: "finalize_proposal",
            arguments: {
              scheme: { name: "关闭粒子", summary: "关闭粒子并开启音效。", styleTags: [], rationale: "" },
              reply: "已关闭粒子效果并开启音效。",
              riskLevel: "low",
              warnings: [],
              tuningOptions: ["调高音量", "换音效"],
            },
          },
        ],
        finishReason: "tool_calls",
        usage: { total_tokens: 200 },
      }
    );

    const result = await runAgentLoop({
      prompt: "关掉粒子，加声音",
      actionId: "leftClick",
      currentConfig: BASE_CONFIG.leftClick,
      allConfigs: BASE_CONFIG,
      generateResponse: mockGenerate,
      maxSteps: 5,
    });

    assert.equal(result.ok, true);

    // The target patch should reflect the changes
    const leftClickTarget = result.proposal.targets.find((t) => t.actionId === "leftClick");
    assert.ok(leftClickTarget);
    assert.equal(leftClickTarget.patch.particle, false);
    assert.equal(leftClickTarget.patch.sound, true);
  });
});

describe("Agent E2E: rollback mechanism", () => {
  it("rolls back a bad apply_config_patch and restores config before applying correct patch", async () => {
    // Use VALID values for the bad patch so sanitize won't mask the rollback.
    // If rollback doesn't work, these values persist and the final merge will differ.
    const badPatch = { particle: false, ripple: false, textColor: "#FF0000" };
    const goodPatch = { particle: true, particleCount: 20, textColor: "#00FF00" };

    const mockGenerate = mockGenerateResponse(
      // Step 1: apply bad patch (turn off particle + ripple, set red color)
      {
        content: "试试关闭粒子效果。",
        toolCalls: [
          {
            id: "call_1",
            name: "apply_config_patch",
            arguments: { actionId: "leftClick", patch: badPatch },
          },
        ],
        finishReason: "tool_calls",
        usage: { total_tokens: 300 },
      },
      // Step 2: rollback — agent realizes wrong approach
      {
        content: "效果不对，先回滚。",
        toolCalls: [{ id: "call_2", name: "rollback", arguments: {} }],
        finishReason: "tool_calls",
        usage: { total_tokens: 300 },
      },
      // Step 3: apply correct patch
      {
        content: "换一种方式，用绿色粒子效果。",
        toolCalls: [
          {
            id: "call_3",
            name: "apply_config_patch",
            arguments: { actionId: "leftClick", patch: goodPatch },
          },
        ],
        finishReason: "tool_calls",
        usage: { total_tokens: 300 },
      },
      // Step 4: finalize
      {
        content: "完成。",
        toolCalls: [
          {
            id: "call_4",
            name: "finalize_proposal",
            arguments: {
              scheme: { name: "修正后", summary: "绿色粒子效果。", styleTags: [], rationale: "" },
              reply: "已修正为绿色粒子效果。",
              riskLevel: "low",
              warnings: [],
              tuningOptions: [],
            },
          },
        ],
        finishReason: "tool_calls",
        usage: { totalTokens: 200 },
      }
    );

    const result = await runAgentLoop({
      prompt: "改粒子颜色",
      actionId: "leftClick",
      currentConfig: BASE_CONFIG.leftClick,
      allConfigs: BASE_CONFIG,
      generateResponse: mockGenerate,
      maxSteps: 5,
    });

    assert.equal(result.ok, true);

    // Verify rollback step exists and succeeded
    const rollbackStep = result.steps.find((s) =>
      s.toolCalls.some((tc) => tc.name === "rollback")
    );
    assert.ok(rollbackStep, "Agent should have called rollback");

    const rollbackResult = rollbackStep.toolResults.find((tr) => tr.name === "rollback");
    assert.ok(rollbackResult?.result?.ok, "Rollback should succeed");

    // CRITICAL: The diff targets should only contain fields that changed from base.
    // Bad patch set particle:false, ripple:false, textColor:"#FF0000".
    // After rollback, good patch sets particle:true (same as base), particleCount:20 (changed),
    // textColor:"#00FF00" (changed). Ripple is untouched (= base true).
    const leftClickTarget = result.proposal.targets.find((t) => t.actionId === "leftClick");
    assert.ok(leftClickTarget);

    // Good patch values that differ from base must be present
    assert.equal(leftClickTarget.patch.particleCount, 20,
      "particleCount: 20 (changed from base 12)");
    assert.equal(leftClickTarget.patch.textColor, "#00FF00",
      "textColor should be good patch value, not bad patch #FF0000");

    // particle: true matches base config, so it should NOT appear in diff
    assert.equal(leftClickTarget.patch.particle, undefined,
      "particle:true is unchanged from base, should not appear in diff");

    // Bad patch ripple:false must NOT leak through (rollback restored base ripple:true)
    assert.equal(leftClickTarget.patch.ripple, undefined,
      "ripple:false from bad patch should NOT persist after rollback");
  });

  it("handles rollback without snapshots gracefully", async () => {
    // Agent tries to rollback before making any changes
    const mockGenerate = mockGenerateResponse(
      {
        content: "先回滚看看。",
        toolCalls: [{ id: "call_1", name: "rollback", arguments: {} }],
        finishReason: "tool_calls",
        usage: { total_tokens: 200 },
      },
      {
        content: "没有可回滚的，直接给方案。",
        toolCalls: [
          {
            id: "call_2",
            name: "finalize_proposal",
            arguments: {
              scheme: { name: "无变更", summary: "无需变更。", styleTags: [], rationale: "" },
              reply: "当前配置没有历史快照可回滚。",
              riskLevel: "low",
              warnings: [],
              tuningOptions: [],
            },
          },
        ],
        finishReason: "tool_calls",
        usage: { total_tokens: 200 },
      }
    );

    const result = await runAgentLoop({
      prompt: "回滚到之前的状态",
      actionId: "leftClick",
      currentConfig: BASE_CONFIG.leftClick,
      allConfigs: BASE_CONFIG,
      generateResponse: mockGenerate,
      maxSteps: 5,
    });

    assert.equal(result.ok, true);

    const rollbackStep = result.steps[0];
    const rollbackResult = rollbackStep.toolResults.find((tr) => tr.name === "rollback");
    assert.equal(rollbackResult?.result?.ok, false);
    assert.ok(rollbackResult?.result?.error?.includes("没有可回滚"));
  });
});

describe("Agent E2E: out-of-scope rejection", () => {
  it("rejects non-CursorDance requests without applying patches", async () => {
    const mockGenerate = mockGenerateResponse({
      content: "这与鼠标反馈无关，直接拒绝。",
      toolCalls: [
        {
          id: "call_1",
          name: "finalize_proposal",
          arguments: {
            scheme: { name: "无法处理", summary: "请求超出范围。", styleTags: [], rationale: "" },
            reply: "抱歉，我只能处理鼠标点击效果和光标反馈相关的配置。请尝试描述你想要的鼠标交互效果。",
            riskLevel: "low",
            warnings: [],
            tuningOptions: ["科技感点击效果", "简约风格", "赛博朋克主题"],
          },
        },
      ],
      finishReason: "tool_calls",
      usage: { total_tokens: 300 },
    });

    const result = await runAgentLoop({
      prompt: "帮我写一首关于秋天的诗",
      actionId: "leftClick",
      currentConfig: BASE_CONFIG.leftClick,
      allConfigs: BASE_CONFIG,
      generateResponse: mockGenerate,
      maxSteps: 5,
    });

    assert.equal(result.ok, true);
    // Should complete in a single step (direct finalize)
    assert.equal(result.steps.length, 1);

    const onlyStep = result.steps[0];
    const hasApplyPatch = onlyStep.toolCalls.some((tc) => tc.name === "apply_config_patch");
    assert.equal(hasApplyPatch, false, "Should NOT call apply_config_patch for out-of-scope requests");

    const finalizeCall = onlyStep.toolCalls.find((tc) => tc.name === "finalize_proposal");
    assert.ok(finalizeCall, "Should call finalize_proposal directly");

    // When no config changes were made, the fallback adds a default target with empty patch.
    // The key invariant: no apply_config_patch was called, and any target has no actual changes.
    const hasEmptyPatch = result.proposal.targets.every(
      (t) => Object.keys(t.patch || {}).length === 0
    );
    assert.ok(hasEmptyPatch, "All target patches should be empty for out-of-scope");
  });

  it("rejects casual chat without modifying config", async () => {
    const mockGenerate = mockGenerateResponse({
      content: "这是闲聊，与配置无关。",
      toolCalls: [
        {
          id: "call_1",
          name: "finalize_proposal",
          arguments: {
            scheme: { name: "超出范围", summary: "无法处理闲聊。", styleTags: [], rationale: "" },
            reply: "我专注于鼠标反馈配置，无法回答这个问题。试试问我调整点击效果吧。",
            riskLevel: "low",
            warnings: [],
            tuningOptions: ["关闭粒子效果", "添加音效反馈", "改成文本飘字"],
          },
        },
      ],
      finishReason: "tool_calls",
      usage: { total_tokens: 250 },
    });

    const result = await runAgentLoop({
      prompt: "今天天气怎么样？",
      actionId: "leftClick",
      currentConfig: BASE_CONFIG.leftClick,
      allConfigs: BASE_CONFIG,
      generateResponse: mockGenerate,
      maxSteps: 5,
    });

    assert.equal(result.ok, true);
    assert.equal(result.steps.length, 1);

    const onlyStep = result.steps[0];
    const hasApplyPatch = onlyStep.toolCalls.some((tc) => tc.name === "apply_config_patch");
    assert.equal(hasApplyPatch, false);
    const hasEmptyPatch = result.proposal.targets.every(
      (t) => Object.keys(t.patch || {}).length === 0
    );
    assert.ok(hasEmptyPatch, "All target patches should be empty for casual chat");
  });
});

describe("Agent E2E: edge cases", () => {
  it("returns error when maxSteps is reached without finalize", async () => {
    // Agent keeps calling get_current_config without ever finalizing
    const mockGenerate = mockGenerateResponse({
      content: "让我再看看配置。",
      toolCalls: [
        { id: "call_loop", name: "get_current_config", arguments: { actionId: "leftClick" } },
      ],
      finishReason: "tool_calls",
      usage: { total_tokens: 200 },
    });

    const result = await runAgentLoop({
      prompt: "看看配置",
      actionId: "leftClick",
      currentConfig: BASE_CONFIG.leftClick,
      allConfigs: BASE_CONFIG,
      generateResponse: mockGenerate,
      maxSteps: 2,
    });

    assert.equal(result.ok, false);
    assert.ok(result.error?.includes("maximum steps"));
    assert.equal(result.steps.length, 2);
  });

  it("handles model returning content without tool_calls", async () => {
    const mockGenerate = mockGenerateResponse({
      content: "当前配置已经很好了，不需要修改。",
      toolCalls: [],
      finishReason: "stop",
      usage: { total_tokens: 200 },
    });

    const result = await runAgentLoop({
      prompt: "你觉得当前配置怎么样？",
      actionId: "leftClick",
      currentConfig: BASE_CONFIG.leftClick,
      allConfigs: BASE_CONFIG,
      generateResponse: mockGenerate,
      maxSteps: 5,
    });

    // Should finish gracefully with a fallback proposal
    assert.equal(result.ok, true);
    assert.ok(result.proposal);
    assert.ok(result.steps.length >= 1);
  });

  it("handles model returning malformed tool call arguments", async () => {
    const mockGenerate = mockGenerateResponse(
      {
        content: "修改配置。",
        toolCalls: [
          {
            id: "call_1",
            name: "apply_config_patch",
            arguments: { actionId: "", patch: null },
          },
        ],
        finishReason: "tool_calls",
        usage: { total_tokens: 200 },
      },
      {
        content: "完成。",
        toolCalls: [
          {
            id: "call_2",
            name: "finalize_proposal",
            arguments: {
              scheme: { name: "默认", summary: "默认方案。", styleTags: [], rationale: "" },
              reply: "已处理。",
              riskLevel: "low",
              warnings: [],
              tuningOptions: [],
            },
          },
        ],
        finishReason: "tool_calls",
        usage: { totalTokens: 200 },
      }
    );

    const result = await runAgentLoop({
      prompt: "随便改改",
      actionId: "leftClick",
      currentConfig: BASE_CONFIG.leftClick,
      allConfigs: BASE_CONFIG,
      generateResponse: mockGenerate,
      maxSteps: 5,
    });

    // Should not crash; the tool executor handles malformed args
    assert.equal(result.ok, true);

    const applyStep = result.steps.find((s) =>
      s.toolCalls.some((tc) => tc.name === "apply_config_patch")
    );
    assert.ok(applyStep);
    const applyResult = applyStep.toolResults.find((tr) => tr.name === "apply_config_patch");
    // Empty actionId or null patch should cause tool error
    assert.equal(applyResult?.result?.ok, false);
  });

  it("emits step_start, tool_call, tool_result, and step_end events", async () => {
    const events = [];

    const mockGenerate = mockGenerateResponse(
      {
        content: "查看配置。",
        toolCalls: [
          { id: "call_1", name: "get_current_config", arguments: { actionId: "leftClick" } },
        ],
        finishReason: "tool_calls",
        usage: { total_tokens: 200 },
      },
      {
        content: "完成。",
        toolCalls: [
          {
            id: "call_2",
            name: "finalize_proposal",
            arguments: {
              scheme: { name: "测试", summary: "测试。", styleTags: [], rationale: "" },
              reply: "完成。",
              riskLevel: "low",
              warnings: [],
              tuningOptions: [],
            },
          },
        ],
        finishReason: "tool_calls",
        usage: { total_tokens: 200 },
      }
    );

    await runAgentLoop({
      prompt: "测试事件",
      actionId: "leftClick",
      currentConfig: BASE_CONFIG.leftClick,
      allConfigs: BASE_CONFIG,
      generateResponse: mockGenerate,
      maxSteps: 5,
      onEvent: (event, data) => events.push({ event, data }),
    });

    const eventTypes = events.map((e) => e.event);
    assert.ok(eventTypes.includes("step_start"));
    assert.ok(eventTypes.includes("tool_call"));
    assert.ok(eventTypes.includes("tool_result"));
    assert.ok(eventTypes.includes("step_end"));
    assert.ok(eventTypes.includes("result"), "Should emit a final result event");
  });

  it("handles generateResponse throwing an error", async () => {
    const mockGenerate = async () => {
      throw new Error("DeepSeek API rate limit exceeded");
    };

    const result = await runAgentLoop({
      prompt: "测试错误处理",
      actionId: "leftClick",
      currentConfig: BASE_CONFIG.leftClick,
      allConfigs: BASE_CONFIG,
      generateResponse: mockGenerate,
      maxSteps: 5,
    });

    // Should return gracefully, not throw
    assert.equal(result.ok, false);
    assert.ok(result.steps.length >= 0);
  });

  it("handles multi-action configs", async () => {
    const multiConfig = {
      leftClick: { ...BASE_CONFIG.leftClick },
      rightClick: { textEnabled: false, particle: false, ripple: false, sound: false },
      doubleClick: { textEnabled: true, textKind: "文本飘字", textContent: "双击" },
    };

    const mockGenerate = mockGenerateResponse(
      {
        content: "查看所有配置。",
        toolCalls: [
          { id: "call_1", name: "get_current_config", arguments: { actionId: "leftClick" } },
        ],
        finishReason: "tool_calls",
        usage: { total_tokens: 300 },
      },
      {
        content: "修改左键。",
        toolCalls: [
          {
            id: "call_2",
            name: "apply_config_patch",
            arguments: {
              actionId: "leftClick",
              patch: { particleCount: 30 },
            },
          },
        ],
        finishReason: "tool_calls",
        usage: { total_tokens: 300 },
      },
      {
        content: "也改右键。",
        toolCalls: [
          {
            id: "call_3",
            name: "apply_config_patch",
            arguments: {
              actionId: "rightClick",
              patch: { particle: true, particleCount: 15 },
            },
          },
        ],
        finishReason: "tool_calls",
        usage: { total_tokens: 300 },
      },
      {
        content: "完成。",
        toolCalls: [
          {
            id: "call_4",
            name: "finalize_proposal",
            arguments: {
              scheme: { name: "多动作", summary: "修改了多个动作。", styleTags: [], rationale: "" },
              reply: "已修改左键和右键。",
              riskLevel: "low",
              warnings: [],
              tuningOptions: [],
            },
          },
        ],
        finishReason: "tool_calls",
        usage: { total_tokens: 250 },
      }
    );

    const result = await runAgentLoop({
      prompt: "让左键和右键都有粒子效果",
      actionId: "leftClick",
      currentConfig: multiConfig.leftClick,
      allConfigs: multiConfig,
      generateResponse: mockGenerate,
      maxSteps: 5,
    });

    assert.equal(result.ok, true);
    // Should have targets for both actions that were modified
    assert.ok(result.proposal.targets.length >= 2, `Expected ≥2 targets, got ${result.proposal.targets.length}`);
    const leftTarget = result.proposal.targets.find((t) => t.actionId === "leftClick");
    const rightTarget = result.proposal.targets.find((t) => t.actionId === "rightClick");
    assert.ok(leftTarget);
    assert.ok(rightTarget);
  });
});
