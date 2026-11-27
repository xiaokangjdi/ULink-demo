import { LoaderCircle, MinusCircle, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { describeError, matchPair } from "../api/client";
import type { AttentionLink } from "../lib/attention";
import type {
  CoOccurrencePair,
  MatchResponse,
  TrajectoryStep,
  UserDetail,
} from "../types";

interface EvidenceLabProps {
  comboId: string | null;
  seed: string;
  detailA: UserDetail | null;
  detailB: UserDetail | null;
  coPairs: CoOccurrencePair[];
  selectedPair: number | null;
  baseline: MatchResponse | null;
  attentionLinks: AttentionLink[];
  /** M index -> C index, when the top-attention pair is also a manual C point. */
  matchedCByM: Map<number, number>;
  highlightedM?: number | null;
  onHoverM?: (index: number | null) => void;
  onRemoveChange?: (removed: { a: number[]; b: number[] } | null) => void;
  onResultChange?: (result: MatchResponse | null) => void;
}

const validPoints = (steps: TrajectoryStep[]) =>
  steps.filter(
    (step): step is TrajectoryStep & { lon: number; lat: number } =>
      step.lon !== null && step.lat !== null,
  );

/** Same co-occurrence definition as MatchPage: same time bucket + within 2 km. */
const computePairs = (detailA: UserDetail, detailB: UserDetail): CoOccurrencePair[] => {
  const aPoints = validPoints(detailA.preview);
  const bPoints = validPoints(detailB.preview);
  if (!aPoints.length || !bPoints.length) return [];
  const maxSlot = Math.max(
    ...aPoints.map((step) => step.timestamp),
    ...bPoints.map((step) => step.timestamp),
  );
  const tolerance = maxSlot > 1e8 ? 3600 : 0;
  const metres = (lon1: number, lat1: number, lon2: number, lat2: number) => {
    const meanLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
    const dx = (lon2 - lon1) * 111.32 * Math.cos(meanLat);
    const dy = (lat2 - lat1) * 110.57;
    return Math.sqrt(dx * dx + dy * dy) * 1000;
  };
  const found: CoOccurrencePair[] = [];
  for (const a of aPoints) {
    for (const b of bPoints) {
      if (Math.abs(a.timestamp - b.timestamp) > tolerance) continue;
      const distanceM = metres(a.lon, a.lat, b.lon, b.lat);
      if (distanceM > 2000) continue;
      found.push({
        index: found.length,
        slot: a.timestamp,
        distanceM,
        a: { step: a.step, locId: a.loc_id, slot: a.timestamp, lon: a.lon, lat: a.lat },
        b: { step: b.step, locId: b.loc_id, slot: b.timestamp, lon: b.lon, lat: b.lat },
      });
    }
  }
  found.sort((left, right) => left.slot - right.slot || left.distanceM - right.distanceM);
  found.forEach((pair, index) => {
    pair.index = index;
  });
  return found;
};



const toleranceFor = (a: UserDetail, b: UserDetail) => {
  const maxSlot = Math.max(
    ...a.preview.map((step) => step.timestamp),
    ...b.preview.map((step) => step.timestamp),
  );
  // Cluster mode is intentionally wider than the exact co-occurrence bucket:
  // remove the redundant check-ins around the selected evidence too.
  return maxSlot > 1e8 ? 3 * 3600 : 6;
};

const metresBetween = (
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
) => {
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dx = (b.lon - a.lon) * 111.32 * Math.cos(meanLat);
  const dy = (b.lat - a.lat) * 110.57;
  return Math.sqrt(dx * dx + dy * dy) * 1000;
};

const dropsFor = (
  detailA: UserDetail,
  detailB: UserDetail,
  pairs: CoOccurrencePair[],
): { a: number[]; b: number[] } => {
  const a = new Set<number>();
  const b = new Set<number>();
  const tolerance = toleranceFor(detailA, detailB);
  const aPoints = validPoints(detailA.preview);
  const bPoints = validPoints(detailB.preview);
  for (const pair of pairs) {
    if (pair.a.lon !== null && pair.a.lat !== null) {
      for (const point of aPoints) {
        if (Math.abs(point.timestamp - pair.slot) > tolerance) continue;
        if (metresBetween(point, { lon: pair.a.lon, lat: pair.a.lat }) <= 2000) a.add(point.step - 1);
      }
    }
    if (pair.b.lon !== null && pair.b.lat !== null) {
      for (const point of bPoints) {
        if (Math.abs(point.timestamp - pair.slot) > tolerance) continue;
        if (metresBetween(point, { lon: pair.b.lon, lat: pair.b.lat }) <= 2000) b.add(point.step - 1);
      }
    }
  }
  return { a: [...a], b: [...b] };
};

/** Same removal semantics for the model-side M pairs (top attention cells). */
const dropsForAttention = (
  detailA: UserDetail,
  detailB: UserDetail,
  links: AttentionLink[],
): { a: number[]; b: number[] } => {
  const a = new Set<number>();
  const b = new Set<number>();
  const tolerance = toleranceFor(detailA, detailB);
  const aPoints = validPoints(detailA.preview);
  const bPoints = validPoints(detailB.preview);

  for (const link of links) {
    a.add(link.aStep - 1);
    b.add(link.bStep - 1);
    if (link.aLon !== null && link.aLat !== null && link.aTimestamp !== null) {
      for (const point of aPoints) {
        if (Math.abs(point.timestamp - link.aTimestamp) > tolerance) continue;
        if (metresBetween(point, { lon: link.aLon, lat: link.aLat }) <= 2000) a.add(point.step - 1);
      }
    }
    if (link.bLon !== null && link.bLat !== null && link.bTimestamp !== null) {
      for (const point of bPoints) {
        if (Math.abs(point.timestamp - link.bTimestamp) > tolerance) continue;
        if (metresBetween(point, { lon: link.bLon, lat: link.bLat }) <= 2000) b.add(point.step - 1);
      }
    }
  }
  return { a: [...a], b: [...b] };
};

/**
 * Evidence-removal lab: remove manual C points and/or attention top points M, then
 * re-run the real model on the remaining check-ins. The M chips are first-class
 * removable evidence, not just a comparison with the C table.
 */
export default function EvidenceLab({
  comboId,
  seed,
  detailA,
  detailB,
  coPairs,
  selectedPair,
  baseline,
  attentionLinks,
  matchedCByM,
  highlightedM,
  onHoverM,
  onRemoveChange,
  onResultChange,
}: EvidenceLabProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectedM, setSelectedM] = useState<Set<number>>(new Set());
  const [removal, setRemoval] = useState<MatchResponse | null>(null);
  const [singleBaseline, setSingleBaseline] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const runId = useRef(0);

  useEffect(() => {
    onResultChange?.(removal);
  }, [removal, onResultChange]);

  useEffect(() => {
    if (selectedPair !== null && selectedPair < coPairs.length) {
      setSelected(new Set([selectedPair]));
    }
  }, [selectedPair, coPairs.length]);

  useEffect(() => {
    setSelected((previous) => {
      const next = new Set([...previous].filter((index) => index < coPairs.length));
      return next;
    });
  }, [coPairs.length]);

  const selectedPairs = useMemo(
    () => coPairs.filter((pair) => selected.has(pair.index)),
    [coPairs, selected],
  );
  const selectedMlinks = useMemo(
    () => attentionLinks.filter((_, index) => selectedM.has(index)),
    [attentionLinks, selectedM],
  );

  const cDrops = useMemo(() => {
    if (!detailA || !detailB) return { a: [], b: [] };
    return dropsFor(detailA, detailB, selectedPairs);
  }, [detailA, detailB, selectedPairs]);

  const mDrops = useMemo(() => {
    if (!detailA || !detailB) return { a: [], b: [] };
    return dropsForAttention(detailA, detailB, selectedMlinks);
  }, [detailA, detailB, selectedMlinks]);

  const dropA = useMemo(
    () => [...new Set([...cDrops.a, ...mDrops.a])],
    [cDrops, mDrops],
  );
  const dropB = useMemo(
    () => [...new Set([...cDrops.b, ...mDrops.b])],
    [cDrops, mDrops],
  );
  const selectionCount = selectedPairs.length + selectedMlinks.length;

  const reset = useCallback(() => {
    setRemoval(null);
    setSingleBaseline(null);
    setError("");
    setProgress("");
    onRemoveChange?.(null);
  }, [onRemoveChange]);

  // New pair/seed/evidence invalidates every previous result.
  useEffect(() => {
    reset();
    setSelected(coPairs.length ? new Set([0]) : new Set());
    setSelectedM(new Set());
  }, [comboId, seed, detailA?.user_id, detailB?.user_id, coPairs.length, reset]);

  useEffect(() => {
    setSelected((previous) => {
      const next = new Set([...previous].filter((index) => index < coPairs.length));
      return next;
    });
  }, [coPairs.length]);

  useEffect(() => {
    setSelectedM((previous) => {
      const next = new Set([...previous].filter((index) => index < attentionLinks.length));
      return next;
    });
  }, [attentionLinks.length]);

  // A new attention matrix changes what M1..Mn mean; drop the old M selection/result.
  useEffect(() => {
    setSelectedM(new Set());
    setRemoval(null);
    setSingleBaseline(null);
  }, [attentionLinks]);

  useEffect(() => {
    if (!removal || selectionCount === 0) {
      onRemoveChange?.(null);
      return;
    }
    onRemoveChange?.({ a: dropA, b: dropB });
  }, [removal, selectionCount, dropA, dropB, onRemoveChange]);

  const runSingle = async () => {
    if (!selectionCount || !detailA || !detailB || !comboId) return;
    if (dropA.length >= detailA.trajectory_length || dropB.length >= detailB.trajectory_length) {
      setError(
        "That selection would remove every check-in on one side. Deselect one or more C/M points and try again.",
      );
      return;
    }
    const id = ++runId.current;
    setRunning(true);
    setError("");
    setProgress(
      `running one forward pass with ${selectedPairs.length} C + ${selectedMlinks.length} M selected…`,
    );
    try {
      const base = baseline ?? (await matchPair({
        comboId,
        userA: detailA.user_id,
        userB: detailB.user_id,
        includeAttention: false,
        includeTokens: false,
        seed: seed || undefined,
      }));
      const after = await matchPair({
        comboId,
        userA: detailA.user_id,
        userB: detailB.user_id,
        includeAttention: false,
        includeTokens: false,
        seed: seed || undefined,
        dropA,
        dropB,
      });
      if (id !== runId.current) return;
      setSingleBaseline(base.prediction.score);
      setRemoval(after);
      setProgress("");
    } catch (reason) {
      if (id === runId.current) setError(describeError(reason));
    } finally {
      if (id === runId.current) setRunning(false);
    }
  };

  const selectedScore = singleBaseline ?? baseline?.prediction.score ?? null;
  const selectedCLabels = selectedPairs.map((pair) => `C${pair.index + 1}`);
  const selectedMLabels = [...selectedM]
    .sort((left, right) => left - right)
    .map((index) => `M${index + 1}`);
  const actionParts = [
    selectedCLabels.length ? `${selectedCLabels.length} C` : "",
    selectedMLabels.length ? `${selectedMLabels.length} M` : "",
  ].filter(Boolean);
  const actionLabel = actionParts.length
    ? `Remove ${actionParts.join(" + ")} + nearby cluster`
    : "Remove + nearby cluster";

  const clearResult = () => {
    setRemoval(null);
    setSingleBaseline(null);
    setError("");
    setProgress("");
    onRemoveChange?.(null);
  };

  const toggleM = (index: number) => {
    setSelectedM((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    clearResult();
  };

  return (
    <section className="rounded-2xl border border-amber-100 bg-white p-4 shadow-soft">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-amber-900">
            <MinusCircle size={15} className="text-amber-600" /> Evidence removal
          </h3>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">
            Select manual C points and/or attention top points M; the intervention removes their
            check-ins plus the nearby redundant check-ins (±3 h and 2 km), then re-runs the real
            model.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={running || !removal}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-40"
        >
          <RotateCcw size={11} /> Restore
        </button>
      </header>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400">
          selected {selectedPairs.length} C + {selectedMlinks.length} M
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setSelected(new Set(coPairs.map((pair) => pair.index)));
              setSelectedM(new Set(attentionLinks.map((_, index) => index)));
              clearResult();
            }}
            className="rounded border border-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 hover:bg-slate-50"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => {
              setSelected(new Set());
              setSelectedM(new Set());
              clearResult();
            }}
            className="rounded border border-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="scroll-thin mt-1.5 flex max-h-[82px] flex-wrap items-center gap-1.5 overflow-y-auto rounded-lg border border-slate-100 p-1.5">
        {coPairs.map((pair) => {
          const active = selected.has(pair.index);
          return (
            <button
              key={pair.index}
              type="button"
              onClick={() => {
                setSelected((previous) => {
                  const next = new Set(previous);
                  if (next.has(pair.index)) next.delete(pair.index);
                  else next.add(pair.index);
                  return next;
                });
                clearResult();
              }}
              className={`rounded-md border px-2 py-1 text-[10px] font-semibold tabular-nums ${
                active
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-slate-200 bg-white text-slate-500 hover:border-amber-200"
              }`}
            >
              C{pair.index + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void runSingle()}
          disabled={running || selectionCount === 0 || !comboId}
          className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
        >
          <Trash2 size={12} /> {actionLabel}
        </button>
        {running && (
          <span className="flex items-center gap-1 text-[10px] text-amber-700">
            <LoaderCircle size={11} className="animate-spin" /> {progress || "running…"}
          </span>
        )}
        {error && <span className="text-[10px] text-rose-600">{error}</span>}
      </div>

      <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/30 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-amber-600" />
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
              Attention top points
            </p>
            <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
              {attentionLinks.length} M
            </span>
          </div>
          {attentionLinks.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedM(new Set(attentionLinks.map((_, index) => index)));
                  clearResult();
                }}
                className="rounded border border-amber-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 hover:bg-amber-50"
              >
                All M
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedM(new Set());
                  clearResult();
                }}
                className="rounded border border-amber-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 hover:bg-amber-50"
              >
                None
              </button>
            </div>
          )}
        </div>

        {attentionLinks.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {attentionLinks.map((link, index) => {
              const active = selectedM.has(index);
              const focused = highlightedM === index;
              const cIndex = matchedCByM.get(index);
              return (
                <button
                  key={`${link.aStep}-${link.bStep}-${index}`}
                  type="button"
                  onClick={() => toggleM(index)}
                  onMouseEnter={() => onHoverM?.(index)}
                  onMouseLeave={() => onHoverM?.(null)}
                  title={`A #${link.aStep} (loc ${link.aLoc ?? "—"}) ↔ B #${link.bStep} (loc ${link.bLoc ?? "—"}) · attention ${link.weight.toFixed(5)}${cIndex !== undefined ? ` · also C${cIndex + 1}` : ""}`}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold tabular-nums transition ${
                    active
                      ? "border-amber-400 bg-amber-100 text-amber-900"
                      : "border-amber-100 bg-white text-slate-600 hover:border-amber-300"
                  } ${focused ? "ring-2 ring-amber-300" : ""}`}
                >
                  <span>M{index + 1}</span>
                  <span className="text-[9px] font-normal text-slate-400">
                    #{link.aStep}↔#{link.bStep}
                  </span>
                  <span className="text-[9px] font-normal text-slate-400">{link.weight.toFixed(4)}</span>
                  {cIndex !== undefined ? (
                    <span className="rounded bg-emerald-50 px-1 py-0.5 text-[8px] font-bold text-emerald-700">
                      C{cIndex + 1}
                    </span>
                  ) : (
                    <span className="text-[8px] font-normal text-slate-300">no C</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-1.5 text-[10px] leading-4 text-slate-400">
            {baseline ? (
              "This pair has too few check-ins to build M points (the target is the shorter trajectory minus one)."
            ) : (
              <>
                Run <span className="font-semibold">Start matching</span> to compute the attention
                matrix; its strongest check-in pairs appear here as M1…Mn and can be removed like C
                points.
              </>
            )}
          </p>
        )}

        <p className="mt-1.5 text-[9px] leading-3.5 text-slate-400">
          M = top cells of the learned correlation attention (stronger of A→B / B→A), one link per
          check-in when possible; the target is min(10, shorter trajectory − 1). A green C badge
          means the same two check-ins also form a manual C point; “no C” means the attention pair
          is genuinely not one of the manual co-occurrence pairs.
        </p>
      </div>

      {removal && selectionCount > 0 && (
        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/40 p-3 text-[11px]">
          <div className="flex flex-wrap items-end gap-3">
            <span className="text-slate-500">
              baseline <b className="tabular-nums text-slate-700">{selectedScore?.toFixed(6) ?? "--"}</b>
            </span>
            <span className="text-slate-400">→</span>
            <span className="text-slate-500">
              after removal <b className="tabular-nums text-amber-800">{removal.prediction.score.toFixed(6)}</b>
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-bold ${
                (removal.prediction.score - (selectedScore ?? 0)) < 0
                  ? "bg-rose-100 text-rose-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              Δ {(removal.prediction.score - (selectedScore ?? 0)).toFixed(6)}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            removed {[...selectedCLabels, ...selectedMLabels].join(", ")} ·{" "}
            {removal.intervention
              ? `${removal.intervention.drop_a.length}+${removal.intervention.drop_b.length} token(s) dropped`
              : "real forward pass"}
          </p>
          {selectedScore !== null && removal.prediction.score > selectedScore && (
            <p className="mt-1 text-[10px] leading-4 text-amber-700">
              Score rose: these check-ins were not positive evidence for this pair. Removal is an
              intervention, not a monotonic explanation — top attention can also point at noise.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
