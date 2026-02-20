"use client";

import { useEffect, useMemo, useState } from "react";

interface ScreenRuntimeProps {
  refreshSeconds?: number;
}

export function ScreenRuntime({ refreshSeconds = 90 }: ScreenRuntimeProps) {
  const [now, setNow] = useState(() => new Date());
  const [remainingSeconds, setRemainingSeconds] = useState(refreshSeconds);

  useEffect(() => {
    let remaining = refreshSeconds;

    const timer = window.setInterval(() => {
      setNow(new Date());
      remaining -= 1;

      if (remaining <= 0) {
        window.location.reload();
        return;
      }

      setRemainingSeconds(remaining);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [refreshSeconds]);

  const currentTime = useMemo(
    () =>
      new Intl.DateTimeFormat("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Europe/Istanbul"
      }).format(now),
    [now]
  );

  return (
    <div className="screen-runtime">
      <span>Saat: {currentTime}</span>
      <span>Yenileme: {remainingSeconds}s</span>
    </div>
  );
}
