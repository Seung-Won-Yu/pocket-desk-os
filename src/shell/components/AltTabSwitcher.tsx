import AppIconTile from "../../components/AppIconTile";
import { getApp } from "../appCatalog";
import { formatWindowTitle } from "../windowTitle";
import { type WindowInstance } from "../types";
import { type AppId } from "../../types";

export function AltTabSwitcher({
  getDocumentLabel,
  selectedWindowId,
  windows,
}: {
  getDocumentLabel?: (appId: AppId) => string | undefined;
  selectedWindowId: string;
  windows: WindowInstance[];
}) {
  const orderedWindows = [...windows].sort((a, b) => b.z - a.z);
  if (orderedWindows.length === 0) {
    return null;
  }

  return (
    <section
      aria-atomic="false"
      aria-label="창 전환"
      className="alt-tab-switcher"
      role="status"
    >
      <div className="alt-tab-strip">
        {orderedWindows.map((windowItem) => {
          const app = getApp(windowItem.appId);
          return (
            <div
              aria-current={selectedWindowId === windowItem.id ? "true" : undefined}
              className={`alt-tab-item ${selectedWindowId === windowItem.id ? "is-selected" : ""}`}
              key={windowItem.id}
            >
              <AppIconTile accent={app.accent} icon={app.icon} size="large" />
              {/* The same `문서 - 앱` the title bar shows. Using the document
                  name alone made a Paint window and a Photos window on the same
                  canvas read identically. */}
              <strong>
                {formatWindowTitle(app.title, getDocumentLabel?.(windowItem.appId))}
              </strong>
              <small>{windowItem.minimized ? "최소화됨" : "열림"}</small>
            </div>
          );
        })}
      </div>
      <small>Alt+Tab</small>
    </section>
  );
}
