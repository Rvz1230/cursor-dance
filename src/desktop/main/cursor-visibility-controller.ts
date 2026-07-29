import type { ChildProcessWithoutNullStreams } from "node:child_process";

const WATCHDOG_INTERVAL_MS = 2_000;
const MAX_RESTARTS_PER_WINDOW = 3;
const RESTART_WINDOW_MS = 30_000;

export interface CursorVisibilityController {
  setHidden(hidden: boolean): void;
  stop(): void;
}

type Log = Pick<Console, "error" | "info">;

export function createCursorVisibilityController({
  spawnHelper,
  log = console,
  onUnavailable = () => undefined,
  platformLabel = "macOS",
}: {
  spawnHelper: () => ChildProcessWithoutNullStreams;
  log?: Log;
  onUnavailable?: () => void;
  platformLabel?: string;
}): CursorVisibilityController {
  const logPrefix = `[cursordance] ${platformLabel} cursor helper`;
  let helper: ChildProcessWithoutNullStreams | null = null;
  let helperReady = false;
  let desiredHidden = false;
  let acknowledgedHidden = false;
  let awaitingPong = false;
  let pendingRecovery = false;
  let stopping = false;
  let stdoutBuffer = "";
  let watchdogTimer: ReturnType<typeof setInterval> | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let restartTimestamps: number[] = [];

  function clearWatchdog(): void {
    if (watchdogTimer) clearInterval(watchdogTimer);
    watchdogTimer = null;
    awaitingPong = false;
  }

  function writeCommand(command: "hide" | "show" | "ping" | "recover" | "quit"): boolean {
    const target = helper;
    if (!target || target.killed) return false;
    target.stdin.write(`${command}\n`, (error) => {
      if (error) log.error(`${logPrefix} 写入失败:`, error);
    });
    return true;
  }

  function markUnavailable(): void {
    desiredHidden = false;
    acknowledgedHidden = false;
    pendingRecovery = false;
    restartTimestamps = [];
    onUnavailable();
    log.error(`${logPrefix} 连续失败，已停止隐藏系统光标`);
  }

  function scheduleRestart(recoverFirst: boolean): void {
    if (stopping) return;
    pendingRecovery ||= recoverFirst;
    if (!pendingRecovery && !desiredHidden) return;
    if (restartTimer) return;

    const now = Date.now();
    restartTimestamps = restartTimestamps.filter((timestamp) => now - timestamp < RESTART_WINDOW_MS);
    if (restartTimestamps.length >= MAX_RESTARTS_PER_WINDOW) {
      markUnavailable();
      return;
    }
    restartTimestamps.push(now);
    const delay = 100 * (2 ** (restartTimestamps.length - 1));
    restartTimer = setTimeout(() => {
      restartTimer = null;
      ensureHelper();
    }, delay);
    restartTimer.unref();
  }

  function handleProtocolLine(line: string): void {
    if (line === "ready") {
      helperReady = true;
      awaitingPong = false;
      if (pendingRecovery) {
        writeCommand("recover");
        pendingRecovery = false;
      }
      writeCommand(desiredHidden ? "hide" : "show");
      if (!watchdogTimer) {
        watchdogTimer = setInterval(() => {
          if (!helperReady || !helper) return;
          if (awaitingPong) {
            log.error(`${logPrefix} watchdog 超时，正在重启`);
            const unresponsiveHelper = helper;
            helperReady = false;
            clearWatchdog();
            unresponsiveHelper.kill("SIGTERM");
            return;
          }
          awaitingPong = true;
          writeCommand("ping");
        }, WATCHDOG_INTERVAL_MS);
        watchdogTimer.unref();
      }
      return;
    }
    if (line === "hidden") {
      acknowledgedHidden = true;
      log.info(`[cursordance] ${platformLabel} native cursor hidden: true`);
      return;
    }
    if (line === "shown") {
      acknowledgedHidden = false;
      log.info(`[cursordance] ${platformLabel} native cursor hidden: false`);
      return;
    }
    if (line === "pong") {
      awaitingPong = false;
      restartTimestamps = [];
      return;
    }
    if (line === "error") {
      log.error(`${logPrefix} 返回错误，正在重启`);
      const failedHelper = helper;
      helperReady = false;
      clearWatchdog();
      failedHelper?.kill("SIGTERM");
    }
  }

  function handleHelperClose(target: ChildProcessWithoutNullStreams, code: number | null, signal: NodeJS.Signals | null): void {
    if (helper !== target) return;
    const recoverFirst = acknowledgedHidden;
    helper = null;
    helperReady = false;
    acknowledgedHidden = false;
    stdoutBuffer = "";
    clearWatchdog();
    if (stopping) return;
    log.error(`${logPrefix} 意外退出:`, { code, signal });
    scheduleRestart(recoverFirst);
  }

  function ensureHelper(): void {
    if (stopping || (helper && !helper.killed)) return;
    let nextHelper: ChildProcessWithoutNullStreams;
    try {
      nextHelper = spawnHelper();
    } catch (error) {
      log.error(`${logPrefix} 启动失败:`, error);
      scheduleRestart(false);
      return;
    }
    helper = nextHelper;
    helperReady = false;
    stdoutBuffer = "";

    nextHelper.once("error", (error) => {
      log.error(`${logPrefix} 启动失败:`, error);
    });
    nextHelper.stderr.on("data", (chunk) => {
      log.error(`${logPrefix} 错误:`, String(chunk).trim());
    });
    nextHelper.stdout.on("data", (chunk) => {
      stdoutBuffer += String(chunk);
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) handleProtocolLine(line.trim());
    });
    nextHelper.on("close", (code, signal) => handleHelperClose(nextHelper, code, signal));
  }

  function setHidden(nextHidden: boolean): void {
    if (stopping) return;
    const changed = desiredHidden !== nextHidden;
    desiredHidden = nextHidden;
    if (!nextHidden) {
      restartTimestamps = [];
      if (restartTimer) clearTimeout(restartTimer);
      restartTimer = null;
      if (!helper && !pendingRecovery) return;
    }
    ensureHelper();
    if (helperReady && changed) writeCommand(nextHidden ? "hide" : "show");
  }

  function stop(): void {
    stopping = true;
    desiredHidden = false;
    pendingRecovery = false;
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = null;
    clearWatchdog();
    const target = helper;
    helper = null;
    if (!target || target.killed) return;
    target.stdin.write("show\nquit\n", (error) => {
      if (error) log.error(`${logPrefix} 退出写入失败:`, error);
    });
    const killTimer = setTimeout(() => {
      if (!target.killed) target.kill("SIGTERM");
    }, 1_000);
    killTimer.unref();
    target.once("close", () => clearTimeout(killTimer));
  }

  return { setHidden, stop };
}
