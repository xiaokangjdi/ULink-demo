import { Pause, Play, RotateCcw } from "lucide-react";

import type { CoOccurrencePair } from "../types";

export interface TimelinePoint {
  timestamp: number;
  step: number;
  locId: number;
}

interface TimelinePlayerProps {
  domain: { min: number; max: number; span: number; seconds: boolean };
  pointsA: TimelinePoint[];
  pointsB: TimelinePoint[];
  coPairs: CoOccurrencePair[];
  currentTime: number;
  playing: boolean;
  speed: 1 | 2;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onSpeed: (speed: 1 | 2) => void;
  onReset: () => void;
}

const W = 1000;
const H = 104;
const LEFT = 34;
const RIGHT = 14;
const LANE_A = 32;
const LANE_B = 68;

const formatValue = (domain: { min: number; seconds: boolean }, value: number) => {
  if (!domain.seconds) return `slot ${Math.round(value)}`;
  const hours = (value - domain.min) / 3600;
  return `T+${hours.toFixed(1)} h`;
};

/**
 * Dual-lane time control for the trajectory map.
 *
 * This is deliberately SVG: 300 ticks per lane render fine, click-to-seek works
 * without extra sliders, and playback never re-renders the entire match page. The
 * timeline is a display of the same up-to-300-check-in preview used by the map,
 * not the full raw trajectory; that limit is stated in the footer.
 */
export default function TimelinePlayer({
  domain,
  pointsA,
  pointsB,
  coPairs,
  currentTime,
  playing,
  speed,
  onSeek,
  onTogglePlay,
  onSpeed,
  onReset,
}: TimelinePlayerProps) {
  const xOf = (value: number) =>
    LEFT + ((value - domain.min) / Math.max(domain.span, 1)) * (W - LEFT - RIGHT);
  const clamp = (value: number) => Math.max(domain.min, Math.min(domain.max, value));

  const cursorX = xOf(clamp(currentTime));

  const seekFromPointer = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    onSeek(clamp(domain.min + ratio * domain.span));
  };

  return (
    <div className="mt-3 rounded-xl border border-blue-100 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"
          >
            <RotateCcw size={11} /> Reset
          </button>
          <span className="text-[11px] tabular-nums text-slate-500">
            <b className="text-slate-700">{formatValue(domain, clamp(currentTime))}</b>
            <span className="ml-1 text-slate-400">· full range</span>
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <span>speed</span>
          {([1, 2] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onSpeed(value)}
              className={`rounded px-2 py-0.5 font-semibold ${
                speed === value ? "bg-blue-100 text-blue-700" : "bg-slate-50 text-slate-400 hover:text-slate-600"
              }`}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full cursor-crosshair select-none"
        role="img"
        aria-label="Dual-lane trajectory timeline"
        onClick={seekFromPointer}
      >
        <rect x="0" y="0" width={W} height={H} fill="#F8FBFF" />
        <text x="6" y={LANE_A + 4} fontSize="10" fontWeight="700" fill="#2563EB">
          A
        </text>
        <text x="6" y={LANE_B + 4} fontSize="10" fontWeight="700" fill="#E11D48">
          B
        </text>
        <line x1={LEFT} y1={LANE_A} x2={W - RIGHT} y2={LANE_A} stroke="#DBEAFE" strokeWidth="1" />
        <line x1={LEFT} y1={LANE_B} x2={W - RIGHT} y2={LANE_B} stroke="#FECDD3" strokeWidth="1" />

        {coPairs.map((pair) => {
          const x = xOf(pair.slot);
          return (
            <line
              key={`band-${pair.index}`}
              x1={x}
              y1={LANE_A}
              x2={x}
              y2={LANE_B}
              stroke="#10B981"
              strokeWidth="1"
              opacity="0.28"
            />
          );
        })}

        {pointsA.map((point) => (
          <line
            key={`a-${point.step}`}
            x1={xOf(point.timestamp)}
            y1={LANE_A - 4}
            x2={xOf(point.timestamp)}
            y2={LANE_A + 4}
            stroke="#2563EB"
            strokeWidth="1.5"
            opacity="0.65"
          />
        ))}
        {pointsB.map((point) => (
          <line
            key={`b-${point.step}`}
            x1={xOf(point.timestamp)}
            y1={LANE_B - 4}
            x2={xOf(point.timestamp)}
            y2={LANE_B + 4}
            stroke="#E11D48"
            strokeWidth="1.5"
            opacity="0.65"
          />
        ))}

        {coPairs.map((pair) => {
          const x = xOf(pair.slot);
          return <circle key={`dot-${pair.index}`} cx={x} cy={(LANE_A + LANE_B) / 2} r="2" fill="#10B981" />;
        })}

        <line x1={cursorX} y1="6" x2={cursorX} y2={H - 6} stroke="#0F3B82" strokeWidth="1.5" />
        <circle cx={cursorX} cy={LANE_A} r="3.5" fill="#0F3B82" stroke="#FFFFFF" strokeWidth="1.5" />
        <circle cx={cursorX} cy={LANE_B} r="3.5" fill="#0F3B82" stroke="#FFFFFF" strokeWidth="1.5" />
        <text
          x={Math.min(W - RIGHT - 4, Math.max(LEFT, cursorX + 4))}
          y={H - 8}
          fontSize="9"
          fill="#0F3B82"
          textAnchor={cursorX > W - 90 ? "end" : "start"}
        >
          {formatValue(domain, clamp(currentTime))}
        </text>
      </svg>

      <p className="mt-1 text-[10px] leading-4 text-slate-400">
        Playback uses the up-to-300-check-in display preview; the model always consumed the full
        trajectory.
      </p>
    </div>
  );
}
