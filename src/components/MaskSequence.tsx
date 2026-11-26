import { Scissors } from "lucide-react";

import { formatCount } from "../lib/format";

interface MaskSequenceProps {
  title: string;
  platformName: string;
  userId: number;
  tokens: number[];
  mask: number[];
  maskCount: number;
  maskRatio: number;
  maskRatioSetting: number;
  color: "blue" | "violet";
  maxPreview?: number;
}

/**
 * Shows the attention-guided masking of one trajectory.
 *
 * Both the tokens and the 0/1 mask come from the forward pass. The displayed
 * ratio is computed from the real mask array (`maskCount / tokens.length`), not
 * from the configured mask ratio, so a short sequence that masks two tokens reads
 * as 6.9%, not as the 10% setting.
 */
export default function MaskSequence({
  title,
  platformName,
  userId,
  tokens,
  mask,
  maskCount,
  maskRatio,
  maskRatioSetting,
  color,
  maxPreview = 220,
}: MaskSequenceProps) {
  const visible = tokens.slice(0, maxPreview);
  const originalChip =
    color === "blue"
      ? "border-blue-100 bg-blue-50 text-blue-700"
      : "border-violet-100 bg-violet-50 text-violet-700";

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-soft">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-blue-900">{title}</h3>
          <p className="text-[11px] text-slate-400">
            {platformName} · user {userId} · {formatCount(tokens.length)} tokens
          </p>
        </div>
        <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-600">
          {formatCount(maskCount)} masked
        </span>
      </header>

      <p className="mt-3 text-xs font-semibold text-slate-500">Original sequence</p>
      <div className="scroll-thin mt-1 flex max-h-28 flex-wrap gap-1.5 overflow-auto">
        {visible.map((token, index) => (
          <span
            key={`o${index}`}
            className={`rounded-md border px-2 py-1 text-xs tabular-nums ${originalChip}`}
            title={`step ${index + 1}`}
          >
            {token}
          </span>
        ))}
        {tokens.length > visible.length && (
          <span className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-400">
            +{formatCount(tokens.length - visible.length)} more
          </span>
        )}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Scissors size={13} /> Masked sequence (lowest-attention tokens replaced by a learned
        embedding)
      </p>
      <div className="scroll-thin mt-1 flex max-h-28 flex-wrap gap-1.5 overflow-auto">
        {visible.map((token, index) =>
          mask[index] ? (
            <span
              key={`m${index}`}
              className="rounded-md border border-pink-200 bg-pink-100 px-2 py-1 text-xs font-semibold text-pink-600"
              title={`step ${index + 1} masked`}
            >
              [MASK]
            </span>
          ) : (
            <span
              key={`m${index}`}
              className={`rounded-md border px-2 py-1 text-xs tabular-nums ${originalChip}`}
              title={`step ${index + 1}`}
            >
              {token}
            </span>
          ),
        )}
      </div>
    </section>
  );
}
