export function getAiRequestErrorMessage(error) {
  const code = error?.code || "";
  const status = error?.status;
  const message = error instanceof Error
    ? error.message
    : (typeof error?.message === "string" ? error.message : String(error || ""));

  if (code === "timeout") return "AI 请求超时，请稍后重试。";
  if (code === "network") return "后端未连接，请确认 AI API 服务已启动。";
  if (status === 401 || status === 403) return "AI API 权限校验失败，请检查访问 token。";
  if (status === 400 || status === 413 || code === "invalid_request") return message || "请求内容超出限制，请缩短描述后重试。";
  if (status === 422 || code === "invalid_schema") return "AI 返回结构无效，已拒绝应用，请重新生成。";
  if (code === "provider_failed" && message === "AI model provider is not configured") return "AI 模型服务未配置，请先在 AI 服务设置中填写 API Key。";
  if (status === 502 || status === 503 || code === "provider_failed") return message || "AI 模型服务暂时失败，请稍后重试。";
  return message || "生成失败，请稍后重试。";
}
