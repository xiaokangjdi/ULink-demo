import ReactECharts from "echarts-for-react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { describeError, getExperiments } from "../api/client";
import { formatMeanStd, formatMeanStdPercent, formatMetric, formatStdShare } from "../lib/format";
import type { ExperimentPayload, MetricBlock } from "../types";

const METRIC_LABELS: { key: string; label: string }[] = [
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" },
  { key: "f1", label: "F1" },
  { key: "auc", label: "AUC" },
  { key: "accuracy", label: "Accuracy" },
];

/**
 * The subset of the recorded training arguments that actually describes the model
 * or how it was optimised. Everything else (paths, device, gpu index, filter sizes,
 * negative-sampling counts, averaging mode, …) is still available behind the
 * source JSON, but not printed here.
 */
const KEY_CONFIG_FIELDS: [string, string][] = [
  ["embed_size", "Embedding size"],
  ["num_heads", "Attention heads"],
  ["num_layers", "TTE layers"],
  ["num_layers_attn", "CAB layers"],
  ["num_layers_mask", "MTE layers"],
  ["threshold", "Mask ratio"],
  ["lr", "Learning rate"],
];

/**
 * Results module.
 *
 * Design rules enforced here:
 *  • every number is printed with the file it came from;
 *  • a metric that is missing shows "--" and the reason, never a substitute;
 *  • the paper's published values live in their own column and their own bar
 *    series, and are never averaged with the reproduction;
 *  • when the loaded checkpoint was not produced by the reported run, the UI says
 *    so next to that pair.
 */
export default function ResultsPage() {
  const [experiments, setExperiments] = useState<ExperimentPayload[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await getExperiments();
        if (cancelled) return;
        setExperiments(payload);
        setExpanded(payload[0]?.combo_id ?? null);
      } catch (reason) {
        if (!cancelled) setError(describeError(reason));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-[1400px] px-6 pb-20">
      <section className="pt-12">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-600">Evaluation</p>
        <h1 className="mt-3 text-[32px] font-bold text-[#0F3B82]">Reproduced experiment results</h1>
      </section>

      {error && (
        <p className="mt-6 rounded-2xl border border-rose-100 bg-rose-50/70 px-5 py-4 text-sm leading-6 text-rose-700">
          {error}
        </p>
      )}

      {loading && !error && (
        <p className="mt-10 text-sm text-slate-400">Loading experiment files…</p>
      )}

      {/* ------------------------------------------------ headline table */}
      {experiments.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl font-bold text-blue-900">Summary across five seeds</h2>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-blue-100 bg-white shadow-soft">
            <table className="w-full min-w-[1150px] text-left text-sm">
              <thead className="bg-blue-50 text-blue-900">
                <tr>
                  <th className="px-4 py-3 font-semibold">Platform pair</th>
                  {METRIC_LABELS.map((metric) => (
                    <th key={metric.key} className="px-4 py-3 font-semibold">
                      {metric.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold">MTLink Precision</th>
                  <th className="px-4 py-3 font-semibold">MTLink Recall</th>
                  <th className="px-4 py-3 font-semibold">MTLink F1</th>
                  <th className="px-4 py-3 font-semibold">MTLink AUC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {experiments.map((experiment) => {
                  const paper = experiment.paper_reference;
                  const mtLink = paper.available ? paper.published?.["MT-Link (paper)"] : undefined;
                  return (
                    <tr key={experiment.combo_id} className="hover:bg-blue-50/40">
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {experiment.label}
                        {experiment.consistency.matches_reported_experiment === false && (
                          <span
                            className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700"
                            title="The loaded checkpoint differs from the reported run"
                          >
                            checkpoint differs
                          </span>
                        )}
                      </td>
                      {METRIC_LABELS.map((metric) => {
                        const block: MetricBlock | undefined = experiment.metrics[metric.key];
                        const missing = !block || block.count === 0;
                        return (
                          <td key={metric.key} className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">
                            {missing ? (
                              <span className="text-slate-300" title="not present in the result files">
                                --
                              </span>
                            ) : (
                              formatMeanStdPercent(block)
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 tabular-nums text-slate-500">
                        {mtLink ? `${mtLink.precision.toFixed(2)}%` : "--"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-500">
                        {mtLink ? `${mtLink.recall.toFixed(2)}%` : "--"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-500">
                        {mtLink ? `${mtLink.f1.toFixed(2)}%` : "--"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-500">
                        {mtLink ? `${mtLink.auc.toFixed(2)}%` : "--"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ------------------------------------------------- per-pair detail */}
      {experiments.map((experiment) => (
        <PairDetail
          key={experiment.combo_id}
          experiment={experiment}
          open={expanded === experiment.combo_id}
          onToggle={() => setExpanded(expanded === experiment.combo_id ? null : experiment.combo_id)}
        />
      ))}

    </main>
  );
}

/* ------------------------------------------------------------------ detail */

function PairDetail({
  experiment,
  open,
  onToggle,
}: {
  experiment: ExperimentPayload;
  open: boolean;
  onToggle: () => void;
}) {
  const mtLink = experiment.paper_reference.available
    ? experiment.paper_reference.published?.["MT-Link (paper)"]
    : undefined;

  // How many trailing epochs are worth plotting, and what they cover.
  // See the comment inside for why the chart needs this.
  // Default view keeps every epoch; the toggle only narrows the plotted x-range.
  const [focusLoss, setFocusLoss] = useState(false);

  const lossWindow = useMemo(() => {
    const train = experiment.curves.train_loss ?? [];
    const valid = experiment.curves.valid_loss ?? [];
    const length = Math.max(train.length, valid.length);
    const positive = (series: (number | null)[]) =>
      series.filter((v): v is number => typeof v === "number" && v > 0);
    const all = [...positive(train), ...positive(valid)];
    if (!length || !all.length) {
      return { length, keep: length, trimmed: 0, yMin: 1, yMax: 10, droppedRange: null as null | [number, number] };
    }
    const yMin = Math.min(...all);
    const yMax = Math.max(...all);
    const span = Math.log10(yMax) - Math.log10(yMin);
    // Only epochs whose remaining range is a near-invisible sliver of the log axis
    // are candidates for the "focus" view. Measured on the real curves this is
    // almost never the case (the log axis already separates the settled values), so
    // the default view keeps every epoch and this is offered as an explicit toggle.
    const DEAD_FRACTION = 0.012;
    let keep = length;
    if (span > 0.3 && length > 6) {
      for (let i = 2; i < length; i += 1) {
        const rest = [...positive(train.slice(i)), ...positive(valid.slice(i))];
        if (rest.length < 2) break;
        const restSpan = Math.log10(Math.max(...rest)) - Math.log10(Math.min(...rest));
        if (restSpan <= span * DEAD_FRACTION) {
          keep = i;
          break;
        }
      }
    }
    keep = Math.max(4, Math.min(keep, length));
    const trimmed = length - keep;
    let droppedRange: [number, number] | null = null;
    if (trimmed) {
      const rest = [...positive(train.slice(keep)), ...positive(valid.slice(keep))];
      if (rest.length) droppedRange = [Math.min(...rest), Math.max(...rest)];
    }
    return { length, keep, trimmed, yMin, yMax, droppedRange };
  }, [experiment.curves]);

  const lossOption = useMemo(() => {
    const train = experiment.curves.train_loss ?? [];
    const valid = experiment.curves.valid_loss ?? [];
    if (!train.length && !valid.length) return {};
    const { length, keep, trimmed, yMin, yMax } = lossWindow;
    const bySeed = experiment.curves.by_seed ?? {};
    const seeds = Object.keys(bySeed).sort((a, b) => Number(a) - Number(b));

    // When the curves were parsed per seed, the mean lines are drawn thick and the
    // individual runs faint, so a single good or bad seed is visible instead of
    // being hidden inside the average.
    const perSeedSeries =
      seeds.length > 1
        ? seeds.map((seed) => ({
            name: `seed ${seed}`,
            type: "line",
            smooth: true,
            showSymbol: false,
            data: bySeed[seed].train_loss,
            lineStyle: { color: "#93C5FD", width: 1, opacity: 0.7 },
            itemStyle: { color: "#93C5FD" },
          }))
        : [];

    return {
      tooltip: { trigger: "axis" },
      legend: {
        top: 6,
        type: "scroll",
        data: ["Train loss (mean)", "Validation loss (mean)", ...seeds.map((seed) => `seed ${seed}`)],
      },
      grid: { left: 56, right: 24, top: 52, bottom: trimmed ? 62 : 50 },
      xAxis: {
        type: "category",
        name: "Epoch",
        nameLocation: "middle",
        nameGap: trimmed ? 44 : 28,
        data: Array.from({ length }, (_, index) => index + 1),
      },
      yAxis: {
        type: "log",
        name: "Loss (log)",
        // A log axis shows the 200 -> 1 sweep and the late 1.05 -> 1.00 wiggle at the
        // same time; on a linear axis the settled tail is invisible.
        min: Number((yMin * 0.8).toPrecision(2)),
        max: Number((yMax * 1.25).toPrecision(2)),
      },
      series: [
        ...perSeedSeries,
        {
          name: "Train loss (mean)",
          type: "line",
          smooth: true,
          data: train,
          z: 5,
          lineStyle: { color: "#2563EB", width: 2.5 },
          itemStyle: { color: "#2563EB" },
          markLine: trimmed
            ? {
                silent: true,
                symbol: "none",
                label: {
                  formatter: "trimmed",
                  position: "insideEndTop",
                  color: "#94A3B8",
                  fontSize: 10,
                },
                lineStyle: { color: "#CBD5E1", type: "dashed", width: 1 },
                data: [{ xAxis: keep - 1 }],
              }
            : undefined,
        },
        {
          name: "Validation loss (mean)",
          type: "line",
          smooth: true,
          data: valid,
          z: 5,
          lineStyle: { color: "#8B5CF6", width: 2.5 },
          itemStyle: { color: "#8B5CF6" },
        },
      ],
      // Opt-in window: by default every logged epoch is plotted, so no value is
      // ever withheld. The toggle only narrows the x-range to the epochs that still
      // move visibly.
      dataZoom: focusLoss && trimmed
        ? [
            { type: "inside", xAxisIndex: 0, start: 0, end: (keep / length) * 100 },
            {
              type: "slider",
              xAxisIndex: 0,
              height: 16,
              bottom: 8,
              start: 0,
              end: (keep / length) * 100,
            },
          ]
        : undefined,
    };
  }, [experiment.curves, lossWindow, focusLoss]);

  const comparisonOption = useMemo(() => {
    const metrics = ["precision", "recall", "f1", "auc"];
    const labels = ["Precision", "Recall", "F1", "AUC"];
    const reproduced = metrics.map((key) => {
      const value = experiment.metrics[key]?.mean;
      return value === null || value === undefined ? null : Number((value * 100).toFixed(2));
    });
    const paper = metrics.map((key) => (mtLink ? mtLink[key] : null));
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: {
        top: 6,
        data: ["Reproduced (this project)", "MTLink (AAAI-25)"],
      },
      grid: { left: 52, right: 20, top: 48, bottom: 36 },
      xAxis: { type: "category", data: labels },
      yAxis: { type: "value", name: "%", min: 0, max: 100 },
      series: [
        {
          name: "Reproduced (this project)",
          type: "bar",
          barMaxWidth: 26,
          data: reproduced,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "#3B82F6" },
                { offset: 1, color: "#7C3AED" },
              ],
            },
          },
        },
        {
          name: "MTLink (AAAI-25)",
          type: "bar",
          barMaxWidth: 26,
          data: paper,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: "#CBD5E1",
          },
        },
      ],
    };
  }, [experiment.metrics, mtLink]);

  const config = experiment.experiment_config ?? experiment.reported_configuration ?? null;
  const differenceFields = experiment.consistency.differences ?? [];

  return (
    <section className="mt-8 rounded-2xl border border-blue-100 bg-white shadow-soft">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span>
          <span className="text-lg font-bold text-blue-900">{experiment.label}</span>
          <span className="ml-3 rounded bg-slate-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
            {experiment.combo_id} · 5-seed sweep
          </span>
          <span className="mt-1 block text-xs text-slate-500">
            F1 {formatMeanStd(experiment.metrics.f1)} · AUC {formatMeanStd(experiment.metrics.auc)}
          </span>
        </span>
        {open ? <ChevronUp size={18} className="text-blue-500" /> : <ChevronDown size={18} className="text-blue-500" />}
      </button>

      {open && (
        <div className="fade-in border-t border-blue-50 px-6 pb-6 pt-5">
          {/* consistency */}
          {experiment.consistency.matches_reported_experiment === false && (
            <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50/80 px-5 py-4">
              <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <ShieldAlert size={16} /> The loaded checkpoint is not the reported run
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-900/80">{experiment.consistency.note}</p>
              <table className="mt-3 w-full max-w-lg text-left text-xs">
                <thead className="text-amber-900/70">
                  <tr>
                    <th className="py-1 font-semibold">Field</th>
                    <th className="py-1 font-semibold">Loaded checkpoint</th>
                    <th className="py-1 font-semibold">Reported run</th>
                  </tr>
                </thead>
                <tbody>
                  {differenceFields.map((difference) => (
                    <tr key={difference.field} className="border-t border-amber-100">
                      <td className="py-1 text-amber-900/80">{difference.field}</td>
                      <td className="py-1 tabular-nums text-amber-900">{String(difference.checkpoint)}</td>
                      <td className="py-1 tabular-nums text-amber-900">
                        {String(difference.reported_experiment)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {experiment.warnings.length > 0 && (
            <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50/70 px-5 py-4">
              {experiment.warnings.map((warning) => (
                <p key={warning} className="flex items-start gap-2 text-xs leading-5 text-amber-900">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {warning}
                </p>
              ))}
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            {/* per-seed */}
            <div>
              <h3 className="text-sm font-bold text-blue-900">Per-seed test results</h3>
              <div className="mt-3 overflow-hidden rounded-xl border border-blue-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-blue-50 text-blue-900">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Seed</th>
                      <th className="px-3 py-2 font-semibold">Accuracy</th>
                      <th className="px-3 py-2 font-semibold">Precision</th>
                      <th className="px-3 py-2 font-semibold">Recall</th>
                      <th className="px-3 py-2 font-semibold">F1</th>
                      <th className="px-3 py-2 font-semibold">AUC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {experiment.runs.map((run) => (
                      <tr key={run.seed}>
                        <td className="px-3 py-2 tabular-nums font-semibold text-slate-600">{run.seed}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-500">
                          {formatMetric(run.accuracy ?? null)}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-slate-600">
                          {formatMetric(run.precision ?? null)}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-slate-600">
                          {formatMetric(run.recall ?? null)}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-slate-600">{formatMetric(run.f1 ?? null)}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-600">{formatMetric(run.auc ?? null)}</td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50/60 font-semibold">
                      <td className="px-3 py-2 text-slate-600">mean</td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">
                        {formatMetric(experiment.metrics.accuracy?.mean ?? null)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">
                        {formatMetric(experiment.metrics.precision?.mean ?? null)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">
                        {formatMetric(experiment.metrics.recall?.mean ?? null)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">
                        {formatMetric(experiment.metrics.f1?.mean ?? null)}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-slate-700">
                        {formatMetric(experiment.metrics.auc?.mean ?? null)}
                      </td>
                    </tr>
                    <tr className="text-slate-500">
                      <td className="px-3 py-2">std</td>
                      {["accuracy", "precision", "recall", "f1", "auc"].map((key) => (
                        <td key={key} className="px-3 py-2 tabular-nums">
                          {formatMetric(experiment.metrics[key]?.std ?? null)}
                        </td>
                      ))}
                    </tr>
                    <tr className="text-slate-400">
                      <td className="px-3 py-2">relative std</td>
                      {["accuracy", "precision", "recall", "f1", "auc"].map((key) => (
                        <td key={key} className="px-3 py-2 tabular-nums">
                          {formatStdShare(
                            experiment.metrics[key]?.mean ?? null,
                            experiment.metrics[key]?.std ?? null,
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

            {/* config + sources */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-blue-900">Training configuration of the run</h3>
                {config ? (
                  <>
                    {/* Only the settings that change what the model is, or how it was
                        optimised. Everything else (paths, device, gpu index, filter
                        sizes, samplers, averaging…) stays in the result files. */}
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-blue-100 bg-blue-50/40 p-4 text-xs">
                      {KEY_CONFIG_FIELDS.filter(([key]) => key in config).map(([key, label]) => (
                        <div key={key} className="flex items-baseline justify-between gap-2">
                          <dt className="truncate text-slate-400" title={key}>
                            {label}
                          </dt>
                          <dd className="shrink-0 font-medium tabular-nums text-slate-700">
                            {String(config[key])}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    The training arguments were not published for this pair.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* charts */}
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-blue-900">Training and validation loss</h3>
                {experiment.curves.available && lossWindow.trimmed > 0 && (
                  <button
                    type="button"
                    onClick={() => setFocusLoss((on) => !on)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                      focusLoss
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                    title="Narrow the x-axis to the epochs that still move visibly. Off by default, so every logged epoch is plotted."
                  >
                    {focusLoss ? "showing informative epochs" : "show all epochs"}
                  </button>
                )}
              </div>
              {experiment.curves.available ? (
                <>
                  <ReactECharts option={lossOption} style={{ height: 360, marginTop: 8 }} notMerge />
                </>
              ) : (
                <p className="mt-3 text-xs text-slate-400">
                  No per-epoch loss curve is available for this platform pair.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-soft">
              <h3 className="text-sm font-bold text-blue-900">
                Reproduction vs MTLink's published figures
              </h3>
              {mtLink ? (
                <ReactECharts option={comparisonOption} style={{ height: 330, marginTop: 8 }} notMerge />
              ) : (
                <p className="mt-3 text-xs text-slate-400">
                  MTLink does not report this platform pair.
                </p>
              )}
            </div>
          </div>

        </div>
      )}
    </section>
  );
}
