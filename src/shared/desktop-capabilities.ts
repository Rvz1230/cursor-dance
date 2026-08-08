type SystemCursorReplacementCapability = {
  status: "supported" | "planned" | "unsupported";
  backend: "bundled-native-helper" | null;
  message: string;
};

type WindowTitleRulesCapability = {
  status: "supported" | "unsupported";
  message: string;
};

export interface DesktopCapabilities {
  systemCursorReplacement: SystemCursorReplacementCapability;
  windowTitleRules: WindowTitleRulesCapability;
}

export function resolveDesktopCapabilities(platform: NodeJS.Platform): DesktopCapabilities {
  if (platform === "darwin") {
    return {
      systemCursorReplacement: {
        status: "supported",
        backend: "bundled-native-helper",
        message: "macOS 使用随应用打包的原生 helper 隐藏系统光标。",
      },
      windowTitleRules: {
        status: "unsupported",
        message: "macOS 首版不申请屏幕录制权限，因此无法读取窗口标题；请使用 Bundle ID 或进程名规则。",
      },
    };
  }

  if (platform === "win32") {
    return {
      systemCursorReplacement: {
        status: "planned",
        backend: null,
        message: "Windows 原生 helper 已进入实验验证；正式启用前仍会保留系统光标，同时显示软件光标预览与跟随效果。",
      },
      windowTitleRules: {
        status: "supported",
        message: "Windows 支持读取前台窗口标题。",
      },
    };
  }

  return {
    systemCursorReplacement: {
      status: "unsupported",
      backend: null,
      message: "当前平台暂不支持替换系统光标，但仍可使用鼠标跟随和点击动效。",
    },
    windowTitleRules: {
      status: "supported",
      message: "当前平台支持读取前台窗口标题。",
    },
  };
}
