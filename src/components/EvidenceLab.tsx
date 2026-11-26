import { LoaderCircle, MinusCircle, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { describeError, matchPair } from "../api/client";
import type {
  CoOccurrencePair,
  MatchResponse,
  TrajectoryStep,
  UserDetail,
} from "../types";

interface EvidenceLabProps {
  comboId: string | null;
  seed: string;
  seeds: string[];
  detailA: UserDetail | null;
  detailB: UserDetail | null;
  coPairs: CoOccurrencePair[];
  selectedPair: number | null;
  baseline: MatchResponse | null;
  onRemoveChange?: (removed: { a: number[]; b: number[] } | null) => void;
  onResultChange?: (result: MatchResponse | null) => void;
}

type Scope = "pair" | "seeds";

interface ScopeRow {
  label: string;
  baseline: number | null;
  after: number | null;
  delta: number | null;
  status: "ok" | "skipped" | "error";
  note?: string;
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

/**
 * Evidence-removal lab: remove one co-occurrence and re-run the real model.
 *
 * `Pair` re-runs one pair; `Seeds` repeats the same removal across every available
 * checkpoint. All numbers come from the backend model; skipped seeds are reported
 * with their reason.
 */
export default function EvidenceLab({
  comboId,
  seed,
  seeds,
  detailA,
  detailB,
  coPairs,
  selectedPair,
  baseline,
  onRemoveChange,
  onResultChange,
}: EvidenceLabProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [scope, setScope] = useState<Scope>("pair");
  const [removal, setRemoval] = useState<MatchResponse | null>(null);
  const [singleBaseline, setSingleBaseline] = useState<number | null>(null);
  const [rows, setRows] = useState<ScopeRow[]>([]);
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
  const drops = useMemo(() => {
    if (!detailA || !detailB) return { a: [], b: [] };
    return dropsFor(detailA, detailB, selectedPairs);
  }, [detailA, detailB, selectedPairs]);
  const dropA = drops.a;
  const dropB = drops.b;

  const reset = useCallback(() => {
    setRemoval(null);
    setSingleBaseline(null);
    setRows([]);
    setError("");
    setProgress("");
    onRemoveChange?.(null);
  }, [onRemoveChange]);

  // New pair/seed/evidence invalidates every previous result.
  useEffect(() => {
    reset();
    setSelected(coPairs.length ? new Set([0]) : new Set());
  }, [comboId, seed, detailA?.user_id, detailB?.user_id, coPairs.length, reset]);

  useEffect(() => {
    if (!removal || !selectedPairs.length) {
      onRemoveChange?.(null);
      return;
    }
    onRemoveChange?.({ a: dropA, b: dropB });
  }, [removal, selectedPairs.length, dropA, dropB, onRemoveChange]);

  const runSingle = async () => {
    if (!selectedPairs.length || !detailA || !detailB || !comboId) return;
    const id = ++runId.current;
    setRunning(true);
    setError("");
    setRows([]);
    setProgress("running one forward pass with the selected co-occurrence removed…");
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
      setRows([
        {
          label: `This pair · ${selectedPairs.map((pair) => `C${pair.index + 1}`).join(", ")}`,
          baseline: base.prediction.score,
          after: after.prediction.score,
          delta: after.prediction.score - base.prediction.score,
          status: "ok",
        },
      ]);
      setProgress("");
    } catch (reason) {
      if (id === runId.current) setError(describeError(reason));
    } finally {
      if (id === runId.current) setRunning(false);
    }
  };

  const runSeeds = async () => {
    if (!selectedPairs.length || !comboId || !detailA || !detailB) return;
    const id = ++runId.current;
    const seedList = seeds.length ? seeds : [seed].filter(Boolean);
    setRunning(true);
    setError("");
    setRows([]);
    const next: ScopeRow[] = [];
    for (let index = 0; index < seedList.length; index += 1) {
      if (id !== runId.current) return;
      const currentSeed = seedList[index];
      setProgress(`seed ${currentSeed} · ${index + 1}/${seedList.length}`);
      try {
        const base = await matchPair({
          comboId,
          userA: detailA.user_id,
          userB: detailB.user_id,
          includeAttention: false,
          includeTokens: false,
          seed: currentSeed,
        });
        const after = await matchPair({
          comboId,
          userA: detailA.user_id,
          userB: detailB.user_id,
          includeAttention: false,
          includeTokens: false,
          seed: currentSeed,
          dropA,
          dropB,
        });
        next.push({
          label: `seed ${currentSeed}`,
          baseline: base.prediction.score,
          after: after.prediction.score,
          delta: after.prediction.score - base.prediction.score,
          status: "ok",
        });
      } catch (reason) {
        next.push({
          label: `seed ${currentSeed}`,
          baseline: null,
          after: null,
          delta: null,
          status: "skipped",
          note: describeError(reason),
        });
      }
      setRows([...next]);
    }
    if (id === runId.current) {
      setRunning(false);
      setProgress("");
    }
  };

  const selectedScore = singleBaseline ?? baseline?.prediction.score ?? null;
  const actionLabel = `Remove ${selectedPairs.length} C + nearby cluster`;

  return (
    <section className="rounded-2xl border border-amber-100 bg-white p-4 shadow-soft">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-amber-900">
            <MinusCircle size={15} className="text-amber-600" /> Evidence removal
          </h3>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">
            Select one or more co-occurrence points; the intervention removes their check-ins plus
            the nearby redundant check-ins (±3 h and 2 km), then re-runs the real model.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={running || (!removal && !rows.length)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-40"
        >
          <RotateCcw size={11} /> Restore
        </button>
      </header>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400">
          selected {selected.size} / {coPairs.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSelected(new Set(coPairs.map((pair) => pair.index)))}
            className="rounded border border-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 hover:bg-slate-50"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
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
                setRemoval(null);
                setRows([]);
                onRemoveChange?.(null);
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

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void runSingle()}
              disabled={running || !selectedPairs.length || !comboId}
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

          {removal && selectedPairs.length > 0 && (
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
                removed {selectedPairs.map((pair) => `C${pair.index + 1}`).join(", ")} ·{" "}
                {removal.intervention
                  ? `${removal.intervention.drop_a.length}+${removal.intervention.drop_b.length} token(s) dropped`
                  : "real forward pass"}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Scope</p>
          <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
            {(
              [
                ["pair", "Pair"],
                ["seeds", "Seeds"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setScope(key)}
                className={`rounded-md px-1.5 py-1 font-semibold ${
                  scope === key ? "bg-white text-amber-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (scope === "pair") void runSingle();
              else void runSeeds();
            }}
            disabled={running || !comboId}
            className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-40"
          >
            {scope === "pair" ? "Run this pair" : "Run across seeds"}
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="mt-3">
          <div className="scroll-thin mt-2 max-h-[240px] overflow-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[520px] text-left text-[10px]">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2.5 py-1.5 font-semibold">case</th>
                  <th className="px-2.5 py-1.5 font-semibold">baseline</th>
                  <th className="px-2.5 py-1.5 font-semibold">after removal</th>
                  <th className="px-2.5 py-1.5 font-semibold">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.label}>
                    <td className="px-2.5 py-1.5 text-slate-600">
                      {row.label}
                      {row.status !== "ok" && (
                        <span className="ml-1 text-[9px] text-amber-600">({row.status})</span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 tabular-nums text-slate-500">
                      {row.baseline === null ? "—" : row.baseline.toFixed(6)}
                    </td>
                    <td className="px-2.5 py-1.5 tabular-nums text-slate-600">
                      {row.after === null ? "—" : row.after.toFixed(6)}
                    </td>
                    <td
                      className={`px-2.5 py-1.5 tabular-nums font-semibold ${
                        row.delta === null
                          ? "text-slate-400"
                          : row.delta < -0.01
                            ? "text-rose-600"
                            : row.delta > 0.01
                              ? "text-emerald-600"
                              : "text-slate-500"
                      }`}
                    >
                      {row.delta === null ? "—" : `${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(6)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.some((row) => row.note) && (
            <p className="mt-1 text-[9px] leading-3 text-slate-400">
              {rows.find((row) => row.note)?.note}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
