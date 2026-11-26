import { Link2 } from "lucide-react";

import { formatCount } from "../lib/format";
import type { CoOccurrencePair } from "../types";

interface CoOccurrenceTableProps {
  pairs: CoOccurrencePair[];
  platformAName: string;
  platformBName: string;
  timeUnitLabel: string;
  highlightedPair: number | null;
  /** Pinned row; survives the map scroll and mouse-leave that follows a row click. */
  focusedPair?: number | null;
  onHighlight: (index: number | null) => void;
  /** Optional click-to-pin; the map flies to the pair and keeps it highlighted. */
  onSelect?: (index: number) => void;
  /** Open the "Why this match?" drawer for one pair. */
  onExplain?: (index: number) => void;
}

/**
 * The co-occurrence list.
 *
 * The two maps are fitted independently, so a shared position on screen does not mean
 * a shared place. This table is what makes the pairing legible: each row is one
 * spatio-temporal co-occurrence point, numbered `C1, C2, …` exactly as the maps label
 * it, with both step numbers and the measured distance. Hovering a row highlights the
 * two check-ins on the two maps.
 */
export default function CoOccurrenceTable({
  pairs,
  platformAName,
  platformBName,
  timeUnitLabel,
  highlightedPair,
  focusedPair,
  onHighlight,
  onSelect,
  onExplain,
}: CoOccurrenceTableProps) {
  return (
    <section className="min-w-0 max-w-full rounded-2xl border border-blue-100 bg-white p-5 shadow-soft">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 size={15} className="text-emerald-600" />
          <h3 className="text-sm font-bold text-blue-900">Co-occurrence points</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {formatCount(pairs.length)} pair(s)
        </span>
      </header>

      <p className="mt-1 text-[11px] leading-4 text-slate-400">
        A pair counts as a co-occurrence when a {platformAName} check-in and a {platformBName} check-in
        fall in the same {timeUnitLabel} and are within 2 km of each other — the paper&apos;s
        spatio-temporal co-occurrence point. Hover a row to highlight both check-ins on the map;
        click to pin the pair and fly to it; use <span className="font-semibold">Why?</span> for the
        evidence drawer.
      </p>

      {pairs.length === 0 ? (
        <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-4 text-xs leading-5 text-slate-500">
          These two users share no co-occurrence point: no check-in of {platformAName} falls in the same{" "}
          {timeUnitLabel} within 2 km of a check-in of {platformBName}.
        </p>
      ) : (
        <div className="scroll-thin mt-3 max-h-[280px] overflow-x-auto overflow-y-auto rounded-xl border border-blue-100">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="sticky top-0 bg-blue-50 text-blue-900">
              <tr>
                <th className="px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Time slot</th>
                <th className="px-3 py-2 font-semibold">Distance</th>
                <th className="px-3 py-2 font-semibold">{platformAName} step (loc id)</th>
                <th className="px-3 py-2 font-semibold">{platformBName} step (loc id)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {pairs.map((pair) => (
                <tr
                  key={pair.index}
                  onMouseEnter={() => onHighlight(pair.index)}
                  onMouseLeave={() => onHighlight(null)}
                  onClick={() => onSelect?.(pair.index)}
                  className={`cursor-pointer transition-colors ${
                    highlightedPair === pair.index || focusedPair === pair.index
                      ? "bg-emerald-50"
                      : "hover:bg-blue-50/50"
                  }`}
                >
                  <td className="px-3 py-2 font-bold text-emerald-700">
                    <div className="flex items-center gap-1.5">
                      C{pair.index + 1}
                      {onExplain && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onExplain(pair.index);
                          }}
                          className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Why?
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">{pair.slot}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">
                    {pair.distanceM < 1000
                      ? `${Math.round(pair.distanceM)} m`
                      : `${(pair.distanceM / 1000).toFixed(2)} km`}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">
                    {pair.a.step} <span className="text-slate-400">({pair.a.locId})</span>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">
                    {pair.b.step} <span className="text-slate-400">({pair.b.locId})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
