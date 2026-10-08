"use client";

import dynamic from "next/dynamic";

const VillageMap = dynamic(() => import("./village-map"), {
  ssr: false,
  loading: () => (
    <div
      className="map-loading"
      style={{
        width: "100%",
        height: "min(58vh, 540px)",
        minHeight: 330,
        marginTop: 16,
      }}
    >
      Loading interactive map…
    </div>
  ),
});

export default function MapCanvas() {
  return <VillageMap />;
}
