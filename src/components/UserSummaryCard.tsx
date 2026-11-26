import { Fingerprint, MapPin, Clock } from "lucide-react";

import { formatCount } from "../lib/format";
import type { UserSummary } from "../types";

interface UserSummaryCardProps {
  label: string;
  platformName: string;
  accent: "blue" | "violet";
  user: UserSummary | null;
  sameIdAsCounterpart?: boolean;
}

const ACCENT = {
  blue: { badge: "bg-blue-50 text-blue-700", border: "border-blue-100", title: "text-blue-900" },
  violet: { badge: "bg-violet-50 text-violet-700", border: "border-violet-100", title: "text-violet-900" },
} as const;

export default function UserSummaryCard({
  label,
  platformName,
  accent,
  user,
  sameIdAsCounterpart,
}: UserSummaryCardProps) {
  const styles = ACCENT[accent];

  if (!user) {
    return (
      <div className={`rounded-2xl border ${styles.border} bg-white p-4 shadow-soft`}>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}>
          {label} · {platformName}
        </span>
        <p className="mt-3 text-sm text-slate-400">No user selected yet.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border ${styles.border} bg-white p-4 shadow-soft`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}>
          {label} · {platformName}
        </span>
        {sameIdAsCounterpart && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
            shared id
          </span>
        )}
      </div>

      <p className={`mt-3 flex items-center gap-2 text-xl font-bold tabular-nums ${styles.title}`}>
        <Fingerprint size={18} />
        {user.user_id}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
          <dt className="text-slate-400">Check-ins</dt>
          <dd className="font-semibold tabular-nums text-slate-700">{formatCount(user.trajectory_length)}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
          <dt className="text-slate-400">Source rows</dt>
          <dd className="font-semibold tabular-nums text-slate-700">{formatCount(user.source_rows)}</dd>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1.5">
          <MapPin size={12} className="text-slate-400" />
          <div>
            <dt className="text-slate-400">Max location id</dt>
            <dd className="font-semibold tabular-nums text-slate-700">{formatCount(user.max_loc_id)}</dd>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1.5">
          <Clock size={12} className="text-slate-400" />
          <div>
            <dt className="text-slate-400">Time-id range</dt>
            <dd className="font-semibold tabular-nums text-slate-700">
              {user.time_id_range[0]}–{user.time_id_range[1]}
            </dd>
          </div>
        </div>
      </dl>
    </div>
  );
}
