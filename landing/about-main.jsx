import React from "react";
import ReactDOM from "react-dom/client";
import { ToastProvider } from "./src/components/Toast.jsx";
import AboutPage from "./src/components/AboutPage.jsx";
import "./src/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <AboutPage />
    </ToastProvider>
  </React.StrictMode>
);
