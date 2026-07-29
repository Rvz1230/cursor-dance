// 必须在任何业务代码之前注入：useThemeWorkbenchPersistence 在挂载后立刻读
// window.CursorDanceDefaultConfig，import 顺序错了就拿不到。
import "./install-runtime-globals";

import React from "react";
import ReactDOM from "react-dom/client";
import ThemeWorkbenchPage from "@/app/pages/theme-workbench/ThemeWorkbenchPage";
import { TitleBar } from "./TitleBar";
import "../index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeWorkbenchPage renderHeader={() => <TitleBar />} />
  </React.StrictMode>,
);
