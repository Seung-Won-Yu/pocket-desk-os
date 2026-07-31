import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ShellErrorBoundary } from "./ErrorBoundary";
import { registerPocketDeskServiceWorker } from "./pwa/registerServiceWorker";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ShellErrorBoundary>
      <App />
    </ShellErrorBoundary>
  </React.StrictMode>,
);

registerPocketDeskServiceWorker();
