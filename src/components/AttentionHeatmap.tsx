import ReactECharts from "echarts-for-react";
import { Info } from "lucide-react";
import { useMemo, useState } from "react";

import type { AttentionPayload } from "../types";

interface AttentionHeatmapProps {
  attention: AttentionPayload;
  platformAName: string;
  platformBName: string;
  /** Click a matrix cell to locate both raw trajectory tokens on the map. */
  onFocusTokens?: (aToken: number, bToken: number) => void;
}

/**
 * Heatmap of the correlation-attention matrices the model actually produced.
 *
 * The two directions come straight from `prediction.attention`; the axis lengths
 * are the real trajectory lengths, so a 400 x 199 Twitter/Foursquare pair renders
 * a 400 x 199 grid. Very large matrices are block-mean reduced by the backend to
 * keep the payload small; when that happens the UI says so explicitly instead of
 * pretending the grid is the full resolution.
 */
export default function AttentionHeatmap({
  attention,
  platformAName,
  platformBName,
  onFocusTokens,
}: AttentionHeatmapProps) {
  const [direction, setDirection] = useState<"a_to_b" | "b_to_a">("a_to_b");
  const matrix = direction === "a_to_b" ? attention.a_to_b : attention.b_to_a;
  const source = direction === "a_to_b" ? platformAName : platformBName;
  const target = direction === "a_to_b" ? platformBName : platformAName;

  const option = useMemo(() => {
    const rows = matrix.values.length;
    const columns = matrix.values[0]?.length ?? 0;
    if (!rows || !columns) return {};

    const data: [number, number, number][] = [];
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    matrix.values.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        data.push([columnIndex, rowIndex, Number(value.toFixed(5))]);
        if (value < min) min = value;
        if (value > max) max = value;
      });
    });
    if (!Number.isFinite(min)) {
      min = 0;
      max = 1;
    }

    return {
      tooltip: {
        position: "top",
        formatter: (params: { value: [number, number, number] }) =>
          `${source} token #${params.value[1]} → ${target} token #${params.value[0]}<br/>attention: ${params.value[2]}`,
      },
      grid: { left: 62, right: 46, top: 34, bottom: 62 },
      xAxis: {
        type: "category",
        name: `${target} trajectory token`,
        nameLocation: "middle",
        nameGap: 36,
        data: Array.from({ length: columns }, (_, index) => index),
        axisLabel: { fontSize: 10 },
      },
      yAxis: {
        type: "category",
        name: `${source} trajectory token`,
        nameLocation: "middle",
        nameGap: 46,
        data: Array.from({ length: rows }, (_, index) => index),
        axisLabel: { fontSize: 10 },
      },
      visualMap: {
        min,
        max,
        calculable: true,
        orient: "vertical",
        right: 4,
        top: "center",
        itemHeight: 120,
        textStyle: { fontSize: 10 },
        inRange: { color: ["#DBEAFE", "#60A5FA", "#2563EB", "#7C3AED"] },
      },
      series: [
        {
          type: "heatmap",
          data,
          progressive: 0,
          label: { show: false },
          itemStyle: { borderColor: "#F7FAFF", borderWidth: 0.5 },
        },
      ],
    };
  }, [matrix, source, target]);

  return (
    <div className="fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setDirection("a_to_b")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            direction === "a_to_b" ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-blue-50"
          }`}
        >
          {platformAName} → {platformBName}
        </button>
        <button
          type="button"
          onClick={() => setDirection("b_to_a")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            direction === "b_to_a" ? "bg-violet-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-blue-50"
          }`}
        >
          {platformBName} → {platformAName}
        </button>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-600">
          {matrix.shape[0]} × {matrix.shape[1]} attention weights
        </span>
        {matrix.downsampled && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
            downsampled to {matrix.downsampled_shape?.join(" × ")}
          </span>
        )}
      </div>

      <ReactECharts
        option={option}
        style={{ height: 470, marginTop: 12 }}
        notMerge
        onEvents={
          onFocusTokens
            ? {
                click: (params: { value?: [number, number, number] }) => {
                  const value = params.value;
                  if (!value) return;
                  const columnToken = Number(value[0]);
                  const rowToken = Number(value[1]);
                  if (!Number.isFinite(columnToken) || !Number.isFinite(rowToken)) return;
                  if (direction === "a_to_b") onFocusTokens(rowToken, columnToken);
                  else onFocusTokens(columnToken, rowToken);
                },
              }
            : undefined
        }
      />
      {onFocusTokens && (
        <p className="mt-1 text-[10px] text-slate-400">
          Click a cell to locate both raw trajectory tokens on the map; the matrix axes are full
          trajectory tokens, not the display preview.
        </p>
      )}

      {matrix.downsampled && (
        <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-xs leading-5 text-amber-900">
          <Info size={14} className="mt-0.5 shrink-0" />
          The full matrix is {matrix.shape[0]} × {matrix.shape[1]} cells. It was reduced with{" "}
          {matrix.downsample_method} purely for display; the model consumed the full-resolution
          attention shown here only in reduced form.
        </p>
      )}
    </div>
  );
}
