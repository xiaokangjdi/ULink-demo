import { Cpu } from "lucide-react";

import { formatCount, formatMs, formatScore } from "../lib/format";
import type { MatchResponse } from "../types";

interface MatchResultPanelProps {
  result: MatchResponse;
}

function Row({ label, value, wrap }: { label: string; value: string; wrap?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-blue-50 py-1.5 last:border-0">
      <dt className="shrink-0 text-xs text-slate-400">{label}</dt>
      <dd
        className={`min-w-0 text-right text-xs font-medium tabular-nums text-slate-700 ${
          wrap ? "break-all" : "truncate"
        }`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Result of one real forward pass.
 *
 * Three things are deliberately kept apart on this panel:
 *   • the model output and the decision made from it,
 *   • the dataset-level correspondence (shared user id / stored pair list), which
 *     the model never sees,
 *   • the evidence that the score was computed rather than looked up.
 */
export default function MatchResultPanel({ result }: MatchResultPanelProps) {
  const { prediction, model, timing_ms, evidence } = result;
  const isMatch = prediction.is_match;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-blue-100 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Model output · match score
          </p>
          <p className="mt-3 text-6xl font-extrabold tabular-nums text-blue-600">
            {formatScore(prediction.score)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex rounded-full px-5 py-2 text-sm font-bold ${
                isMatch ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              }`}
            >
              {isMatch ? "Predicted: same person" : "Predicted: different people"}
            </span>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-500">
              decision threshold {prediction.decision_threshold}
            </span>
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-500">
              label {prediction.predicted_label}
            </span>
          </div>
        </section>

      </div>

      <div className="space-y-5">
        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-soft">
          <header className="flex items-center gap-2">
            <Cpu size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-blue-900">Model actually used</h3>
          </header>
          <dl className="mt-2">
            <Row label="Platform pair" value={`${result.combo_label} (${result.combo_id})`} />
            <Row label="Checkpoint seed" value={model.seed} />
            <Row label="Location vocabulary" value={formatCount(model.config.loc_size)} />
            <Row
              label="Encoder layers"
              value={`TTE ${model.config.num_layers} · MTE ${model.config.num_layers_mask} · CAB ${model.config.num_layers_attn}`}
            />
            <Row label="Embedding / heads" value={`${model.config.embed_size} / ${model.config.num_heads ?? "--"}`} />
            <Row label="Mask ratio (training)" value={String(model.config.threshold ?? "--")} />
          </dl>
        </section>

      </div>
    </div>
  );
}
