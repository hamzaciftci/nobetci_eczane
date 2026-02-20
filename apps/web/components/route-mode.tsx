"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type RouteMode = "default" | "print" | "fullscreen";

export function RouteMode() {
  const pathname = usePathname();
  const mode = resolveRouteMode(pathname ?? "");

  useEffect(() => {
    document.body.setAttribute("data-route-mode", mode);
    return () => {
      document.body.setAttribute("data-route-mode", "default");
    };
  }, [mode]);

  return null;
}

function resolveRouteMode(pathname: string): RouteMode {
  if (pathname.includes("/nobetci-eczane/") && pathname.includes("/yazdir")) {
    return "print";
  }

  if (pathname.includes("/nobetci-eczane/") && pathname.includes("/ekran")) {
    return "fullscreen";
  }

  return "default";
}
