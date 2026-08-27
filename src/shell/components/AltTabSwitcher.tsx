import AppIconTile from "../../components/AppIconTile";
import { getApp } from "../appCatalog";
import { type WindowInstance } from "../types";

export function AltTabSwitcher({
  selectedWindowId,
  windows,
}: {
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
              <strong>{app.title}</strong>
              <small>{windowItem.minimized ? "최소화됨" : "열림"}</small>
            </div>
          );
        })}
      </div>
      <small>Alt+Tab</small>
    </section>
  );
}
