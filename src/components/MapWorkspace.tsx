import L from "leaflet";
import { Link2, Scan, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  ScaleControl,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";

import { basemapProviders, type BasemapKind, type BasemapProvider } from "../lib/basemaps";
import { formatCount } from "../lib/format";
import type { CoOccurrencePair, TrajectoryStep, UserDetail } from "../types";
import TimelinePlayer from "./TimelinePlayer";

interface MapWorkspaceProps {
  detailA: UserDetail;
  detailB: UserDetail;
  coPairs: CoOccurrencePair[];
  highlightedPair: number | null;
  /** A pinned pair (clicked in the table or on the map); drives fly-to. */
  focusedPair: number | null;
  onHighlight: (index: number | null) => void;
  onSelectPair: (index: number | null) => void;
  /** Open the "Why this match?" drawer; null explains the whole pair. */
  onExplain?: (index: number | null) => void;
  /** 0-based token indices masked by the live what-if; preview steps map to step-1. */
  maskedStepsA?: number[];
  maskedStepsB?: number[];
  /** 0-based token indices removed by the evidence-removal lab. */
  removedStepsA?: number[];
  removedStepsB?: number[];
  /** Tokens selected from the attention heatmap; located even outside the preview. */
  focusTokens?: {
    a: { token: number; lon: number | null; lat: number | null };
    b: { token: number; lon: number | null; lat: number | null };
  } | null;
}

type ViewMode = "cooccurrence" | "both";

interface PlotPoint {
  lon: number;
  lat: number;
  step: number;
  locId: number;
  timeId: number;
  timestamp: number;
}

const COLOR_A = "#2563EB";
const COLOR_B = "#E11D48";
const COLOR_CO = "#10B981";
const COLOR_CO_ACTIVE = "#047857";

const toPlotPoints = (steps: TrajectoryStep[]): PlotPoint[] =>
  steps
    .filter(
      (step): step is TrajectoryStep & { lon: number; lat: number } =>
        step.lon !== null && step.lat !== null,
    )
    .map((step) => ({
      lon: step.lon,
      lat: step.lat,
      step: step.step,
      locId: step.loc_id,
      timeId: step.time_id,
      timestamp: step.timestamp,
    }));

const distanceLabel = (metres: number) =>
  metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(2)} km`;

const pairLatLngs = (pair: CoOccurrencePair): [number, number][] => {
  const points: [number, number][] = [];
  if (pair.a.lon !== null && pair.a.lat !== null) points.push([pair.a.lat, pair.a.lon]);
  if (pair.b.lon !== null && pair.b.lat !== null) points.push([pair.b.lat, pair.b.lon]);
  return points;
};

/**
 * One Leaflet map for both platforms and their co-occurrence points.
 *
 * This deliberately replaces the previous three hand-drawn SVG panels. Leaflet owns
 * pan/zoom, tile lifecycle and projection; the component below only decides what to
 * draw. The default view fits the co-occurrence cluster, because that cluster is the
 * evidence a matching demo is trying to show; `Both` switches to the full A+B extent,
 * which is what makes world-spanning Twitter/Facebook pairs legible. The map stays
 * pannable after any fit.
 */
export default function MapWorkspace({
  detailA,
  detailB,
  coPairs,
  highlightedPair,
  focusedPair,
  onHighlight,
  onSelectPair,
  onExplain,
  maskedStepsA,
  maskedStepsB,
  removedStepsA,
  removedStepsB,
  focusTokens,
}: MapWorkspaceProps) {
  const pointsA = useMemo(() => toPlotPoints(detailA.preview), [detailA.preview]);
  const pointsB = useMemo(() => toPlotPoints(detailB.preview), [detailB.preview]);
  const coPoints = useMemo(() => {
    const points: { lon: number; lat: number }[] = [];
    coPairs.forEach((pair) => {
      if (pair.a.lon !== null && pair.a.lat !== null) points.push({ lon: pair.a.lon, lat: pair.a.lat });
      if (pair.b.lon !== null && pair.b.lat !== null) points.push({ lon: pair.b.lon, lat: pair.b.lat });
    });
    return points;
  }, [coPairs]);

  const [viewMode, setViewMode] = useState<ViewMode>("cooccurrence");
  const [showA, setShowA] = useState(true);
  const [showB, setShowB] = useState(true);
  const [showCo, setShowCo] = useState(true);
  const [showCheckins, setShowCheckins] = useState(false);
  const [basemapUnavailable, setBasemapUnavailable] = useState(false);
  const [fitNonce, setFitNonce] = useState(0);
  const [currentTime, setCurrentTime] = useState(Number.POSITIVE_INFINITY);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const currentTimeRef = useRef(Number.POSITIVE_INFINITY);

  // A new user pair starts from the evidence view again instead of inheriting the
  // previous pair's pan/zoom or layer choice.
  useEffect(() => {
    setViewMode("cooccurrence");
    setShowA(true);
    setShowB(true);
    setShowCo(true);
    setShowCheckins(false);
    setFitNonce((value) => value + 1);
    setPlaying(false);
    setCurrentTime(Number.POSITIVE_INFINITY);
    currentTimeRef.current = Number.POSITIVE_INFINITY;
  }, [detailA.user_id, detailB.user_id]);

  const timeline = useMemo(() => {
    const times = [...pointsA, ...pointsB].map((point) => point.timestamp);
    if (!times.length) return null;
    const min = Math.min(...times);
    const max = Math.max(...times);
    return { min, max, span: Math.max(max - min, 1), seconds: max > 1e8 };
  }, [pointsA, pointsB]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (!playing || !timeline) return;
    const duration = speed === 1 ? 18000 : 9000;
    const startedAt = performance.now();
    const base = currentTimeRef.current >= timeline.max ? timeline.min : currentTimeRef.current;
    setCurrentTime(base);
    currentTimeRef.current = base;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const value = base + progress * (timeline.max - timeline.min);
      setCurrentTime(value);
      currentTimeRef.current = value;
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, timeline]);

  const effectiveTime = timeline ? Math.min(currentTime, timeline.max) : 0;
  const removedSetA = useMemo(() => new Set(removedStepsA ?? []), [removedStepsA]);
  const removedSetB = useMemo(() => new Set(removedStepsB ?? []), [removedStepsB]);
  const visibleA = useMemo(
    () =>
      pointsA.filter(
        (point) =>
          point.timestamp <= effectiveTime && !removedSetA.has(point.step - 1),
      ),
    [pointsA, effectiveTime, removedSetA],
  );
  const visibleB = useMemo(
    () =>
      pointsB.filter(
        (point) =>
          point.timestamp <= effectiveTime && !removedSetB.has(point.step - 1),
      ),
    [pointsB, effectiveTime, removedSetB],
  );
  const maskedSetA = useMemo(() => new Set(maskedStepsA ?? []), [maskedStepsA]);
  const maskedSetB = useMemo(() => new Set(maskedStepsB ?? []), [maskedStepsB]);
  const visibleCoPairs = useMemo(
    () =>
      coPairs.filter((pair) => {
        const lastSide = Math.max(pair.a.slot, pair.b.slot);
        return (
          lastSide <= effectiveTime &&
          !removedSetA.has(pair.a.step - 1) &&
          !removedSetB.has(pair.b.step - 1)
        );
      }),
    [coPairs, effectiveTime, removedSetA, removedSetB],
  );
  const timelineFiltered =
    Boolean(timeline) && (playing || (timeline !== null && effectiveTime < timeline.max));

  const togglePlayback = () => {
    if (!timeline) return;
    if (playing) {
      setPlaying(false);
      return;
    }
    if (effectiveTime >= timeline.max) setCurrentTime(timeline.min);
    setPlaying(true);
  };

  const fitPoints = useMemo(() => {
    // Co-occurrence focuses the shared cluster; when there is no shared cluster it
    // falls back to the full A+B extent, exactly like Both. Both always uses every
    // plotted point, including the outliers, so a world-spanning pair is fully visible.
    if (viewMode === "cooccurrence" && coPoints.length > 0) return coPoints;
    return [...pointsA, ...pointsB];
  }, [viewMode, pointsA, pointsB, coPoints]);

  const fitSignature = `${detailA.user_id}-${detailB.user_id}-${viewMode}-${coPairs.length}-${fitPoints.length}`;

  const focusBounds = useMemo(() => {
    if (focusedPair === null) return null;
    const pair = coPairs[focusedPair];
    if (!pair) return null;
    const latlngs = pairLatLngs(pair);
    if (!latlngs.length) return null;
    const bounds = L.latLngBounds(latlngs);
    return bounds.isValid() ? bounds : null;
  }, [focusedPair, coPairs]);

  const tokenFocusBounds = useMemo(() => {
    if (!focusTokens) return null;
    const latlngs: [number, number][] = [];
    for (const point of [focusTokens.a, focusTokens.b]) {
      if (point.lon !== null && point.lat !== null) latlngs.push([point.lat, point.lon]);
    }
    if (!latlngs.length) return null;
    const bounds = L.latLngBounds(latlngs);
    return bounds.isValid() ? bounds : null;
  }, [focusTokens]);

  const activePair = highlightedPair ?? focusedPair;
  const hasCoordinates = pointsA.length > 0 || pointsB.length > 0;
  const cooccurrenceFallback = viewMode === "cooccurrence" && coPoints.length === 0;
  const mappedPairCount = coPairs.filter((pair) => pairLatLngs(pair).length === 2).length;

  if (!hasCoordinates) {
    return (
      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-soft">
        <h3 className="text-sm font-bold text-blue-900">Trajectory map</h3>
        <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-xs leading-5 text-amber-900">
          Neither selected user has a coordinate in the released files, so nothing can be plotted.
          The check-in sequences and the match result are still shown below.
        </p>
      </section>
    );
  }

  return (
    <section id="trajectory-map" className="scroll-mt-24 rounded-2xl border border-blue-100 bg-white p-4 shadow-soft sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-blue-900">Trajectory map</h3>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              {formatCount(coPairs.length)} co-occurrence point(s)
            </span>
            {cooccurrenceFallback && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                no shared cluster · showing full trajectories
              </span>
            )}
            {timelineFiltered && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                time filter · {visibleCoPairs.length}/{coPairs.length} C points
              </span>
            )}
            {removedSetA.size + removedSetB.size > 0 && (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                evidence removed
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">
            {detailA.platform.toUpperCase()} · user {detailA.user_id} ({formatCount(pointsA.length)} mapped
            check-ins) ↔ {detailB.platform.toUpperCase()} · user {detailB.user_id} (
            {formatCount(pointsB.length)} mapped check-ins). Drag to pan; use the +/− buttons to zoom.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <div className="flex rounded-lg border border-blue-100 bg-blue-50/50 p-0.5">
            {(
              [
                ["cooccurrence", "Co-occurrence", "Zoom to the shared co-occurrence points"],
                ["both", "Both", "Zoom to the full A+B extent, including world-spanning outliers"],
              ] as const
            ).map(([mode, label, hint]) => (
              <button
                key={mode}
                type="button"
                title={hint}
                onClick={() => {
                  setViewMode(mode);
                  // "Both" means show both platforms, so bring hidden layers back.
                  if (mode === "both") {
                    setShowA(true);
                    setShowB(true);
                  }
                }}
                className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition ${
                  viewMode === mode ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-blue-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {onExplain && (
            <button
              type="button"
              onClick={() => onExplain(null)}
              className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
              title="Explain the score and the co-occurrence evidence"
            >
              <Sparkles size={11} /> Why this match?
            </button>
          )}

          <button
            type="button"
            onClick={() => setFitNonce((value) => value + 1)}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 hover:border-blue-200 hover:text-blue-600"
            title="Fit the map to the current view mode"
          >
            <Scan size={11} /> Fit
          </button>

          {focusedPair !== null && (
            <button
              type="button"
              onClick={() => onSelectPair(null)}
              className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
              title="Clear the pinned co-occurrence point"
            >
              <X size={11} /> Clear pin
            </button>
          )}

        </div>
      </header>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
        <LayerToggle active={showA} color={COLOR_A} label={`${detailA.platform.toUpperCase()} trajectory`} onClick={() => setShowA((value) => !value)} />
        <LayerToggle active={showB} color={COLOR_B} label={`${detailB.platform.toUpperCase()} trajectory`} onClick={() => setShowB((value) => !value)} />
        <LayerToggle active={showCo} color={COLOR_CO} label="Co-occurrence" onClick={() => setShowCo((value) => !value)} />
        <LayerToggle active={showCheckins} color="#94A3B8" label="All check-ins" onClick={() => setShowCheckins((value) => !value)} />
        <span className="ml-auto text-slate-400">
          {formatCount(mappedPairCount)} of {formatCount(coPairs.length)} pairs mappable
        </span>
      </div>

      <div className="relative mt-3 h-[440px] overflow-hidden rounded-xl border border-blue-100 bg-[#E8EEF2] sm:h-[540px] xl:h-[660px]">
        <MapContainer
          center={[31.2304, 121.4737]}
          zoom={11}
          minZoom={1}
          maxZoom={19}
          scrollWheelZoom={false}
          preferCanvas
          zoomControl={false}
          className="h-full w-full"
          style={{ height: "100%", width: "100%" }}
        >
          <BasemapLayer kind="street" onUnavailable={setBasemapUnavailable} />

          <MapViewSync
            points={fitPoints}
            signature={fitSignature}
            focusBounds={focusBounds}
            tokenFocusBounds={tokenFocusBounds}
            fitNonce={fitNonce}
          />

          <ZoomControl position="bottomright" />
          <ScaleControl position="bottomleft" imperial={false} />

          {showA && visibleA.length > 1 && (
            <>
              <Polyline
                positions={visibleA.map((point) => [point.lat, point.lon])}
                pathOptions={{
                  color: "#FFFFFF",
                  weight: 8,
                  opacity: activePair === null ? 0.9 : 0.35,
                  lineCap: "round",
                  lineJoin: "round",
                }}
                interactive={false}
              />
              <Polyline
                positions={visibleA.map((point) => [point.lat, point.lon])}
                pathOptions={{
                  color: COLOR_A,
                  weight: 4,
                  opacity: activePair === null ? 0.95 : 0.3,
                  lineCap: "round",
                  lineJoin: "round",
                }}
                interactive={false}
              />
            </>
          )}

          {showB && visibleB.length > 1 && (
            <>
              <Polyline
                positions={visibleB.map((point) => [point.lat, point.lon])}
                pathOptions={{
                  color: "#FFFFFF",
                  weight: 8,
                  opacity: activePair === null ? 0.9 : 0.35,
                  lineCap: "round",
                  lineJoin: "round",
                }}
                interactive={false}
              />
              <Polyline
                positions={visibleB.map((point) => [point.lat, point.lon])}
                pathOptions={{
                  color: COLOR_B,
                  weight: 4,
                  opacity: activePair === null ? 0.95 : 0.3,
                  lineCap: "round",
                  lineJoin: "round",
                }}
                interactive={false}
              />
            </>
          )}

          {showCheckins &&
            showA &&
            visibleA.map((point) => (
              <CircleMarker
                key={`a-${point.step}`}
                center={[point.lat, point.lon]}
                radius={2.6}
                pathOptions={{
                  color: COLOR_A,
                  weight: 0.8,
                  fillColor: COLOR_A,
                  fillOpacity: activePair === null ? 0.5 : 0.15,
                }}
              >
                <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                  <span className="text-[10px] leading-4">
                    {detailA.platform.toUpperCase()} · step {point.step}
                    <br />
                    loc {point.locId} · time id {point.timeId}
                    <br />
                    {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
                  </span>
                </Tooltip>
              </CircleMarker>
            ))}

          {showCheckins &&
            showB &&
            visibleB.map((point) => (
              <CircleMarker
                key={`b-${point.step}`}
                center={[point.lat, point.lon]}
                radius={2.6}
                pathOptions={{
                  color: COLOR_B,
                  weight: 0.8,
                  fillColor: COLOR_B,
                  fillOpacity: activePair === null ? 0.5 : 0.15,
                }}
              >
                <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                  <span className="text-[10px] leading-4">
                    {detailB.platform.toUpperCase()} · step {point.step}
                    <br />
                    loc {point.locId} · time id {point.timeId}
                    <br />
                    {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
                  </span>
                </Tooltip>
              </CircleMarker>
            ))}

          {showA &&
            maskedSetA.size > 0 &&
            visibleA
              .filter((point) => maskedSetA.has(point.step - 1))
              .map((point) => (
                <CircleMarker
                  key={`masked-a-${point.step}`}
                  center={[point.lat, point.lon]}
                  radius={3.2}
                  pathOptions={{
                    color: "#FFFFFF",
                    weight: 1,
                    fillColor: "#94A3B8",
                    fillOpacity: 0.95,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                    <span className="text-[10px] leading-4">
                      masked
                      <br />
                      {detailA.platform.toUpperCase()} step {point.step} · loc {point.locId}
                    </span>
                  </Tooltip>
                </CircleMarker>
              ))}

          {showB &&
            maskedSetB.size > 0 &&
            visibleB
              .filter((point) => maskedSetB.has(point.step - 1))
              .map((point) => (
                <CircleMarker
                  key={`masked-b-${point.step}`}
                  center={[point.lat, point.lon]}
                  radius={3.2}
                  pathOptions={{
                    color: "#FFFFFF",
                    weight: 1,
                    fillColor: "#94A3B8",
                    fillOpacity: 0.95,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                    <span className="text-[10px] leading-4">
                      masked
                      <br />
                      {detailB.platform.toUpperCase()} step {point.step} · loc {point.locId}
                    </span>
                  </Tooltip>
                </CircleMarker>
              ))}

          {showA &&
            removedSetA.size > 0 &&
            pointsA
              .filter((point) => removedSetA.has(point.step - 1))
              .map((point) => (
                <CircleMarker
                  key={`removed-a-${point.step}`}
                  center={[point.lat, point.lon]}
                  radius={4.5}
                  pathOptions={{ color: "#FFFFFF", weight: 1.5, fillColor: "#EF4444", fillOpacity: 0.95 }}
                >
                  <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                    <span className="text-[10px] leading-4">
                      removed evidence
                      <br />
                      {detailA.platform.toUpperCase()} step {point.step} · loc {point.locId}
                    </span>
                  </Tooltip>
                </CircleMarker>
              ))}

          {showB &&
            removedSetB.size > 0 &&
            pointsB
              .filter((point) => removedSetB.has(point.step - 1))
              .map((point) => (
                <CircleMarker
                  key={`removed-b-${point.step}`}
                  center={[point.lat, point.lon]}
                  radius={4.5}
                  pathOptions={{ color: "#FFFFFF", weight: 1.5, fillColor: "#EF4444", fillOpacity: 0.95 }}
                >
                  <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                    <span className="text-[10px] leading-4">
                      removed evidence
                      <br />
                      {detailB.platform.toUpperCase()} step {point.step} · loc {point.locId}
                    </span>
                  </Tooltip>
                </CircleMarker>
              ))}

          {showA && visibleA.length > 0 && (
            <EndpointMarker
              point={visibleA[0]}
              color={COLOR_A}
              label={`${detailA.platform.toUpperCase()} start`}
            />
          )}
          {showA && visibleA.length > 1 && (
            <EndpointMarker
              point={pointsA[pointsA.length - 1]}
              color={COLOR_A}
              label={`${detailA.platform.toUpperCase()} end`}
            />
          )}
          {showB && visibleB.length > 0 && (
            <EndpointMarker
              point={visibleB[0]}
              color={COLOR_B}
              label={`${detailB.platform.toUpperCase()} start`}
            />
          )}
          {showB && visibleB.length > 1 && (
            <EndpointMarker
              point={pointsB[pointsB.length - 1]}
              color={COLOR_B}
              label={`${detailB.platform.toUpperCase()} end`}
            />
          )}

          {showCo &&
            showA &&
            showB &&
            visibleCoPairs.map((pair) => {
              const latlngs = pairLatLngs(pair);
              if (latlngs.length !== 2) return null;
              const active = activePair === pair.index;
              const dimmed = activePair !== null && !active;
              return (
                <Polyline
                  key={`co-line-${pair.index}`}
                  positions={latlngs}
                  pathOptions={{
                    color: active ? COLOR_CO_ACTIVE : COLOR_CO,
                    weight: active ? 2.6 : 1.5,
                    opacity: dimmed ? 0.25 : active ? 0.95 : 0.65,
                    dashArray: "5 6",
                  }}
                  eventHandlers={{
                    click: (event) => {
                      L.DomEvent.stopPropagation(event.originalEvent);
                      onSelectPair(pair.index);
                    },
                    mouseover: () => onHighlight(pair.index),
                    mouseout: () => onHighlight(null),
                  }}
                />
              );
            })}

          {showCo &&
            visibleCoPairs.map((pair) => {
              if (pair.a.lon === null || pair.a.lat === null) return null;
              if (!showA) return null;
              const active = activePair === pair.index;
              const dimmed = activePair !== null && !active;
              return (
                <CircleMarker
                  key={`co-a-${pair.index}`}
                  center={[pair.a.lat, pair.a.lon]}
                  radius={active ? 7 : 5}
                  pathOptions={{
                    color: active ? COLOR_CO_ACTIVE : "#FFFFFF",
                    weight: 2,
                    fillColor: COLOR_CO,
                    fillOpacity: dimmed ? 0.4 : 1,
                    opacity: dimmed ? 0.4 : 1,
                  }}
                  eventHandlers={{
                    click: (event) => {
                      L.DomEvent.stopPropagation(event.originalEvent);
                      onSelectPair(pair.index);
                    },
                    mouseover: () => onHighlight(pair.index),
                    mouseout: () => onHighlight(null),
                  }}
                >
                  {(active || (coPairs.length <= 12 && pair.index < 12)) && (
                    <Tooltip permanent direction="right" offset={[8, 0]} opacity={1} className="mtlink-co-label">
                      C{pair.index + 1}
                    </Tooltip>
                  )}
                  <Popup>
                    <CooccurrencePopup
                      pair={pair}
                      onExplain={onExplain ? () => onExplain(pair.index) : undefined}
                    />
                  </Popup>
                </CircleMarker>
              );
            })}

          {showCo &&
            visibleCoPairs.map((pair) => {
              if (pair.b.lon === null || pair.b.lat === null) return null;
              if (!showB) return null;
              const active = activePair === pair.index;
              const dimmed = activePair !== null && !active;
              return (
                <CircleMarker
                  key={`co-b-${pair.index}`}
                  center={[pair.b.lat, pair.b.lon]}
                  radius={active ? 7 : 5}
                  pathOptions={{
                    color: active ? COLOR_CO_ACTIVE : "#FFFFFF",
                    weight: 2,
                    fillColor: COLOR_CO,
                    fillOpacity: dimmed ? 0.4 : 1,
                    opacity: dimmed ? 0.4 : 1,
                  }}
                  eventHandlers={{
                    click: (event) => {
                      L.DomEvent.stopPropagation(event.originalEvent);
                      onSelectPair(pair.index);
                    },
                    mouseover: () => onHighlight(pair.index),
                    mouseout: () => onHighlight(null),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                    <span className="text-[10px] leading-4">
                      C{pair.index + 1} · {distanceLabel(pair.distanceM)}
                      <br />
                      {detailB.platform.toUpperCase()} step {pair.b.step} · loc {pair.b.locId}
                    </span>
                  </Tooltip>
                </CircleMarker>
              );
            })}
          {focusTokens?.a && focusTokens.a.lon !== null && focusTokens.a.lat !== null && (
            <CircleMarker
              center={[focusTokens.a.lat, focusTokens.a.lon]}
              radius={10}
              pathOptions={{
                color: COLOR_A,
                weight: 3,
                dashArray: "4 3",
                fillColor: COLOR_A,
                fillOpacity: 0.12,
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -8]} opacity={1}>
                attention A token #{focusTokens.a.token}
              </Tooltip>
            </CircleMarker>
          )}
          {focusTokens?.b && focusTokens.b.lon !== null && focusTokens.b.lat !== null && (
            <CircleMarker
              center={[focusTokens.b.lat, focusTokens.b.lon]}
              radius={10}
              pathOptions={{
                color: COLOR_B,
                weight: 3,
                dashArray: "4 3",
                fillColor: COLOR_B,
                fillOpacity: 0.12,
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -8]} opacity={1}>
                attention B token #{focusTokens.b.token}
              </Tooltip>
            </CircleMarker>
          )}
        </MapContainer>

        <div className="pointer-events-none absolute left-3 top-3 z-[1000]">
          <div className="pointer-events-auto rounded-lg border border-white/80 bg-white/95 px-3 py-2 text-[10px] leading-4 text-slate-600 shadow-md backdrop-blur">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Legend</p>
            <p className="flex items-center gap-2">
              <span className="inline-block h-0.5 w-5 rounded bg-blue-600" /> {detailA.platform.toUpperCase()}
            </p>
            <p className="flex items-center gap-2">
              <span className="inline-block h-0.5 w-5 rounded bg-rose-600" /> {detailB.platform.toUpperCase()}
            </p>
            <p className="flex items-center gap-2">
              <span className="inline-block h-0.5 w-5 rounded border-t-2 border-dashed border-emerald-500" />{" "}
              co-occurrence
            </p>
            <p className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" /> C point
            </p>
            {(maskedSetA.size > 0 || maskedSetB.size > 0) && (
              <p className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-slate-400 ring-2 ring-white" /> masked
                masked
              </p>
            )}
          </div>
        </div>

        {basemapUnavailable && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2">
            <p className="rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1 text-[10px] font-semibold text-amber-800 shadow">
              Basemap unavailable — trajectories are still shown
            </p>
          </div>
        )}
      </div>

      {timeline && (
        <TimelinePlayer
          domain={timeline}
          pointsA={pointsA}
          pointsB={pointsB}
          coPairs={coPairs}
          currentTime={effectiveTime}
          playing={playing}
          speed={speed}
          onSeek={(time) => {
            setPlaying(false);
            setCurrentTime(time);
          }}
          onTogglePlay={togglePlayback}
          onSpeed={setSpeed}
          onReset={() => {
            setPlaying(false);
            setCurrentTime(timeline.max);
          }}
        />
      )}

      <p className="mt-2 text-[10px] leading-4 text-slate-400">
        Hover a check-in or a green C point for details; click a C point or a table row to pin and fly to
        it. The map uses real WGS-84 coordinates — no GCJ-02 offset. The timeline shows up to 300
        check-ins per user for display (all of them when the trajectory is shorter); the model always
        consumed the full trajectory. Basemap: OpenStreetMap with OSM
        mirrors as fallbacks.
      </p>
    </section>
  );
}

function LayerToggle({
  active,
  color,
  label,
  onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-semibold transition ${
        active
          ? "border-slate-200 bg-white text-slate-600 shadow-sm"
          : "border-slate-100 bg-slate-50 text-slate-400"
      }`}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: active ? color : "#CBD5E1" }}
      />
      {label}
      {active ? <Link2 size={9} className="text-slate-300" /> : null}
    </button>
  );
}

function EndpointMarker({
  point,
  color,
  label,
}: {
  point: PlotPoint;
  color: string;
  label: string;
}) {
  return (
    <CircleMarker
      center={[point.lat, point.lon]}
      radius={6}
      pathOptions={{ color, weight: 2, fillColor: "#FFFFFF", fillOpacity: 1 }}
    >
      <Tooltip direction="top" offset={[0, -7]} opacity={1}>
        <span className="text-[10px] leading-4">
          {label} · step {point.step}
          <br />
          loc {point.locId}
          <br />
          {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
        </span>
      </Tooltip>
    </CircleMarker>
  );
}

function CooccurrencePopup({
  pair,
  onExplain,
}: {
  pair: CoOccurrencePair;
  onExplain?: () => void;
}) {
  return (
    <div className="space-y-1 text-[11px] leading-4 text-slate-700">
      <p className="text-xs font-bold text-emerald-700">C{pair.index + 1} · co-occurrence</p>
      <p>Time slot {pair.slot}</p>
      <p>Distance {distanceLabel(pair.distanceM)}</p>
      <p>
        A step {pair.a.step} · loc {pair.a.locId}
      </p>
      <p>
        B step {pair.b.step} · loc {pair.b.locId}
      </p>
      {onExplain && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onExplain();
          }}
          className="mt-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          Why this match?
        </button>
      )}
    </div>
  );
}

/**
 * Tile layer with provider fallback.
 *
 * Leaflet handles individual tile retries; this wrapper handles a host that is
 * unreachable or rate-limited overall. After a few `tileerror` events it moves to the
 * next provider. `maxNativeZoom` prevents the "successful 200 but no data" Esri
 * placeholder: Leaflet upscales real low-zoom tiles instead.
 */
function BasemapLayer({
  kind,
  onUnavailable,
}: {
  kind: BasemapKind;
  onUnavailable: (unavailable: boolean) => void;
}) {
  const map = useMap();
  const providers = basemapProviders(kind);
  const [index, setIndex] = useState(0);
  const errors = useRef(0);
  const exhausted = useRef(false);

  useEffect(() => {
    setIndex(0);
    errors.current = 0;
    exhausted.current = false;
    onUnavailable(false);
  }, [kind, onUnavailable]);

  useEffect(() => {
    const provider: BasemapProvider | undefined = providers[index];
    if (!provider) return;
    errors.current = 0;

    const layer = L.tileLayer(provider.url, {
      maxZoom: 19,
      maxNativeZoom: provider.maxNativeZoom,
      attribution: provider.attribution,
      referrerPolicy: provider.noReferrer ? "no-referrer" : undefined,
      updateWhenIdle: false,
      keepBuffer: 3,
    });

    const handleError = () => {
      if (exhausted.current) return;
      errors.current += 1;
      if (errors.current < 4) return;
      if (index + 1 < providers.length) {
        setIndex(index + 1);
      } else {
        exhausted.current = true;
        onUnavailable(true);
      }
    };

    layer.on("tileerror", handleError);
    layer.addTo(map);

    return () => {
      layer.off("tileerror", handleError);
      map.removeLayer(layer);
    };
  }, [map, providers, index, onUnavailable]);

  return null;
}

function MapViewSync({
  points,
  signature,
  focusBounds,
  tokenFocusBounds,
  fitNonce,
}: {
  points: { lon: number; lat: number }[];
  signature: string;
  focusBounds: L.LatLngBounds | null;
  tokenFocusBounds: L.LatLngBounds | null;
  fitNonce: number;
}) {
  const map = useMap();
  const pointsRef = useRef(points);
  pointsRef.current = points;

  useEffect(() => {
    const current = pointsRef.current;
    if (!current.length) return;
    const bounds = L.latLngBounds(current.map((point) => [point.lat, point.lon] as [number, number]));
    if (!bounds.isValid()) return;
    if (current.length === 1) {
      map.setView(bounds.getCenter(), 16);
    } else {
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 17 });
    }
  }, [map, signature, fitNonce]);

  useEffect(() => {
    if (!focusBounds) return;
    map.flyToBounds(focusBounds, { padding: [90, 90], maxZoom: 17, duration: 0.55 });
  }, [map, focusBounds]);

  useEffect(() => {
    if (!tokenFocusBounds) return;
    map.flyToBounds(tokenFocusBounds, { padding: [80, 80], maxZoom: 17, duration: 0.55 });
  }, [map, tokenFocusBounds]);

  return null;
}
