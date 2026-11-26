import { Check, Circle, LoaderCircle } from "lucide-react";

import type { PipelineStage } from "../types";

const STAGES: { key: string; name: string }[] = [
  { key: "embedding", name: "Spatial-Temporal Embedding" },
  { key: "tte", name: "Temporal Transformer Encoder" },
  { key: "cab", name: "Correlation Attention Block" },
  { key: "masking", name: "Attention-guided Masking" },
  { key: "mte", name: "Masked Transformer Encoder" },
  { key: "classifier", name: "Binary Classifier" },
];

interface PipelineStagesProps {
  pipeline: PipelineStage[] | null;
  running: boolean;
  orientation?: "vertical" | "horizontal";
}

function detailFor(stage: PipelineStage): string {
  if (stage.attention_shapes) {
    return `attention ${stage.attention_shapes.a_to_b.join("×")} / ${stage.attention_shapes.b_to_a.join("×")}`;
  }
  if (stage.a_mask_count !== undefined && stage.b_mask_count !== undefined) {
    return `${stage.a_mask_count} + ${stage.b_mask_count} tokens masked`;
  }
  if (stage.a_shape && stage.b_shape) {
    return `A ${stage.a_shape.join("×")} · B ${stage.b_shape.join("×")}`;
  }
  if (stage.output_shape) {
    return `output ${stage.output_shape.join("×")}`;
  }
  return "";
}

/**
 * Live state of the six MT-Link modules.
 *
 * The steps are driven by the `pipeline` array of the actual response, so a
 * completed step means the backend really captured that module's output tensor.
 * Before a request the stages are shown as pending rather than animating a fake
 * progress sequence.
 */
export default function PipelineStages({
  pipeline,
  running,
  orientation = "vertical",
}: PipelineStagesProps) {
  const horizontal = orientation === "horizontal";
  return (
    <section className={`rounded-2xl border border-blue-100 bg-white shadow-soft ${horizontal ? "p-4" : "p-5"}`}>
      <header className="flex items-center gap-2">
        <h3 className="text-base font-bold text-blue-900">Model pipeline</h3>
        {running && <LoaderCircle size={15} className="animate-spin text-blue-500" />}
      </header>
      <ol
        className={
          horizontal
            ? "mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
            : "mt-3 flex flex-1 flex-col gap-2"
        }
      >
        {STAGES.map((stage, index) => {
          const captured = pipeline?.find((item) => item.stage === stage.key);
          const done = Boolean(captured);
          return (
            <li
              key={stage.key}
              className={`flex items-start gap-3 rounded-xl border transition-colors ${horizontal ? "px-2.5 py-2" : "flex-1 px-3 py-2.5"} ${
                done ? "border-blue-200 bg-blue-50" : "border-blue-100 bg-white"
              }`}
            >
              <span
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                  done ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                }`}
              >
                {done ? <Check size={13} /> : <Circle size={11} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block whitespace-nowrap text-[11px] font-semibold leading-4 text-slate-700">
                  {index + 1}. {stage.name}
                </span>
                <span className="mt-0.5 block truncate text-[11px] tabular-nums text-slate-400">
                  {captured ? detailFor(captured) : running ? "running…" : "pending"}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
