import { useEffect, useState } from "react";

export function Clock({ hour24 }: { hour24: boolean }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <time className="tray-clock" dateTime={now.toISOString()}>
      <span>
        {now.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          hour12: !hour24,
          minute: "2-digit",
        })}
      </span>
      <span>{now.toLocaleDateString("ko-KR", { day: "2-digit", month: "2-digit" })}</span>
    </time>
  );
}
