import { FlaskConical, LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { describeError, matchPair } from "../api/client";
import { formatScore } from "../lib/format";
import type { MatchResponse } from "../types";

interface MaskWhatIfProps {
  comboId: string | null;
  userA: number | null;
  userB: number | null;
  seed: string;
  baseline: MatchResponse | null;
  onMaskChange?: (mask: { a: number[]; b: number[] } | null) => void;
  /** The live override result, or null when the checkpoint baseline is showing. */
  onResultChange?: (result: MatchResponse | null) => void;
}

/**
 * Live mask-ratio what-if.
 *
 * Every slider change runs a real forward pass on the backend with
 * `mask_ratio` set on the checkpoint's AttentionGuidedMaskStrategy. The runtime
 * restores the checkpoint value in a `finally` block, so this panel can never
 * silently change the default model for another request. The displayed score is
 * the model output, not a precomputed curve.
 */
export default function MaskWhatIf({
  comboId,
  userA,
  userB,
  seed,
  baseline,
  onMaskChange,
  onResultChange,
}: MaskWhatIfProps) {
  const rawBaseline = baseline?.mask.mask_ratio_setting;
  const baselinePercent = Number.isFinite(rawBaseline) ? Math.round((rawBaseline as number) * 100) : 20;
  const [ratio, setRatio] = useState(baselinePercent);
  const [whatIf, setWhatIf] = useState<MatchResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  // A new pair/seed means a new baseline; drop the old what-if result.
  useEffect(() => {
    setRatio(baselinePercent);
    setWhatIf(null);
    setError("");
    onMaskChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseline?.combo_id, baseline?.prediction.score, userA, userB, seed, baselinePercent]);

  useEffect(() => {
    onMaskChange?.(whatIf ? whatIf.mask : null);
    onResultChange?.(whatIf);
  }, [whatIf, onMaskChange, onResultChange]);

  useEffect(() => {
    if (!baseline || !comboId || userA === null || userB === null) return;
    const id = ++requestId.current;
    if (ratio === baselinePercent) {
      setWhatIf(null);
      setError("");
      setRunning(false);
      return;
    }
    setRunning(true);
    setError("");
    const timer = window.setTimeout(async () => {
      try {
        const payload = await matchPair({
          comboId,
          userA,
          userB,
          includeAttention: false,
          includeTokens: false,
          seed: seed || undefined,
          maskRatio: ratio / 100,
        });
        if (id !== requestId.current) return;
        setWhatIf(payload);
      } catch (reason) {
        if (id !== requestId.current) return;
        setWhatIf(null);
        setError(describeError(reason));
      } finally {
        if (id === requestId.current) setRunning(false);
      }
    }, 320);
    return () => window.clearTimeout(timer);
  }, [ratio, baselinePercent, baseline, comboId, userA, userB, seed]);

  const disabled = !baseline || userA === null || userB === null;
  const currentScore = whatIf?.prediction.score ?? baseline?.prediction.score ?? null;
  const delta =
    whatIf && baseline ? whatIf.prediction.score - baseline.prediction.score : null;

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-soft">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-violet-900">
            <FlaskConical size={15} className="text-violet-600" /> Mask ratio
          </h3>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">
            Drag to re-run the real model with a different attention-guided mask ratio. The
            checkpoint is restored after every pass; the score and mask counts below update.
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            whatIf ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {whatIf ? "live inference" : "checkpoint baseline"}
        </span>
      </header>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">
              mask ratio <b className="text-slate-800">{ratio}%</b>
            </span>
            <span className="text-slate-400">checkpoint {baselinePercent}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            step={1}
            value={ratio}
            disabled={disabled}
            onChange={(event) => setRatio(Number(event.target.value))}
            aria-label="Mask ratio"
            className="mt-2 h-1.5 w-full max-w-[520px] accent-violet-600 disabled:opacity-40"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRatio(baselinePercent)}
              disabled={disabled || ratio === baselinePercent}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              <RotateCcw size={11} /> Reset to checkpoint
            </button>
            {running && (
              <span className="flex items-center gap-1 text-[10px] text-violet-600">
                <LoaderCircle size={11} className="animate-spin" /> running forward pass…
              </span>
            )}
            {!baseline && (
              <span className="text-[10px] text-amber-700">
                Run Start matching once to create a baseline for this pair.
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">score</p>
              <p className="text-2xl font-bold tabular-nums text-violet-800">
                {formatScore(currentScore)}
              </p>
            </div>
            {delta !== null && (
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                  delta >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                }`}
              >
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(4)}
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">
            {whatIf && baseline
              ? `baseline ${formatScore(baseline.prediction.score)} → ${whatIf.mask.a_count}+${
                  whatIf.mask.b_count
                } tokens masked · ratio ${(whatIf.mask.mask_ratio_setting * 100).toFixed(0)}%`
              : "baseline score from the last match on this pair"}
          </p>
          {error && <p className="mt-1 text-[10px] leading-4 text-rose-600">{error}</p>}
        </div>
      </div>
    </section>
  );
}
