# 桌面版发布与回滚

桌面正式版本由 `.github/workflows/release.yml` 唯一发布。普通 CI 产物保持 unsigned，仅用于结构检查和启动 smoke；正式 workflow 缺少签名凭据时会直接失败，不会发布 unsigned 安装包。

## 发布凭据

在 GitHub Actions secrets 中配置：

| Secret | 用途 |
| --- | --- |
| `MAC_CSC_LINK` | Developer ID Application 证书的 base64 内容或受支持的安全 URL |
| `MAC_CSC_KEY_PASSWORD` | macOS 证书密码 |
| `MAC_CSC_NAME` | 完整签名身份，例如 `Developer ID Application: ... (...)` |
| `APPLE_ID` | Apple 公证账号 |
| `APPLE_APP_SPECIFIC_PASSWORD` | Apple app-specific password |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `WIN_CSC_LINK` | Windows code-signing 证书的 base64 内容或受支持的安全 URL |
| `WIN_CSC_KEY_PASSWORD` | Windows 证书密码 |

正式构建会额外验证 macOS `Developer ID Application` 签名、stapled notarization ticket，以及 Windows 应用、原生 helper 和安装器的 Authenticode 签名。任一验证失败时，publish job 不会运行。

## 发布步骤

1. 更新根目录 `package.json` 的版本并完成常规 CI。
2. 创建与版本完全一致的 tag，例如版本 `0.6.1` 只能使用 `v0.6.1`。
3. 推送 tag。也可用 workflow dispatch 重新执行一个已存在的 tag。
4. workflow 分别构建 macOS arm64 ZIP 和 Windows x64 NSIS，执行结构检查与最终可执行文件 smoke。
5. 两端均成功后，publish job 汇总安装包、blockmap 和 `latest*.yml`，生成 `SHA256SUMS.txt`，先创建 draft Release，上传完整产物后再公开。

更新器只消费该 workflow 同批生成的安装包、blockmap 和元数据。不要单独替换 `latest*.yml`、blockmap 或同版本安装包。

## 失败恢复

- 打包、验签或 smoke 失败：修复后重新创建新 tag；如果代码和版本未变，也可对原 tag 执行 workflow dispatch。
- 上传阶段失败：workflow 会保留 draft Release。重新执行同一 tag 时只允许续传 draft，并在完整上传后公开。
- 同 tag 已有公开 Release：workflow 会拒绝覆盖，避免用户缓存、元数据和安装包产生不一致。

## 回滚策略

自动更新不做降级。发现严重问题时：

1. 立即将问题 Release 改为 draft，阻止尚未检查更新的客户端继续发现它。
2. 修复后提升补丁版本并发布新 tag；不要覆盖问题版本的文件。
3. 已安装问题版本的用户通过更高版本正常升级。确需降级时，只能提供人工卸载/安装说明，并明确 electron-store 的 userData 默认保留。
4. 保留问题 Release 的产物和校验和用于调查，确认恢复后再决定是否删除 draft。

如果下载已经完成，客户端仍可能持有本地更新包，因此下架 Release 不能替代尽快发布更高版本的修复。
