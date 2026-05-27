import React from "react";
import ReactDOM from "react-dom/client";
import { ToastProvider } from "./src/components/Toast.jsx";
import PrivacyPage from "./src/components/PrivacyPage.jsx";
import "./src/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <PrivacyPage />
    </ToastProvider>
  </React.StrictMode>
);
