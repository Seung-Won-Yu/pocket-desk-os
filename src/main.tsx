import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ShellErrorBoundary } from "./ErrorBoundary";
import { registerPocketDeskServiceWorker } from "./pwa/registerServiceWorker";
import { isFramed, renderFrameRefusal } from "./security/frameGuard";
import { applyTaskbarLayout, loadTaskbarLayout } from "./shell/taskbarPosition";
import "./styles.css";

const container = document.getElementById("root")!;

// Refuse to run inside someone else's frame. Checked before the app mounts, so
// no state is created and the service worker is never registered.
if (isFramed()) {
  renderFrameRefusal(container);
} else {
  // Before the first paint, so the bar never flashes at the bottom on the way
  // to the edge the user chose — and so the first geometry React computes is
  // already measured against the right work area.
  applyTaskbarLayout(loadTaskbarLayout());

  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <ShellErrorBoundary>
        <App />
      </ShellErrorBoundary>
    </React.StrictMode>,
  );

  registerPocketDeskServiceWorker();
}
