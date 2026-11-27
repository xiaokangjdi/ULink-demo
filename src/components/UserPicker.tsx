import { LoaderCircle, Search, UserRound, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { describeError, getUsers } from "../api/client";
import { formatCount } from "../lib/format";
import type { UserSummary } from "../types";

interface UserPickerProps {
  comboId: string;
  side: "a" | "b";
  platformName: string;
  accent: "blue" | "violet";
  selected: UserSummary | null;
  /** Id selected on the other side, highlighted as the dataset-level match candidate. */
  counterpartUserId?: number | null;
  /** Checkpoint seed whose location vocabulary decides which users can be scored. */
  seed?: string;
  disabled?: boolean;
  onSelect: (user: UserSummary) => void;
}

const ACCENT = {
  blue: {
    chip: "bg-blue-50 text-blue-700",
    ring: "ring-blue-200",
    button: "bg-blue-600 hover:bg-blue-700",
    highlight: "border-blue-300 bg-blue-50/80",
    text: "text-blue-600",
  },
  violet: {
    chip: "bg-violet-50 text-violet-700",
    ring: "ring-violet-200",
    button: "bg-violet-600 hover:bg-violet-700",
    highlight: "border-violet-300 bg-violet-50/80",
    text: "text-violet-600",
  },
} as const;

export default function UserPicker({
  comboId,
  side,
  platformName,
  accent,
  selected,
  counterpartUserId,
  seed,
  disabled,
  onSelect,
}: UserPickerProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [scope, setScope] = useState<"test" | "all">("all");
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<"user_id" | "length_desc">("user_id");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pageSize = 40;
  const requestId = useRef(0);
  const styles = ACCENT[accent];

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (nextOffset: number, append: boolean) => {
      if (!comboId || disabled) return;
      const id = ++requestId.current;
      setLoading(true);
      setError("");
      try {
        const page = await getUsers({
          comboId,
          side,
          query: debounced,
          limit: pageSize,
          offset: nextOffset,
          sort,
          seed,
        });
        if (id !== requestId.current) return;
        setUsers((previous) => (append ? [...previous, ...page.users] : page.users));
        setTotal(page.total);
        setScope(page.scope ?? "all");
        setOffset(nextOffset + page.users.length);
      } catch (reason) {
        if (id !== requestId.current) return;
        setError(describeError(reason));
        if (!append) setUsers([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [comboId, debounced, disabled, side, sort, seed],
  );

  // Reset and reload whenever the pair, side, query, sort or seed changes.
  useEffect(() => {
    setUsers([]);
    setOffset(0);
    setTotal(0);
    if (!disabled) void load(0, false);
  }, [comboId, side, debounced, sort, seed, disabled, load]);

  if (disabled) {
    return (
      <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
        <header className="flex items-center gap-2">
          <UserRound size={17} className="text-slate-400" />
          <h3 className="text-base font-bold text-slate-500">{platformName} users</h3>
        </header>
        <p className="mt-3 text-sm text-slate-500">Select another platform on the left to pick a user here.</p>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-blue-100 bg-white p-5 shadow-soft">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${styles.chip}`}>
            {side.toUpperCase()}
          </span>
          <h3 className="text-base font-bold text-blue-900">{platformName} users</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
              scope === "test"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {scope === "test" ? "test split" : "all users"}
          </span>
          <span className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-500">
            {formatCount(total)} selectable
          </span>
        </div>
      </header>

      <div className="mt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by user id…"
            className="h-10 w-full rounded-xl border border-blue-100 bg-blue-50/40 pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300"
          />
        </div>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as "user_id" | "length_desc")}
          className="h-10 rounded-xl border border-blue-100 bg-blue-50/40 px-2 text-xs text-slate-600 outline-none"
          title="Sort the user list"
        >
          <option value="user_id">By id</option>
          <option value="length_desc">Longest first</option>
        </select>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-600">{error}</p>
      )}

      <div className="scroll-thin mt-3 max-h-[150px] min-h-[120px] overflow-y-auto rounded-xl border border-blue-100">
        {users.length === 0 && !loading && (
          <p className="px-3 py-6 text-center text-xs text-slate-400">
            {debounced ? `No user id contains “${debounced}”.` : "No users available."}
          </p>
        )}
        <ul className="divide-y divide-blue-50">
          {users.map((user) => {
            const isSelected = selected?.user_id === user.user_id;
            const matchesCounterpart =
              counterpartUserId !== null &&
              counterpartUserId !== undefined &&
              user.user_id === counterpartUserId;
            return (
              <li key={user.user_id}>
                <button
                  type="button"
                  onClick={() => onSelect(user)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                    isSelected ? `border-l-2 ${styles.highlight}` : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Users size={14} className="shrink-0 text-slate-400" />
                    <span className="truncate tabular-nums font-medium text-slate-700">{user.user_id}</span>
                    {matchesCounterpart && (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                        id match
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-400">
                    {formatCount(user.trajectory_length)} check-ins
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {loading && (
          <p className="flex items-center justify-center gap-2 px-3 py-3 text-xs text-slate-400">
            <LoaderCircle size={14} className="animate-spin" /> loading…
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">
          showing {users.length} of {formatCount(total)}
        </span>
        {users.length < total && (
          <button
            type="button"
            onClick={() => void load(offset, true)}
            disabled={loading}
            className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 disabled:opacity-60"
          >
            Load more
          </button>
        )}
      </div>
    </section>
  );
}
