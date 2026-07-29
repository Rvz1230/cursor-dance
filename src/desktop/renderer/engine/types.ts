import type { KeyFeedbackConfig } from "./key-feedback-types";

// CursorDance 效果引擎共享类型
//
// 引擎在扩展端通过 IIFE + window.CursorDanceContentModules 注册（见 extension/content-runtime/*）。
// 桌面端把同一套引擎放到 ES module 形态下，并通过 createEffectEngine 注入
// window/document/constants/state/configStore，让 overlay 渲染进程与 Workbench 预览面板
// 共享同一份代码（详见 docs/plans/steady-painting-yeti.md）。

/**
 * 引擎入口接收的结构化光标事件。
 * - extension：DOM pointerEvent 的薄封装；
 * - desktop：主进程通过 uiohook-napi 抓全局事件后，经 IPC 投递到 overlay。
 *
 * 字段刻意保持最小集合，避免 IPC 序列化负担。
 */
export interface CursorEvent {
  /** "mousemove" | "mousedown" | "mouseup" | "click" | "dblclick" | "wheel" | ... */
  type: string;
  /** overlay 窗口本地 DIP 坐标 */
  x: number;
  y: number;
  /** 鼠标按键位掩码：1=左 2=右 4=中（与 PointerEvent.buttons 同口径） */
  buttons?: number;
  /** PointerEvent.button：0=左 1=中 2=右，仅 mousedown/mouseup 携带 */
  button?: number;
  /** 滚轮 deltaY，仅 wheel 事件携带 */
  deltaY?: number;
  /** 事件时间戳。扩展端为 ms；桌面端为 uiohook 原始单位（macOS 纳秒，Windows ms），引擎当前未读取此字段 */
  timestamp: number;
}

/**
 * DOM 元素 id / 类名常量。
 * 当前覆盖 visual-effects 的需求；2.2 cursor-overlay 之后视情况扩展。
 */
export interface EngineConstants {
  ROOT_ID: string;
  STYLE_ID: string;
  HIDE_CURSOR_CLASS: string;
}

/**
 * 长按状态机切片。trigger-handlers 在 leftPointerDown 后启动定时器，
 * pointerUp / pointerCancel 时收尾。pointerId 仅做记录，不参与匹配。
 */
export interface LongPressState {
  startedAt: number;
  pointerId?: number;
  x: number;
  y: number;
  /** 桌面端没有 DOM 目标，扩展端是 EventTarget */
  target: unknown;
  scheme: unknown;
  triggered: boolean;
  /** 防双重触发守卫：超时路径和 release 路径互斥依赖 releaseMode，fired 作为 belt-and-suspenders 保护 */
  fired: boolean;
  releaseMode: boolean;
  thresholdMs: number;
  timeoutId?: number;
}

/**
 * 引擎共享的可变状态切片。
 * 各子模块按需读写自己的字段；非自己的字段保持只读心态，避免互相踩。
 */
export interface EngineState {
  /** visual-effects.animateNode 的并发计数 */
  activeEffects: number;
  /** 轨道粒子分组缓存，按 actionId 隔离，供 clearOrbitalParticles 清理 */
  orbitalGroups?: Record<string, { dot: HTMLElement; anim: Animation }[]>;
  /** cursor-overlay 复用的软件光标节点（首次同步时创建） */
  stateCursorNode?: HTMLElement | null;
  stateCursorImg?: HTMLImageElement | null;
  /** audio 子模块的节流时间戳（按 actionId 维度） */
  lastSoundAtByAction?: Record<string, number>;
  /** 懒创建的 AudioContext；首次 playSound 时建立 */
  audioContext?: AudioContext | null;
  /** trigger-handlers：是否已就绪，未就绪则吞掉所有触发 */
  ready?: boolean;
  /** trigger-handlers：sourceActionId → 上次触发时间戳（节流） */
  lastTriggerAtByAction?: Record<string, number>;
  /** trigger-handlers：resolvedActionId → 累计触发次数 */
  actionRunCounts?: Record<string, number>;
  /** trigger-handlers：resolvedActionId → 连击窗口状态 */
  actionComboStates?: Record<string, { count: number; lastAt: number }>;
  /** trigger-handlers：双击检测的「上次按下/抬起时间」 */
  lastLeftPointerDownAt?: number;
  lastLeftPointerUpAt?: number;
  /** trigger-handlers：滚轮 burst 检测的「上次滚轮事件时间」 */
  lastWheelEventAt?: number;
  /** trigger-handlers：长按状态机 */
  longPressState?: LongPressState | null;
  /** key-feedback：per-keycode 冷却计时器 */
  lastKeydownAtByKeycode?: Map<number, number>;
  /** key-feedback：活动键盘效果计数 */
  activeKeyEffects?: number;
  /** key-feedback：连续输入节奏状态 */
  keyFeedbackCombo?: { count: number; lastAt: number };
  /** overlay：上次鼠标全局 DIP 坐标（用于键盘事件多显示器路由） */
  lastMouseGlobalX?: number;
  lastMouseGlobalY?: number;
}

/**
 * configStore 暴露给引擎的最小接口。
 * 当前覆盖 visual-effects + cursor-overlay + audio + trigger-handlers 的需求。
 * 多数返回值/参数在桌面端没有 DOM 概念时会退化为 null/默认值，由 configStore 实现层处理。
 */
export interface ConfigStore {
  getActionTextConfig(actionConfig: Record<string, unknown> | undefined): Record<string, unknown>;
  getActionRippleConfig(actionConfig: Record<string, unknown> | undefined): Record<string, unknown>;
  getActionParticleConfig(actionConfig: Record<string, unknown> | undefined): Record<string, unknown>;
  getActionAnimationConfig(actionConfig: Record<string, unknown> | undefined): Record<string, unknown>;
  getActionImageConfig(actionConfig: Record<string, unknown> | undefined): Record<string, unknown>;
  getActionCursorFeedbackConfig(actionConfig: Record<string, unknown> | undefined): Record<string, unknown>;
  getActionAudioConfig(actionConfig: Record<string, unknown> | undefined): Record<string, unknown>;
  getActionTriggerConfig(actionConfig: Record<string, unknown> | undefined): Record<string, unknown>;
  getMaxActiveEffects(): number;
  getKeyFeedbackConfig(): KeyFeedbackConfig;
  /** trigger-handlers：当前 scheme（用户选中的方案） */
  getActiveScheme?(): unknown;
  /** trigger-handlers：完整 schema v4 config，仅 previewAtViewportCenter 用到 */
  getConfig?(): { themes: readonly { id: string }[]; activeThemeId: string };
  /** trigger-handlers：站点/应用是否启用。桌面端由共享 app-rules 匹配器实现 */
  isCurrentSiteEnabled?(): boolean;
  /** trigger-handlers：根据 scheme + actionId 取动作配置 */
  getActionConfig?(scheme: unknown, actionId: string): Record<string, unknown> | undefined;
  /** trigger-handlers：解析 cursor state 绑定到某个 actionId */
  getCursorStateBinding?(
    scheme: unknown,
    cursorStateId: string,
    sourceActionId: string,
  ): { actionId: string; cursorStateId: string; inheritedFromDefault?: boolean };
  /** trigger-handlers：从目标元素解析 cursor state id（桌面端通常返回默认） */
  resolveCursorStateId?(target: unknown): string;
  /** cursor-overlay：获取指定 cursor state 的生效配置（含 imageDataUrl/size/hotspot） */
  getEffectiveCursorStateConfig?(scheme: unknown, stateId: string): unknown;
  /** trigger-handlers：触发区域匹配。桌面端无 DOM target/event 时返回 true */
  matchesTriggerZone?(
    target: unknown,
    triggerZone: unknown,
    event: unknown,
    opts: { actionId: string; triggerSource: string },
  ): boolean;
}

/**
 * diagnostics 子模块对引擎暴露的接口。完整实现见 extension/content-runtime/diagnostics.js
 * （扩展端）和未来的 src/renderer/engine/diagnostics.ts（任务 2.5 之后再迁）。
 * describeTarget 桌面端可返回 "no-target" 之类的占位字符串。
 */
export interface DiagnosticsModule {
  isEnabled(): boolean;
  log(scope: string, payload?: Record<string, unknown>): void;
  /** 桌面端可返回简短字符串；扩展端返回结构化描述。统一为 unknown，由调用方按需序列化。 */
  describeTarget?(target: unknown): unknown;
}

/**
 * 创建引擎需要的依赖。
 * 显式注入 window/document/constants/state/configStore，让引擎可以被 overlay 渲染进程、
 * Workbench 预览面板，甚至单元测试里的 jsdom 复用。
 */
export interface EngineDeps {
  window: Window;
  document: Document;
  constants: EngineConstants;
  state: EngineState;
  configStore: ConfigStore;
  diagnostics?: DiagnosticsModule;
  reportRuntimeError?: (scope: string, message: string) => void;
}

/**
 * visual-effects 子模块对外暴露的渲染 API。
 * 与 extension/content-runtime/visual-effects.js 的返回对象一一对应。
 */
export interface VisualEffectsModule {
  ensureRoot(): HTMLElement;
  renderText(x: number, y: number, actionConfig: Record<string, unknown>, actionId: string, runIndex: number): void;
  renderRipple(x: number, y: number, actionConfig: Record<string, unknown>): void;
  renderAnimationEffect(x: number, y: number, actionConfig: Record<string, unknown>): void;
  renderImageEffect(x: number, y: number, actionConfig: Record<string, unknown>): void;
  renderParticles(x: number, y: number, actionConfig: Record<string, unknown>, runIndex: number): void;
  renderOrbitalParticles(x: number, y: number, actionConfig: Record<string, unknown>, runIndex: number, actionId?: string): void;
  clearOrbitalParticles(actionId?: string): void;
  renderCursorOverride(x: number, y: number, actionConfig: Record<string, unknown>): void;
  hasCursorOverride(actionConfig: Record<string, unknown>): boolean;
}

/**
 * cursor-overlay 子模块的软件光标视觉参数。
 * 上层把站点开关 + cursor-state 解析的责任承担下来，引擎只需要拿到「这次坐标更新里要不要画、画成什么样」。
 */
export interface CursorOverlayState {
  imageDataUrl?: string;
  /** 单位 px，原 JS 钳位到 [24, 96]，缺省 48 */
  size?: number;
  hotspotX?: number;
  hotspotY?: number;
}

/**
 * cursor-overlay 子模块对外暴露的 API。
 */
export interface CursorOverlayModule {
  syncStateCursorOverlay(x: number, y: number, cursorState?: CursorOverlayState): void;
  clearStateCursorOverlay(): void;
}

/**
 * audio 子模块对外暴露的 API。
 * 桌面版没有页面音视频可压制，因此移除了 duckPageMedia 一族；只保留 playSound。
 */
export interface AudioRuntimeModule {
  playSound(actionConfig: Record<string, unknown>, actionId: string, runContext?: { comboIndex?: number }): void;
}

/**
 * trigger-handlers 子模块对外暴露的 API。
 * 桌面端裁剪：移除 handlePointerOver / handlePointerOut（hover 不在桌面 5 个 trigger 之内）。
 * 输入从 DOM Event 切换为结构化的 CursorEvent —— 桌面 IPC 不再需要序列化整个 PointerEvent。
 */
export interface TriggerHandlersModule {
  handleLeftPointerDown(event: CursorEvent): void;
  handlePointerUp(event: CursorEvent): void;
  handlePointerCancel(): void;
  handleRightPointerDown(event: CursorEvent): void;
  handleContextMenu(event: CursorEvent): void;
  handleWheel(event: CursorEvent): void;
  previewAtViewportCenter(schemeId?: string, previewScheme?: unknown, actionId?: string): void;
  /**
   * 在指定坐标触发一次预览。Workbench 预览面板用它在 stage 中心触发，
   * 桌面 overlay 仍用 previewAtViewportCenter（其内部转调本方法）。
   */
  previewAt(x: number, y: number, schemeId?: string, previewScheme?: unknown, actionId?: string): void;
  /** 模拟多步动作（doubleClick / longPress），通过真实状态机触发。返回清理函数可取消待执行的 timeout。 */
  simulateAction(actionId: string, x: number, y: number, scheme: unknown, options?: { holdMs?: number }): () => void;
}

/**
 * 从主进程 IPC 投递的键盘事件（与 native-events.ts NativeKeyboardEvent 同形）。
 */
export interface NativeKeyboardEvent {
  type: "keydown" | "keyup";
  keycode: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  timestamp: number;
}

/**
 * key-feedback 子模块对外暴露的 API。
 */
export interface KeyFeedbackModule {
  handleKeyboardEvent(event: NativeKeyboardEvent): void;
}

export interface EffectEngine {
  visualEffects: VisualEffectsModule;
  cursorOverlay: CursorOverlayModule;
  audioRuntime: AudioRuntimeModule;
  triggerHandlers: TriggerHandlersModule;
  keyFeedback: KeyFeedbackModule;
}
