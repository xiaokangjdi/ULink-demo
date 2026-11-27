import ReactECharts from "echarts-for-react";

import { TRAINING_CURVES, type TrainingCurve } from "../data/trainingCurves";

const TRAIN_COLOR = "#2563EB";
const VALID_COLOR = "#8B5CF6";

function buildOption(curve: TrainingCurve) {
  const train = curve.trainLoss;
  const valid = curve.validLoss;
  const yMax = Math.max(...train, ...valid);
  const axisMax = yMax > 100 ? Math.ceil(yMax / 50) * 50 : yMax > 20 ? Math.ceil(yMax / 5) * 5 : Math.ceil(yMax);

  return {
    animationDuration: 500,
    tooltip: { trigger: "axis" },
    grid: { left: 50, right: 14, top: 16, bottom: 34 },
    xAxis: {
      type: "category",
      name: "Epoch",
      nameLocation: "middle",
      nameGap: 23,
      boundaryGap: false,
      data: Array.from({ length: curve.epochs }, (_, index) => index + 1),
      axisLine: { lineStyle: { color: "#CBD5E1" } },
      axisTick: { show: false },
      axisLabel: {
        color: "#64748B",
        fontSize: 9,
        hideOverlap: true,
        interval: (index: number, value: string) => {
          const epoch = Number(value);
          return index === 0 || epoch % 5 === 0 || epoch === curve.epochs;
        },
      },
      nameTextStyle: { color: "#64748B", fontSize: 10 },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: axisMax,
      splitNumber: 5,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#64748B", fontSize: 9 },
      splitLine: { lineStyle: { color: "#EFF6FF" } },
    },
    series: [
      {
        name: "Train loss",
        type: "line",
        data: train,
        showSymbol: false,
        symbol: "circle",
        symbolSize: 4,
        smooth: false,
        lineStyle: { width: 2.2, color: TRAIN_COLOR },
        itemStyle: { color: TRAIN_COLOR },
        emphasis: { focus: "series" },
      },
      {
        name: "Validation loss",
        type: "line",
        data: valid,
        showSymbol: false,
        symbol: "circle",
        symbolSize: 4,
        smooth: false,
        lineStyle: { width: 1.8, color: VALID_COLOR },
        itemStyle: { color: VALID_COLOR },
        emphasis: { focus: "series" },
      },
    ],
  };
}

/**
 * One loss panel per platform pair, all from recorded per-epoch logs.
 *
 * The point of showing every logged epoch (rather than the first ten) is the
 * tail: each run early-stopped only after validation stopped improving, so the
 * late epochs are the real convergence region, not a still-steep truncation.
 */
const TAIL_EPOCHS = 10;

/** Full raw loss above; a local raw-scale view of the last epochs below. */
function buildTailOption(curve: TrainingCurve) {
  const start = Math.max(0, curve.epochs - TAIL_EPOCHS);
  const train = curve.trainLoss.slice(start);
  const valid = curve.validLoss.slice(start);
  const epochs = train.map((_, index) => start + index + 1);
  const values = [...train, ...valid];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.18 || Math.max(0.005, Math.abs(max) * 0.02);
  const rawStep = Math.max((max - min) / 3, 1e-6);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;
  const step = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;
  const axisMin = Math.floor((min - pad) / step) * step;
  const axisMax = Math.ceil((max + pad) / step) * step;

  return {
    animationDuration: 300,
    tooltip: { trigger: "axis" },
    grid: { left: 36, right: 10, top: 8, bottom: 16 },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: epochs,
      axisLine: { lineStyle: { color: "#E2E8F0" } },
      axisTick: { show: false },
      axisLabel: {
        color: "#94A3B8",
        fontSize: 8,
        interval: (index: number) => index === 0 || index === epochs.length - 1 || index === Math.floor(epochs.length / 2),
      },
    },
    yAxis: {
      type: "value",
      min: Number(axisMin.toPrecision(6)),
      max: Number(axisMax.toPrecision(6)),
      splitNumber: 3,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#94A3B8", fontSize: 8, formatter: (value: number) => Number(value).toFixed(2) },
      splitLine: { lineStyle: { color: "#F1F5F9" } },
    },
    series: [
      { name: "Train loss", type: "line", data: train, showSymbol: false, smooth: false, lineStyle: { width: 1.8, color: TRAIN_COLOR }, itemStyle: { color: TRAIN_COLOR } },
      { name: "Validation loss", type: "line", data: valid, showSymbol: false, smooth: false, lineStyle: { width: 1.5, color: VALID_COLOR }, itemStyle: { color: VALID_COLOR } },
    ],
  };
}

const CURVE_OPTIONS = TRAINING_CURVES.map(buildOption);
const TAIL_OPTIONS = TRAINING_CURVES.map(buildTailOption);

export default function TrainingLossCurves() {
  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">
            Training evidence
          </p>
          <h2 className="mt-1 text-lg font-bold text-blue-900">
            Training loss across the four platform pairs
          </h2>
          <p className="mt-1 max-w-[850px] text-xs leading-5 text-slate-500">
            Real recorded per-epoch logs. Each panel names its seed and runs to that pair&apos;s
            early-stopping epoch. The main chart is the full run on a linear raw-loss axis; the
            smaller chart below each panel is the tail on its own raw scale.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-4 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-0.5 w-4 rounded-full" style={{ background: TRAIN_COLOR }} />
              Train
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-0.5 w-4 rounded-full" style={{ background: VALID_COLOR }} />
              Validation
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {TRAINING_CURVES.map((curve, index) => {
          const finalTrain = curve.trainLoss[curve.trainLoss.length - 1];
          const finalValid = curve.validLoss[curve.validLoss.length - 1];
          return (
            <article
              key={curve.id}
              className="min-w-0 rounded-xl border border-blue-100 bg-blue-50/20 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-blue-900">{curve.pair}</h3>
                  <p className="mt-0.5 text-[10px] leading-4 text-slate-400">
                    {curve.seeds} · stopped at epoch {curve.epochs} of {curve.epochBudget}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-blue-700 shadow-sm">
                  {curve.epochs} epochs
                </span>
              </div>

              <ReactECharts option={CURVE_OPTIONS[index]} style={{ height: 176, marginTop: 2 }} notMerge />

              <div className="mt-1 rounded-lg border border-blue-50 bg-slate-50/50 px-1.5 pb-0.5 pt-1">
                <ReactECharts option={TAIL_OPTIONS[index]} style={{ height: 76 }} notMerge />
              </div>

              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
                <span>
                  final train{" "}
                  <b className="tabular-nums text-blue-700">{finalTrain.toFixed(3)}</b>
                </span>
                <span>
                  final validation{" "}
                  <b className="tabular-nums text-violet-700">{finalValid.toFixed(3)}</b>
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] leading-4 text-slate-400">
        Early stopping follows validation loss, so a training curve that still drifts slightly near
        the end is expected. Sources:{" "}
        <span className="font-mono text-slate-500">{TRAINING_CURVES[0].source}</span> (ISP–Weibo) ·{" "}
        <span className="font-mono text-slate-500">&#123;tw_fs,fs_fb&#125;/log/training.log</span> ·{" "}
        <span className="font-mono text-slate-500">tw_fb/train_metrics.json</span>.
      </p>
    </section>
  );
}
