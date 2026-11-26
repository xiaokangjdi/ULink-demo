import { CheckCircle2, HelpCircle, ShieldCheck, XCircle } from "lucide-react";

import type { GroundTruthPayload, MatchResponse } from "../types";

/**
 * Dataset ground truth next to the model prediction.
 *
 * The label comes from the released data only (the shared-user-id relation that
 * the official preprocessing defines), never from the model score, and it is
 * looked up after the forward pass. A pair the release cannot label is shown as
 * "unknown" -- it is never silently reported as a non-match.
 */
export default function GroundTruthPanel({ result }: { result: MatchResponse }) {
  const gt: GroundTruthPayload | null | undefined = result.ground_truth;

  const predicted = result.prediction.predicted_label;
  const label = gt?.label ?? null;

  let evaluation: { text: string; tone: "ok" | "bad" | "unknown"; icon: JSX.Element };
  if (!gt || !gt.has_label || label === null) {
    evaluation = {
      text: "not determinable",
      tone: "unknown",
      icon: <HelpCircle size={16} />,
    };
  } else if (predicted === label) {
    evaluation = { text: "correct", tone: "ok", icon: <CheckCircle2 size={16} /> };
  } else {
    evaluation = { text: "wrong", tone: "bad", icon: <XCircle size={16} /> };
  }

  const toneClass =
    evaluation.tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : evaluation.tone === "bad"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-50 text-slate-600";

  const gtTone =
    gt?.verdict === "match"
      ? "text-emerald-700"
      : gt?.verdict === "non_match"
        ? "text-rose-700"
        : "text-slate-500";

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-soft">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-blue-600" />
          <h3 className="text-sm font-bold text-blue-900">Ground truth vs prediction</h3>
        </span>
        <span
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}
        >
          {evaluation.icon}
          Prediction: {evaluation.text}
        </span>
      </header>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={`Twitter user (${result.platform_a.name})`} value={String(result.platform_a.user.user_id)} />
        <Field label={`Foursquare user (${result.platform_b.name})`} value={String(result.platform_b.user.user_id)} />

        <Field
          label="Model score"
          value={result.prediction.score.toFixed(6)}
          hint={`threshold ${result.prediction.decision_threshold}`}
        />
        <Field
          label="Model prediction"
          value={predicted === 1 ? "match" : "non-match"}
          hint={`sigmoid output, thresholded at ${result.prediction.decision_threshold}`}
        />
        <Field
          label="Ground truth"
          value={gt?.has_label && gt.label !== null ? String(gt.label) : "—"}
          valueClass={gtTone}
          hint={
            gt?.has_label
              ? gt.label === 1
                ? "1 = same person"
                : "0 = different people"
              : "no label in this release"
          }
        />
        <Field label="Evaluation" value={evaluation.text} valueClass={toneClass.split(" ").pop()} />
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  hint,
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${valueClass ?? "text-slate-700"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10.5px] text-slate-400">{hint}</p>}
    </div>
  );
}
