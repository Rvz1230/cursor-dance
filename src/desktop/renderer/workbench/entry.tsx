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
