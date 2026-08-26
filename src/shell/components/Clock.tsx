import { useEffect, useState } from "react";

export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <time className="tray-clock" dateTime={now.toISOString()}>
      <span>{now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
      <span>{now.toLocaleDateString("ko-KR", { day: "2-digit", month: "2-digit" })}</span>
    </time>
  );
}
