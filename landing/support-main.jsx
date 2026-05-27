import React from "react";
import ReactDOM from "react-dom/client";
import { ToastProvider } from "./src/components/Toast.jsx";
import SupportPage from "./src/components/SupportPage.jsx";
import "./src/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <SupportPage />
    </ToastProvider>
  </React.StrictMode>
);
