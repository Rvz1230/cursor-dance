import {
  decideActionExecution,
  type ActionRuntimeState,
} from "./action-state";
import type { AudioSpec, EffectSpec } from "./contracts";

export interface ActionTriggerState extends ActionRuntimeState {
  ready?: boolean;
}

export interface ActionTriggerCoords {
  x: number;
  y: number;
  target: unknown;
  event: unknown;
}

interface ActionTriggerOptions {
  triggerSource?: string;
  resolvedActionId?: string;
  throttleMs?: number;
  force?: boolean;
}

interface ActionTriggerConfigStore {
  isCurrentContextEnabled(): boolean;
  getActiveTheme(): unknown;
  getActionConfig(theme: unknown, actionId: string): Record<string, unknown> | null | undefined;
  getActionTriggerConfig(actionConfig: Record<string, unknown> | null | undefined): Record<string, unknown>;
  matchesTriggerZone(
    target: unknown,
    triggerZone: unknown,
    event: unknown,
    options: { actionId: string; triggerSource: string },
  ): boolean;
  resolveCursorStateId(target: unknown): string;
  getCursorStateBinding(
    theme: unknown,
    cursorStateId: string,
    sourceActionId: string,
  ): { actionId: string; cursorStateId: string; inheritedFromDefault?: boolean };
}

interface ActionTriggerDiagnostics {
  log(scope: string, payload?: Record<string, unknown>): void;
  describeTarget?(target: unknown): unknown;
}

export interface ActionTriggerPipelineDeps {
  state: ActionTriggerState;
  configStore: ActionTriggerConfigStore;
  diagnostics?: ActionTriggerDiagnostics;
  unsupportedActions?: ReadonlySet<string>;
  unsupportedReason?: string;
  now?: () => number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(timeoutId: unknown): void;
  renderEffect(effect: EffectSpec): void;
  playAudio(audio: AudioSpec, resolvedActionId: string): void;
}

export interface ActionTriggerPipeline {
  triggerAction(
    sourceActionId: string,
    coords: ActionTriggerCoords,
    theme?: unknown,
    options?: ActionTriggerOptions,
  ): void;
  scheduleActionTrigger(
    actionId: string,
    coords: ActionTriggerCoords,
    theme: unknown,
    delayMs: number,
    options?: ActionTriggerOptions,
  ): void;
  clearPendingTriggers(): void;
}

export function createActionTriggerPipeline(deps: ActionTriggerPipelineDeps): ActionTriggerPipeline {
  const now = deps.now || Date.now;
  const pendingTimeouts = new Set<unknown>();

  function triggerAction(
    sourceActionId: string,
    coords: ActionTriggerCoords,
    theme?: unknown,
    options: ActionTriggerOptions = {},
  ): void {
    const triggerSource = options.triggerSource || "unknown";
    if (!deps.state.ready) {
      deps.diagnostics?.log("action.skip", { reason: "not-ready", sourceActionId, triggerSource });
      return;
    }
    if (deps.unsupportedActions?.has(sourceActionId)) {
      deps.diagnostics?.log("action.skip", {
        reason: deps.unsupportedReason || "unsupported-on-platform",
        sourceActionId,
        triggerSource,
      });
      return;
    }
    if (!deps.configStore.isCurrentContextEnabled()) {
      deps.diagnostics?.log("action.skip", { reason: "site-disabled", sourceActionId, triggerSource });
      return;
    }

    const targetTheme = theme || deps.configStore.getActiveTheme();
    const sourceActionConfig = deps.configStore.getActionConfig(targetTheme, sourceActionId);
    if (!sourceActionConfig) {
      deps.diagnostics?.log("action.skip", {
        reason: "missing-source-action-config",
        sourceActionId,
        triggerSource,
      });
      return;
    }
    const sourceTriggerConfig = deps.configStore.getActionTriggerConfig(sourceActionConfig);
    if (!deps.configStore.matchesTriggerZone(
      coords.target,
      sourceTriggerConfig.triggerZone,
      coords.event,
      { actionId: sourceActionId, triggerSource },
    )) {
      deps.diagnostics?.log("action.skip", {
        reason: "trigger-zone-filtered",
        sourceActionId,
        triggerSource,
        triggerZone: sourceTriggerConfig.triggerZone || "任意区域",
        target: deps.diagnostics?.describeTarget?.(coords.target),
      });
      return;
    }

    const binding = deps.configStore.getCursorStateBinding(
      targetTheme,
      deps.configStore.resolveCursorStateId(coords.target),
      sourceActionId,
    );
    const resolvedActionId = options.resolvedActionId || binding.actionId;
    deps.diagnostics?.log("action.resolve", {
      sourceActionId,
      resolvedActionId,
      triggerSource,
      cursorStateId: binding.cursorStateId,
      inheritedFromDefault: binding.inheritedFromDefault,
      target: deps.diagnostics?.describeTarget?.(coords.target),
    });

    const actionConfig = deps.configStore.getActionConfig(targetTheme, resolvedActionId);
    if (!actionConfig) {
      deps.diagnostics?.log("action.skip", {
        reason: "missing-resolved-action-config",
        sourceActionId,
        resolvedActionId,
        triggerSource,
      });
      return;
    }
    const decision = decideActionExecution(deps.state, {
      sourceActionId,
      resolvedActionId,
      x: coords.x,
      y: coords.y,
      actionConfig,
      sourceTriggerConfig,
      now: now(),
      throttleMs: options.throttleMs,
      force: options.force,
    });
    if (decision.status === "skip") {
      deps.diagnostics?.log("action.skip", {
        reason: decision.reason,
        sourceActionId,
        resolvedActionId,
        triggerSource,
        outputs: decision.outputs,
        ...(decision.reason === "throttled"
          ? { elapsedMs: decision.elapsedMs, throttleMs: decision.throttleMs }
          : {}),
      });
      return;
    }

    deps.diagnostics?.log("action.fire", {
      sourceActionId,
      resolvedActionId,
      triggerSource,
      runIndex: decision.runIndex,
      comboIndex: decision.comboIndex,
      comboWindowMs: decision.comboWindowMs,
      force: Boolean(options.force),
      outputs: decision.outputs,
      target: deps.diagnostics?.describeTarget?.(coords.target),
    });
    for (const effect of decision.outputPlan.effects) deps.renderEffect(effect);
    if (decision.outputPlan.audio) deps.playAudio(decision.outputPlan.audio, resolvedActionId);
  }

  function scheduleActionTrigger(
    actionId: string,
    coords: ActionTriggerCoords,
    theme: unknown,
    delayMs: number,
    options: ActionTriggerOptions = {},
  ): void {
    const run = (): void => triggerAction(actionId, coords, theme, options);
    if (!delayMs) {
      run();
      return;
    }
    deps.diagnostics?.log("action.schedule", {
      actionId,
      triggerSource: options.triggerSource || "unknown",
      delayMs,
    });
    let timeoutId: unknown;
    timeoutId = deps.setTimeout(() => {
      pendingTimeouts.delete(timeoutId);
      run();
    }, delayMs);
    pendingTimeouts.add(timeoutId);
  }

  function clearPendingTriggers(): void {
    for (const timeoutId of pendingTimeouts) deps.clearTimeout(timeoutId);
    pendingTimeouts.clear();
  }

  return { triggerAction, scheduleActionTrigger, clearPendingTriggers };
}
