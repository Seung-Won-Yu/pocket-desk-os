import type { LucideIcon } from "lucide-react";
import type React from "react";

export default function AppIconTile({
  accent,
  className = "",
  icon: Icon,
  size = "medium",
  tone = "app",
}: {
  accent: string;
  className?: string;
  icon: LucideIcon;
  size?: "tiny" | "small" | "medium" | "large";
  tone?: "app" | "file";
}) {
  const iconSize = size === "large" ? 26 : size === "medium" ? 22 : size === "small" ? 17 : 14;

  return (
    <span
      aria-hidden="true"
      className={`app-icon-tile app-icon-${size} app-icon-${tone} ${className}`.trim()}
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <Icon aria-hidden="true" size={iconSize} strokeWidth={2.35} />
    </span>
  );
}
