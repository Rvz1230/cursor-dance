// CursorDance 效果引擎共享类型
//
// 引擎在扩展端通过 IIFE + window.CursorDanceContentModules 注册（见 public/content-runtime/*）。
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
  /** 屏幕坐标，已乘以 DPR */
  x: number;
  y: number;
  /** 鼠标按键位掩码：1=左 2=右 4=中（与 PointerEvent.buttons 同口径） */
  buttons?: number;
  /** 滚轮 deltaY，仅 wheel 事件携带 */
  deltaY?: number;
  /** 事件时间戳（ms），由捕获方填充，避免引擎自己读时钟 */
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
 * 引擎共享的可变状态切片。
 * 各子模块按需读写自己的字段；非自己的字段保持只读心态，避免互相踩。
 */
export interface EngineState {
  /** visual-effects.animateNode 的并发计数 */
  activeEffects: number;
  /** 轨道粒子分组缓存，供 clearOrbitalParticles 清理 */
  orbitalGroups?: { dot: HTMLElement; anim: Animation }[][];
  /** cursor-overlay 复用的软件光标节点（首次同步时创建） */
  stateCursorNode?: HTMLElement | null;
  stateCursorImg?: HTMLImageElement | null;
  /** audio 子模块的节流时间戳（按 actionId 维度） */
  lastSoundAtByAction?: Record<string, number>;
  /** 懒创建的 AudioContext；首次 playSound 时建立 */
  audioContext?: AudioContext | null;
}

/**
 * configStore 暴露给引擎的最小接口。
 * 当前覆盖 visual-effects + cursor-overlay + audio 的需求；
 * trigger-handlers 在 2.4 迁移时再补。
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
}

/**
 * diagnostics 子模块对引擎暴露的接口。完整实现见 public/content-runtime/diagnostics.js
 * （扩展端）和未来的 src/renderer/engine/diagnostics.ts（任务 2.5 之后再迁）。
 * 注：桌面端没有 DOM 媒体元素，describeMedia 仅用于扩展端 audio.duck.* 日志，
 * 桌面 audio.ts 不再调用 ducking 路径，所以这里只保留 log/isEnabled。
 */
export interface DiagnosticsModule {
  isEnabled(): boolean;
  log(scope: string, payload?: Record<string, unknown>): void;
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
}

/**
 * visual-effects 子模块对外暴露的渲染 API。
 * 与 public/content-runtime/visual-effects.js 的返回对象一一对应。
 */
export interface VisualEffectsModule {
  ensureRoot(): HTMLElement;
  renderText(x: number, y: number, actionConfig: Record<string, unknown>, actionId: string, runIndex: number): void;
  renderRipple(x: number, y: number, actionConfig: Record<string, unknown>): void;
  renderAnimationEffect(x: number, y: number, actionConfig: Record<string, unknown>): void;
  renderImageEffect(x: number, y: number, actionConfig: Record<string, unknown>): void;
  renderParticles(x: number, y: number, actionConfig: Record<string, unknown>, runIndex: number): void;
  renderOrbitalParticles(x: number, y: number, actionConfig: Record<string, unknown>, runIndex: number): void;
  clearOrbitalParticles(): void;
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
 * 其余子模块占位类型。任务 2.4 各自迁移时替换为具体形状。
 */
export type TriggerHandlersModule = unknown;

export interface EffectEngine {
  visualEffects: VisualEffectsModule;
  cursorOverlay: CursorOverlayModule;
  audioRuntime: AudioRuntimeModule;
  triggerHandlers: TriggerHandlersModule;
}
