// 必须在任何业务代码之前注入：useThemeWorkbenchPersistence 在挂载后立刻读
// window.CursorDanceDefaultConfig，import 顺序错了就拿不到。
import "./install-runtime-globals";
import { installAiEndpointGlobals } from "./install-ai-endpoints";

import React from "react";
import ReactDOM from "react-dom/client";
import ThemeWorkbenchPage from "@/app/pages/theme-workbench/ThemeWorkbenchPage";
import { TitleBar } from "./TitleBar";
import "../index.css";

// 渲染前先把嵌入 AI 服务的 endpoint 注入到 globalThis，让 client.js 直接拿到。
// 失败也继续渲染——AI 面板自身有错误展示。
await installAiEndpointGlobals();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeWorkbenchPage renderHeader={() => <TitleBar />} />
  </React.StrictMode>,
);
