export function normalizeTextCandidate(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, "").trim() : "";
}

export function inferTextKindFromEffect(
  textEffect: Record<string, unknown> | undefined,
  fallbackKind = "数字飘字",
): string {
  if (textEffect?.kind === "text") return "文本飘字";
  if (textEffect?.kind === "number") return "数字飘字";

  const tags = Array.isArray(textEffect?.tags) ? textEffect.tags.filter(Boolean) : [];
  if (tags.length > 1) return "文本飘字";

  const content = typeof textEffect?.content === "string" ? textEffect.content.trim() : "";
  if (!content) return fallbackKind;
  if (content.includes("${number}")) return "数字飘字";

  const compactContent = content.replace(/\s+/g, "");
  if (/^[+\-]?\d+$/.test(compactContent)) return "数字飘字";
  if (/^[+\-]?[一二三四五六七八九十百千万]+$/.test(compactContent)) return "数字飘字";
  if (/^(one|two|three|four|five|six|seven|eight|nine|ten)$/i.test(compactContent)) return "数字飘字";

  return "文本飘字";
}

export function resolveNumberStyleFromEffect(
  textEffect: Record<string, unknown> | undefined,
  fallbackStyle: string,
): string {
  const numberStyle = String(textEffect?.numberStyle || "").toLowerCase();
  if (numberStyle.includes("zh") || numberStyle.includes("cn") || numberStyle.includes("中文")) {
    return "中文数字 (一, 二, 三)";
  }
  if (numberStyle.includes("en") || numberStyle.includes("英文")) {
    return "英文单词 (one, two, three)";
  }
  if (numberStyle.includes("arabic") || numberStyle.includes("digit") || numberStyle.includes("阿拉伯")) {
    return "阿拉伯数字 (1, 2, 3)";
  }
  return fallbackStyle;
}

export function resolveTextModeFromEffect(
  textEffect: Record<string, unknown> | undefined,
  fallbackMode: string,
): string {
  if (textEffect?.mode === "template") return "模板模式";
  if (textEffect?.mode === "default") return "默认模式 (+1)";
  if (typeof textEffect?.template === "string" && textEffect.template.includes("${number}")) return "模板模式";
  if (typeof textEffect?.content === "string" && textEffect.content.includes("${number}")) return "模板模式";
  return fallbackMode;
}

export function shouldPreserveBaseNumberSemantics(
  baseActionConfig: Record<string, unknown> | undefined,
  textEffect: Record<string, unknown> | undefined,
  textTags: string[],
  primaryText: string,
): boolean {
  if (baseActionConfig?.textKind !== "数字飘字") return false;
  if (textEffect?.kind === "text") return false;
  if (textEffect?.kind === "number") return true;

  const candidateTexts = [primaryText, ...textTags].map(normalizeTextCandidate).filter(Boolean);
  if (!candidateTexts.length) return true;

  const baseTexts = [baseActionConfig?.textContent, ...((baseActionConfig?.textTags as string[]) || [])]
    .map(normalizeTextCandidate)
    .filter(Boolean);
  if (!baseTexts.length) return false;

  return candidateTexts.every((item) => baseTexts.includes(item));
}

export function resolveActionTextConfigFromEffect(
  baseActionConfig: Record<string, unknown>,
  textEffect: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const textTags = Array.isArray(textEffect?.tags) ? textEffect.tags.filter(Boolean) : [];
  const primaryText = typeof textEffect?.content === "string" ? textEffect.content.trim() : "";
  const preserveBaseNumberSemantics = shouldPreserveBaseNumberSemantics(baseActionConfig, textEffect, textTags, primaryText);
  const textKind = preserveBaseNumberSemantics
    ? "数字飘字"
    : inferTextKindFromEffect(textEffect, baseActionConfig.textKind as string);
  const textStyle = resolveNumberStyleFromEffect(textEffect, baseActionConfig.textStyle as string);
  const textMode = resolveTextModeFromEffect(textEffect, baseActionConfig.textMode as string);

  if (textKind === "文本飘字") {
    const orderedTags = Array.from(
      new Set(
        [primaryText, ...textTags, ...(primaryText || textTags.length ? [] : ((baseActionConfig.textTags as string[]) || []))]
          .filter(Boolean),
      ),
    );
    return {
      textKind,
      textStyle,
      textMode,
      textTemplate: baseActionConfig.textTemplate,
      textContent: orderedTags[0] ?? "",
      textTags: orderedTags,
      textTagPlayMode: textEffect?.tagPlayMode || baseActionConfig.textTagPlayMode,
      textFontFamily: textEffect?.fontFamily || baseActionConfig.textFontFamily,
      comboEnabled: false,
    };
  }

  return {
    textKind,
    textStyle,
    textMode,
    textTemplate:
      typeof textEffect?.template === "string" && textEffect.template
        ? textEffect.template
        : (typeof textEffect?.content === "string" && textEffect.content.includes("${number}")
          ? textEffect.content
          : baseActionConfig.textTemplate),
    textContent: "",
    textTags: Array.isArray(baseActionConfig.textTags) ? baseActionConfig.textTags : [],
    textTagPlayMode: baseActionConfig.textTagPlayMode,
    textFontFamily: textEffect?.fontFamily || baseActionConfig.textFontFamily,
    comboEnabled: textEffect?.comboEnabled ?? baseActionConfig.comboEnabled,
  };
}

export function buildStoredTextEffectPayload(
  actionConfig: Record<string, unknown>,
  orderedTextTags: string[],
): Record<string, unknown> {
  const textContent =
    actionConfig.textKind === "数字飘字"
      ? actionConfig.textMode === "模板模式"
        ? (actionConfig.textTemplate as string).replace("${number}", "1")
        : ""
      : orderedTextTags[0] || actionConfig.textContent || "";

  return {
    kind: actionConfig.textKind === "文本飘字" ? "text" : "number",
    numberStyle: actionConfig.textStyle,
    mode: actionConfig.textMode === "模板模式" ? "template" : "default",
    template: actionConfig.textTemplate,
    tags: orderedTextTags,
    tagPlayMode: actionConfig.textTagPlayMode,
    fontFamily: actionConfig.textFontFamily,
    comboEnabled: actionConfig.comboEnabled,
    content: textContent,
  };
}
