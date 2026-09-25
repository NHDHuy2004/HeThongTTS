"use client";

import * as React from "react";
import "leaflet/dist/leaflet.css";

type Props = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  onChange: (latitude: number, longitude: number) => void;
};

/**
 * Chọn tọa độ GPS bằng Leaflet (OpenStreetMap — không cần API key),
 * hiển thị vòng tròn bán kính điểm danh cho phép.
 */
export function LocationMapPicker({ latitude, longitude, radiusMeters, onChange }: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<import("leaflet").Map | null>(null);
  const markerRef = React.useRef<import("leaflet").CircleMarker | null>(null);
  const circleRef = React.useRef<import("leaflet").Circle | null>(null);
  const onChangeRef = React.useRef(onChange);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    let disposed = false;

    async function init() {
      const L = (await import("leaflet")).default;
      if (disposed || !containerRef.current || mapRef.current) return;

      const start: [number, number] = [latitude, longitude];
      const map = L.map(containerRef.current, {
        center: start,
        zoom: 17,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      markerRef.current = L.circleMarker(start, {
        radius: 7,
        color: "#ffffff",
        weight: 2,
        fillColor: "#059669",
        fillOpacity: 1,
      }).addTo(map);

      circleRef.current = L.circle(start, {
        radius: radiusMeters,
        color: "#059669",
        weight: 2,
        fillColor: "#059669",
        fillOpacity: 0.12,
      }).addTo(map);

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        markerRef.current?.setLatLng([lat, lng]);
        circleRef.current?.setLatLng([lat, lng]);
        onChangeRef.current(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
      });
    }

    init();

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    markerRef.current?.setLatLng([latitude, longitude]);
    circleRef.current?.setLatLng([latitude, longitude]);
  }, [latitude, longitude]);

  React.useEffect(() => {
    circleRef.current?.setRadius(radiusMeters);
  }, [radiusMeters]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="h-64 w-full overflow-hidden rounded-lg border border-border"
        aria-label="Bản đồ chọn vị trí"
      />
      <p className="text-xs text-muted-foreground">
        Click vào bản đồ để chọn tọa độ · Vòng tròn xanh là bán kính điểm danh
        ({radiusMeters} m).
      </p>
    </div>
  );
}
