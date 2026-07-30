type SystemCursorReplacementCapability = {
  status: "supported" | "planned" | "unsupported";
  backend: "bundled-native-helper" | null;
  message: string;
};

export interface DesktopCapabilities {
  systemCursorReplacement: SystemCursorReplacementCapability;
}

export function resolveDesktopCapabilities(platform: NodeJS.Platform): DesktopCapabilities {
  if (platform === "darwin") {
    return {
      systemCursorReplacement: {
        status: "supported",
        backend: "bundled-native-helper",
        message: "macOS 使用随应用打包的原生 helper 隐藏系统光标。",
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
    };
  }

  return {
    systemCursorReplacement: {
      status: "unsupported",
      backend: null,
      message: "当前平台暂不支持替换系统光标，但仍可使用鼠标跟随和点击动效。",
    },
  };
}
