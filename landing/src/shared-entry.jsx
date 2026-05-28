/**
 * Shared entry point for landing page MPA.
 * Reduces 3 near-identical {page}-main.jsx files to a single render function.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { ToastProvider } from "./components/Toast.jsx";
import "./index.css";

/**
 * Render a landing page component wrapped in StrictMode + ToastProvider.
 * @param {React.ComponentType} PageComponent — the page to render (AboutPage, PrivacyPage, SupportPage)
 */
export function renderPage(PageComponent) {
  ReactDOM.createRoot(document.getElementById("root")).render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(ToastProvider, null, React.createElement(PageComponent))
    )
  );
}
