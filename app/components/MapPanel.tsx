"use client";

import dynamic from "next/dynamic";
import { Map } from "lucide-react";
import type { Pharmacy } from "@/app/lib/duty";

const MapPanelLeaflet = dynamic(() => import("./MapPanelLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border bg-muted/50 flex items-center justify-center min-h-[200px]">
      <div className="text-center text-muted-foreground">
        <Map className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-xs font-medium">Harita yükleniyor...</p>
      </div>
    </div>
  ),
});

interface Props {
  pharmacies: Pharmacy[];
}

export function MapPanel({ pharmacies }: Props) {
  return <MapPanelLeaflet pharmacies={pharmacies} />;
}

export default MapPanel;
