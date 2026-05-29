# CursorDance AI 数据与隐私说明

## 数据流

当用户使用 AI 方案助手时，扩展向 CursorDance AI 后端发送单次提案请求，包含以下字段：

- 用户提示文本
- 当前动作配置
- 待处理 AI 提案的精简上下文（如有）
- 任务模式
- 扩展版本号
- schema 版本号

前端不会发送完整的可见聊天历史。清除 AI 对话会移除本地面板消息和待处理提案上下文，不会影响已应用的配置。

后端将请求转发至配置的模型服务商（如 DeepSeek 或 OpenAI Responses API），接收 JSON 提案结果。CursorDance 在展示给用户前，对提案进行白名单字段清洗。

## 不会存储的内容

CursorDance 后端代码不得持久化或记录以下内容：

- 完整的用户提示文本
- 完整的 `currentConfig`
- 完整的 `proposalContext`
- 模型发送的完整提示体
- 模型返回的原始响应
- 模型服务商的 API 密钥

## 运维指标

后端可记录以下隐私安全的指标，用于可靠性和成本监控：

- 任务模式
- schema 和扩展版本号
- 提示文本字符数
- 当前配置字节大小
- 提案上下文字节大小
- 原始请求体大小
- 响应状态码和错误码
- 耗时
- 目标数量
- 丢弃字段数

这些日志由 `CURSORDANCE_AI_METRICS_LOG` 控制。设为 `0` 可禁用指标日志。

## 用户控制

AI 提案不会自动应用。模型输出经过清洗、预览后，仅在用户确认时写入配置。

用户可随时清除 AI 对话。这会清除本地对话状态和待处理 AI 提案上下文，同时保留已应用的 CursorDance 配置。

## 成本与防滥用控制

后端强制执行可配置的限制：

- `CURSORDANCE_AI_MAX_REQUEST_BYTES`
- `CURSORDANCE_AI_MAX_PROMPT_CHARS`
- `CURSORDANCE_AI_MAX_CURRENT_CONFIG_BYTES`
- `CURSORDANCE_AI_MAX_PROPOSAL_CONTEXT_BYTES`
- `CURSORDANCE_AI_MAX_OUTPUT_TOKENS`

后端可通过 `CURSORDANCE_AI_API_ACCESS_TOKEN` 要求共享访问 Token。生产环境扩展构建需传入匹配的 `VITE_CURSORDANCE_AI_API_ACCESS_TOKEN`。
