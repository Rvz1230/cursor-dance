// CursorDance 效果引擎共享类型
//
// 引擎在扩展端通过 IIFE + window.CursorDanceContentModules 注册（见 public/content-runtime/*）。
// 桌面端把同一套引擎放到 ES module 形态下，并通过 createEffectEngine 注入 window/document/configStore，
// 让 overlay 渲染进程与 Workbench 预览面板共享同一份代码（详见 docs/plans/steady-painting-yeti.md）。

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
 * 引擎模块占位类型。各 createXxx 在阶段 2.1–2.5 单独迁移时会替换为具体形状，
 * 这里先用 unknown 让 entry 编译通过。
 */
export type VisualEffectsModule = unknown;
export type CursorOverlayModule = unknown;
export type AudioRuntimeModule = unknown;
export type TriggerHandlersModule = unknown;

/**
 * config 快照 + 操作接口的占位类型。任务 2.5 迁移 config-store.ts 时替换。
 */
export type ConfigStore = unknown;

/**
 * 创建引擎需要的依赖。
 * 显式注入 window/document 让引擎可以被 overlay 渲染进程、Workbench 预览面板，
 * 甚至单元测试里的 jsdom 复用。
 */
export interface EngineDeps {
  window: Window;
  document: Document;
  configStore: ConfigStore;
}

/**
 * createEffectEngine 返回的对象形状。各字段会在阶段二的后续任务里逐个填充。
 */
export interface EffectEngine {
  visualEffects: VisualEffectsModule;
  cursorOverlay: CursorOverlayModule;
  audioRuntime: AudioRuntimeModule;
  triggerHandlers: TriggerHandlersModule;
}
