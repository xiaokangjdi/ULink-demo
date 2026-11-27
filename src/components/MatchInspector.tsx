import { ArrowUpRight, Info, MapPin, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { topAttentionLinks } from "../lib/attention";
import { formatMs, formatScore } from "../lib/format";
import type { AttentionMatrix, CoOccurrencePair, MatchResponse, TrajectoryStep, UserDetail } from "../types";

interface MatchInspectorProps {
  open: boolean;
  pairIndex: number | null;
  detailA: UserDetail | null;
  detailB: UserDetail | null;
  coPairs: CoOccurrencePair[];
  result: MatchResponse | null;
  onClose: () => void;
  onPin: (index: number) => void;
}

interface PlotPoint {
  lon: number;
  lat: number;
  step: number;
  locId: number;
}

const W = 220;
const H = 132;
const PAD = 10;

const validPoints = (steps: TrajectoryStep[]): PlotPoint[] =>
  steps
    .filter(
      (step): step is TrajectoryStep & { lon: number; lat: number } =>
        step.lon !== null && step.lat !== null,
    )
    .map((step) => ({ lon: step.lon, lat: step.lat, step: step.step, locId: step.loc_id }));

const polyline = (points: { x: number; y: number }[]) =>
  points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");

const distanceLabel = (metres: number) =>
  metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(2)} km`;

const cellValue = (matrix: AttentionMatrix | null, aStep: number, bStep: number): number | null => {
  if (!matrix || !matrix.values.length) return null;
  const stride = matrix.downsampled ? Math.max(1, matrix.stride || 1) : 1;
  const row = Math.min(matrix.values.length - 1, Math.max(0, Math.floor((aStep - 1) / stride)));
  const col = Math.min(
    (matrix.values[0]?.length ?? 1) - 1,
    Math.max(0, Math.floor((bStep - 1) / stride)),
  );
  const value = matrix.values[row]?.[col];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

/**
 * One drawer that connects a map co-occurrence (or the whole pair) to the model's
 * evidence: event geometry, normalized shape, top attention links, and provenance.
 *
 * Everything shown here is read from the response already on screen. When the
 * attention matrix is block-reduced by the backend, the token labels are marked as
 * blocks rather than pretending the cell is full resolution.
 */
export default function MatchInspector({
  open,
  pairIndex,
  detailA,
  detailB,
  coPairs,
  result,
  onClose,
  onPin,
}: MatchInspectorProps) {
  const closeButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const selectedPair = pairIndex !== null ? coPairs[pairIndex] ?? null : null;

  const plot = useMemo(() => {
    const a = detailA ? validPoints(detailA.preview) : [];
    const b = detailB ? validPoints(detailB.preview) : [];
    const all = [...a, ...b];
    if (!all.length) return null;
    const lons = all.map((point) => point.lon);
    const lats = all.map((point) => point.lat);
    const lonMin = Math.min(...lons);
    const lonMax = Math.max(...lons);
    const latMin = Math.min(...lats);
    const latMax = Math.max(...lats);
    const spanX = Math.max(lonMax - lonMin, 0.002);
    const spanY = Math.max(latMax - latMin, 0.002);
    const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY);
    const offsetX = (W - spanX * scale) / 2;
    const offsetY = (H - spanY * scale) / 2;
    const project = (point: { lon: number; lat: number }) => ({
      x: offsetX + (point.lon - lonMin) * scale,
      y: H - (offsetY + (point.lat - latMin) * scale),
    });
    const pairs = coPairs
      .map((pair) => {
        if (pair.a.lon === null || pair.a.lat === null) return null;
        return { index: pair.index, ...project({ lon: pair.a.lon, lat: pair.a.lat }) };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    return {
      a: a.map(project),
      b: b.map(project),
      pairs,
    };
  }, [detailA, detailB, coPairs]);

  const evidence = useMemo(() => ({ count: coPairs.length }), [coPairs]);

  const selectedAttention = useMemo(() => {
    if (!selectedPair || !result?.attention) return null;
    return cellValue(result.attention.a_to_b, selectedPair.a.step, selectedPair.b.step);
  }, [selectedPair, result]);

  const topLinks = useMemo(
    () =>
      topAttentionLinks(
        result?.attention,
        result?.tokens?.a,
        result?.tokens?.b,
        detailA?.preview,
        detailB?.preview,
        6,
      ),
    [result, detailA, detailB],
  );

  if (!open) return null;

  const platformA = result?.platform_a.name ?? detailA?.platform.toUpperCase() ?? "Platform A";
  const platformB = result?.platform_b.name ?? detailB?.platform.toUpperCase() ?? "Platform B";
  const hasResult = Boolean(result);

  return (
    <div className="fixed inset-0 z-[2000]" role="presentation">
      <div
        className="absolute inset-0 bg-slate-900/25 backdrop-blur-[1px]"
        role="presentation"
        onMouseDown={onClose}
      />
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-[460px] flex-col border-l border-blue-100 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Why this match"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-blue-50 px-5 py-4">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-500">
              <Sparkles size={12} /> Match evidence
            </p>
            <h2 className="mt-1 text-lg font-bold text-blue-950">Why this match?</h2>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">
              {platformA} {detailA?.user_id ?? "—"} ↔ {platformB} {detailB?.user_id ?? "—"}
            </p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Close match explanation"
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            {hasResult ? (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Model score
                    </p>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-blue-700">
                      {formatScore(result?.prediction.score)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        result?.prediction.is_match
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {result?.prediction.is_match ? "same person" : "different people"}
                    </span>
                    <p className="mt-1 text-[10px] text-slate-400">
                      threshold {result?.prediction.decision_threshold}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-slate-500">
                  sigmoid output, not a calibrated probability; used only as the 0.5-thresholded model
                  decision.
                </p>
              </>
            ) : (
              <p className="text-xs leading-5 text-slate-600">
                No forward pass yet. The co-occurrence evidence below is already real; run
                <span className="font-semibold"> Start matching </span>
                to add the model score and attention.
              </p>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Normalized shape
              </h3>
              <span className="text-[10px] text-slate-400">same bounding box · no basemap</span>
            </div>
            <div className="mt-2 overflow-hidden rounded-xl border border-blue-100 bg-[#F8FBFF]">
              {plot ? (
                <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Normalized trajectories">
                  <polyline
                    points={polyline(plot.b)}
                    fill="none"
                    stroke="#E11D48"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.9"
                  />
                  <polyline
                    points={polyline(plot.a)}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.9"
                  />
                  {plot.pairs.map((point) => {
                    const active = selectedPair?.index === point.index;
                    return (
                      <circle
                        key={point.index}
                        cx={point.x}
                        cy={point.y}
                        r={active ? 4.5 : 2.8}
                        fill="#10B981"
                        stroke="#FFFFFF"
                        strokeWidth={active ? 2 : 1}
                      />
                    );
                  })}
                </svg>
              ) : (
                <p className="px-4 py-8 text-center text-xs text-slate-400">No coordinates to plot.</p>
              )}
            </div>
            <p className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <i className="inline-block h-0.5 w-4 bg-blue-600" /> {platformA}
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block h-0.5 w-4 bg-rose-600" /> {platformB}
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> C point
              </span>
            </p>
          </section>

          {selectedPair ? (
            <section className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                  <MapPin size={13} /> C{selectedPair.index + 1} · co-occurrence
                </h3>
                <button
                  type="button"
                  onClick={() => onPin(selectedPair.index)}
                  className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100"
                >
                  <ArrowUpRight size={11} /> Pin on map
                </button>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] leading-4">
                <div>
                  <dt className="text-slate-400">Time slot</dt>
                  <dd className="tabular-nums text-slate-700">{selectedPair.slot}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Distance</dt>
                  <dd className="tabular-nums text-slate-700">{distanceLabel(selectedPair.distanceM)}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">{platformA} step</dt>
                  <dd className="tabular-nums text-slate-700">
                    {selectedPair.a.step} <span className="text-slate-400">(loc {selectedPair.a.locId})</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">{platformB} step</dt>
                  <dd className="tabular-nums text-slate-700">
                    {selectedPair.b.step} <span className="text-slate-400">(loc {selectedPair.b.locId})</span>
                  </dd>
                </div>
                {selectedAttention !== null && (
                  <div className="col-span-2">
                    <dt className="text-slate-400">attention at this pair</dt>
                    <dd className="tabular-nums text-slate-700">{selectedAttention.toFixed(5)}</dd>
                  </div>
                )}
              </dl>
            </section>
          ) : (
            <section className="rounded-xl border border-blue-100 bg-white p-4">
              <h3 className="text-xs font-bold text-blue-900">Whole-pair evidence</h3>
              <div className="mt-3 flex items-baseline gap-2 text-[11px] leading-4">
                <span className="text-slate-400">co-occurrences</span>
                <span className="text-lg font-bold tabular-nums text-emerald-700">{evidence.count}</span>
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Top attention links
              </h3>
              <span className="text-[10px] text-slate-400">{platformA} → {platformB}</span>
            </div>
            {topLinks.length ? (
              <div className="mt-2 overflow-hidden rounded-xl border border-blue-100">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-blue-50 text-blue-900">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">#</th>
                      <th className="px-2.5 py-1.5 font-semibold">{platformA} token</th>
                      <th className="px-2.5 py-1.5 font-semibold">{platformB} token</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {topLinks.map((link, index) => (
                      <tr key={`${link.aStep}-${link.bStep}-${index}`}>
                        <td className="px-2.5 py-1.5 text-slate-400">{index + 1}</td>
                        <td className="px-2.5 py-1.5 tabular-nums text-slate-600">
                          #{link.aStep}
                          {link.aLoc !== null ? <span className="text-slate-400"> (loc {link.aLoc})</span> : null}
                        </td>
                        <td className="px-2.5 py-1.5 tabular-nums text-slate-600">
                          #{link.bStep}
                          {link.bLoc !== null ? <span className="text-slate-400"> (loc {link.bLoc})</span> : null}
                        </td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold text-blue-700">
                          {link.weight.toFixed(5)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-3 text-[10px] leading-4 text-slate-500">
                Attention is available after a real forward pass. The matrix axes are raw trajectory
                tokens; where a preview token exists, its location id is shown next to it.
              </p>
            )}
            {result?.attention && topLinks.length > 0 && (
              <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-slate-400">
                <Info size={11} className="mt-0.5 shrink-0" />
                Attention is an internal model signal, not a causal explanation.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <h3 className="text-xs font-bold text-slate-600">What produced this number</h3>
            {result ? (
              <dl className="mt-2 space-y-1 text-[10px] leading-4">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">checkpoint seed</dt>
                  <dd className="font-semibold text-slate-600">{result.model.seed}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">mask ratio</dt>
                  <dd className="font-semibold text-slate-600">
                    {result.mask.mask_ratio_setting} ({result.mask.a_count}+{result.mask.b_count} tokens)
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">model forward</dt>
                  <dd className="font-semibold text-slate-600">{formatMs(result.timing_ms.model_forward)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">platform pair</dt>
                  <dd className="font-semibold text-slate-600">{result.combo_label}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-1 text-[10px] leading-4 text-slate-400">
                Run the model to see the checkpoint, mask counts and timing for this pair.
              </p>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
