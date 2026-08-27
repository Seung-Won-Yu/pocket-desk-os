import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ShellErrorBoundary } from "./ErrorBoundary";
import { registerPocketDeskServiceWorker } from "./pwa/registerServiceWorker";
import { isFramed, renderFrameRefusal } from "./security/frameGuard";
import "./styles.css";

const container = document.getElementById("root")!;

// Refuse to run inside someone else's frame. Checked before the app mounts, so
// no state is created and the service worker is never registered.
if (isFramed()) {
  renderFrameRefusal(container);
} else {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <ShellErrorBoundary>
        <App />
      </ShellErrorBoundary>
    </React.StrictMode>,
  );

  registerPocketDeskServiceWorker();
}
