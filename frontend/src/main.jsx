// PATH: frontend/src/main.jsx
// frontend/src/main.jsx
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthProvider";

// 🔎 Frontend debug (opt-in)
// - enable by: localStorage.DEBUG_FRONTEND = "1" or add ?debug=1
const __FE_DEBUG =
  typeof window !== "undefined" &&
  (String(window.location.search || "").includes("debug=1") ||
    String(window.localStorage?.getItem("DEBUG_FRONTEND") || "") === "1");

if (__FE_DEBUG) {
  // Optional breakpoint:
  // localStorage.DEBUG_BREAK_MAIN = "1"
  if (String(window.localStorage?.getItem("DEBUG_BREAK_MAIN") || "") === "1") {
    debugger; // eslint-disable-line no-debugger
  }

  console.log("[FE_BOOT] main.jsx loaded", {
    at: new Date().toISOString(),
    readyState: typeof document !== "undefined" ? document.readyState : "(no-document)",
    url: typeof window !== "undefined" ? String(window.location.href || "") : "(no-window)",
  });

  window.addEventListener("error", (e) => {
    console.error("[FE_ERROR] window.error", e?.error || e);
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.error("[FE_ERROR] unhandledrejection", e?.reason || e);
  });
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Cannot find #root element");
}

createRoot(rootEl).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);

// frontend/src/main.jsx
// END PATH: frontend/src/main.jsx
