import { AlertTriangle, ArrowLeftRight, Download, Info, LoaderCircle, Play, RotateCcw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AttentionHeatmap from "../components/AttentionHeatmap";
import CoOccurrenceTable from "../components/CoOccurrenceTable";
import GroundTruthPanel from "../components/GroundTruthPanel";
import MaskSequence from "../components/MaskSequence";
import EvidenceLab from "../components/EvidenceLab";
import MapWorkspace from "../components/MapWorkspace";
import MaskWhatIf from "../components/MaskWhatIf";
import MatchInspector from "../components/MatchInspector";
import MatchResultPanel from "../components/MatchResultPanel";
import PipelineStages from "../components/PipelineStages";
import UserPicker from "../components/UserPicker";
import UserSummaryCard from "../components/UserSummaryCard";
import { describeError, getHealth, getPairs, getSuggestedPairs, getUserDetail, matchPair } from "../api/client";
import { formatCount, formatMs, formatScore } from "../lib/format";
import type {
  CoOccurrencePair,
  ComboMetadata,
  HealthResponse,
  MatchResponse,
  SuggestedPairs,
  TrajectoryStep,
  UserDetail,
  UserSummary,
} from "../types";

type TabName = "trajectories" | "attention" | "masking" | "result";

const TABS: { key: TabName; label: string }[] = [
  { key: "trajectories", label: "Check-ins" },
  { key: "attention", label: "Attention" },
  { key: "masking", label: "Masking" },
  { key: "result", label: "Result" },
];

/**
 * How many check-ins of each trajectory the map previews, and how they are chosen.
 *
 * The co-occurrence view needs the two previews to overlap in time. The released
 * Twitter and Foursquare trajectories of one user are often active in different
 * periods, so sampling only the first rows of each side (the previous behaviour)
 * produced previews with no shared time slot at all -- and therefore no
 * co-occurrence circle to draw. Sampling evenly across the whole trajectory keeps
 * the preview representative, which is what makes the circles (and their
 * cross-map hover link) appear again.
 *
 * This is display only: the model input is never built from the preview.
 */
const PREVIEW_POINTS = 300;
const PREVIEW_STRATEGY = "spread" as const;

export default function MatchPage() {
  const [pairs, setPairs] = useState<ComboMetadata[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [platformA, setPlatformA] = useState("");
  const [platformB, setPlatformB] = useState("");
  const [seed, setSeed] = useState("");

  const [selectedA, setSelectedA] = useState<UserSummary | null>(null);
  const [selectedB, setSelectedB] = useState<UserSummary | null>(null);
  const [detailA, setDetailA] = useState<UserDetail | null>(null);
  const [detailB, setDetailB] = useState<UserDetail | null>(null);

  const [suggestions, setSuggestions] = useState<SuggestedPairs | null>(null);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [bootError, setBootError] = useState("");
  const [activeTab, setActiveTab] = useState<TabName>("trajectories");
  /** Hover highlight and click-to-pin are separate: hovering never moves the map. */
  const [highlightedPair, setHighlightedPair] = useState<number | null>(null);
  const [focusedPair, setFocusedPair] = useState<number | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorPair, setInspectorPair] = useState<number | null>(null);
  const [whatIfMask, setWhatIfMask] = useState<{ a: number[]; b: number[] } | null>(null);
  const [whatIfResult, setWhatIfResult] = useState<MatchResponse | null>(null);
  const [removedEvidence, setRemovedEvidence] = useState<{ a: number[]; b: number[] } | null>(null);
  const [evidenceResult, setEvidenceResult] = useState<MatchResponse | null>(null);
  const [attentionFocus, setAttentionFocus] = useState<{
    a: { token: number; lon: number | null; lat: number | null };
    b: { token: number; lon: number | null; lat: number | null };
  } | null>(null);
  /** Auto-load a real example once per pair/seed so the demo never opens empty. */
  const autoLoadedRef = useRef(false);
  const resultRef = useRef<HTMLDivElement | null>(null);
  /**
   * Which combo the currently selected users belong to, and which combo is on screen.
   *
   * On the render where the pair changes, ``combo`` is already the new one while
   * ``selectedA/B`` still hold the old ids for one commit. The detail effects below would
   * then request e.g. a Weibo user id from the Facebook index and surface a red
   * "does not exist on platform 'fb'" error. Tagging the selection with its combo and
   * checking it before fetching prevents that request entirely.
   */
  const selectionComboRef = useRef<string>("");
  const currentComboRef = useRef<string>("");

  /* ------------------------------------------------------------ bootstrap */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pairList, healthPayload] = await Promise.all([getPairs(), getHealth()]);
        if (cancelled) return;
        setPairs(pairList);
        setHealth(healthPayload);
        const firstReady = pairList.find((pair) => pair.available) ?? pairList[0];
        if (firstReady) {
          setPlatformA(firstReady.dense_platform);
          setPlatformB(firstReady.sparse_platform);
        }
      } catch (reason) {
        if (!cancelled) setBootError(describeError(reason));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Every configured model, listed directly: baseline and improved variants side by side. */
  const allCombos = useMemo(() => [...pairs], [pairs]);

  const [comboId, setComboId] = useState("");
  useEffect(() => {
    if (!allCombos.some((pair) => pair.id === comboId)) {
      setComboId(allCombos[0]?.id ?? "");
    }
  }, [allCombos, comboId]);

  const combo = useMemo(() => pairs.find((pair) => pair.id === comboId) ?? null, [pairs, comboId]);

  /** Seeds registered for the resolved pair, with their per-seed vocabularies. */
  const seedOptions = useMemo(() => combo?.seeds ?? [], [combo]);

  const activeSeedInfo = useMemo(
    () => seedOptions.find((item) => item.seed === seed) ?? seedOptions.find((item) => item.is_default) ?? null,
    [seedOptions, seed],
  );

  const denseOptions = useMemo(() => {
    const seen = new Map<string, string>();
    pairs.forEach((pair) => {
      const name = pair.platform_a;
      if (!seen.has(pair.dense_platform)) seen.set(pair.dense_platform, name);
    });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [pairs]);

  // Keep platform A/B in sync with whichever model is selected (used by the summaries).
  useEffect(() => {
    if (!combo) return;
    if (combo.dense_platform !== platformA) setPlatformA(combo.dense_platform);
    if (combo.sparse_platform !== platformB) setPlatformB(combo.sparse_platform);
  }, [combo, platformA, platformB]);

  const selectUser = useCallback(
    (side: "a" | "b", user: UserSummary) => {
      selectionComboRef.current = combo?.id ?? "";
      if (side === "a") setSelectedA(user);
      else setSelectedB(user);
    },
    [combo?.id],
  );

  /* ------------------------------------------------- reset on pair change */
  useEffect(() => {
    // Drop the selection's combo tag *before* the detail effects run in this commit.
    selectionComboRef.current = "";
    currentComboRef.current = combo?.id ?? "";
    autoLoadedRef.current = false;
    setSelectedA(null);
    setSelectedB(null);
    setDetailA(null);
    setDetailB(null);
    setResult(null);
    setError("");
    setInspectorOpen(false);
    setInspectorPair(null);
    setWhatIfMask(null);
    setWhatIfResult(null);
    setRemovedEvidence(null);
    setEvidenceResult(null);
    setAttentionFocus(null);
    setActiveTab("trajectories");
    setSeed(combo?.seed ?? "");
  }, [combo?.id]);

  // Reload the quick picks whenever the pair or the seed changes, because the
  // location vocabulary of the seed decides which users are selectable.
  useEffect(() => {
    if (!combo) {
      setSuggestions(null);
      return;
    }
    let cancelled = false;
    getSuggestedPairs(combo.id, 4, seed || undefined)
      .then((payload) => {
        if (!cancelled) setSuggestions(payload);
      })
      .catch(() => {
        if (!cancelled) setSuggestions(null);
      });
    return () => {
      cancelled = true;
    };
  }, [combo?.id, seed]);

  // Selecting a different seed invalidates the current pair and any result.
  useEffect(() => {
    selectionComboRef.current = "";
    autoLoadedRef.current = false;
    setSelectedA(null);
    setSelectedB(null);
    setDetailA(null);
    setDetailB(null);
    setResult(null);
    setInspectorOpen(false);
    setInspectorPair(null);
    setWhatIfMask(null);
    setWhatIfResult(null);
    setRemovedEvidence(null);
    setEvidenceResult(null);
    setAttentionFocus(null);
    setActiveTab("trajectories");
  }, [seed]);

  // A new pair means a new map: clear hover/pin so a stale C-point cannot focus.
  useEffect(() => {
    setHighlightedPair(null);
    setFocusedPair(null);
  }, [detailA?.user_id, detailB?.user_id]);

  /* ------------------------------------------------------- user details */
  const loadDetail = useCallback(
    async (side: "a" | "b", user: UserSummary | null) => {
      if (!combo || !user) return null;
      const requestComboId = combo.id;
      try {
        return await getUserDetail({
          comboId: combo.id,
          side,
          userId: user.user_id,
          preview: PREVIEW_POINTS,
          // Spread the sample across the whole trajectory. Taking the first N rows of
          // each side can leave the two previews with no time slot in common (the two
          // platforms are often active in different periods), which made the
          // co-occurrence circles disappear. Display only: the model input is
          // untouched and still uses the complete trajectory.
          previewStrategy: PREVIEW_STRATEGY,
          seed: seed || undefined,
        });
      } catch (reason) {
        // A pair switch while the request was in flight: the failure belongs to the
        // combo that is no longer on screen, so it must not paint a red banner.
        if (requestComboId !== currentComboRef.current) return null;
        setError(describeError(reason));
        return null;
      }
    },
    [combo, seed],
  );

  useEffect(() => {
    let cancelled = false;
    if (!combo || !selectedA || selectionComboRef.current !== combo.id) {
      setDetailA(null);
      return;
    }
    void loadDetail("a", selectedA).then((detail) => {
      if (!cancelled) setDetailA(detail);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedA, loadDetail]);

  useEffect(() => {
    let cancelled = false;
    if (!combo || !selectedB || selectionComboRef.current !== combo.id) {
      setDetailB(null);
      return;
    }
    void loadDetail("b", selectedB).then((detail) => {
      if (!cancelled) setDetailB(detail);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedB, loadDetail]);

  /* -------------------------------------------------------------- actions */
  const runMatch = useCallback(async () => {
    if (!combo || !selectedA || !selectedB || running) return;
    setRunning(true);
    setError("");
    try {
      const payload = await matchPair({
        comboId: combo.id,
        userA: selectedA.user_id,
        userB: selectedB.user_id,
        seed: seed || undefined,
      });
      setResult(payload);
      setActiveTab("result");
      // Scroll to the tab card itself. The card carries `scroll-mt-20`, so its top --
      // and therefore the tab bar -- stays below the sticky navbar instead of under it.
      window.setTimeout(
        () => document.getElementById("match-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        60,
      );
    } catch (reason) {
      setResult(null);
      setError(describeError(reason));
    } finally {
      setRunning(false);
    }
  }, [combo, selectedA, selectedB, seed, running]);

  const applySuggestion = useCallback(
    async (pair: { user_a: number; user_b: number }) => {
      if (!combo) return;
      const requestComboId = combo.id;
      autoLoadedRef.current = true;
      setError("");
      setResult(null);
      try {
        const [a, b] = await Promise.all([
          getUserDetail({
            comboId: combo.id,
            side: "a",
            userId: pair.user_a,
            preview: PREVIEW_POINTS,
            previewStrategy: PREVIEW_STRATEGY,
            seed: seed || undefined,
          }),
          getUserDetail({
            comboId: combo.id,
            side: "b",
            userId: pair.user_b,
            preview: PREVIEW_POINTS,
            previewStrategy: PREVIEW_STRATEGY,
            seed: seed || undefined,
          }),
        ]);
        if (requestComboId !== currentComboRef.current) return;
        selectionComboRef.current = combo.id;
        setSelectedA(a);
        setSelectedB(b);
      } catch (reason) {
        if (requestComboId !== currentComboRef.current) return;
        setError(describeError(reason));
      }
    },
    [combo, seed],
  );

  const clearSelection = useCallback(() => {
    selectionComboRef.current = "";
    autoLoadedRef.current = true;
    setHighlightedPair(null);
    setFocusedPair(null);
    setSelectedA(null);
    setSelectedB(null);
    setDetailA(null);
    setDetailB(null);
    setResult(null);
    setError("");
    setInspectorOpen(false);
    setInspectorPair(null);
    setWhatIfMask(null);
    setWhatIfResult(null);
    setRemovedEvidence(null);
    setEvidenceResult(null);
    setAttentionFocus(null);
    setActiveTab("trajectories");
  }, []);

  const openInspector = useCallback((index: number | null) => {
    setInspectorPair(index);
    setInspectorOpen(true);
  }, []);

  const focusAttentionTokens = useCallback(
    (aIndex: number, bIndex: number) => {
      const tokenA = result?.tokens?.a?.[aIndex];
      const tokenB = result?.tokens?.b?.[bIndex];
      setAttentionFocus({
        a: { token: aIndex, lon: tokenA?.lon ?? null, lat: tokenA?.lat ?? null },
        b: { token: bIndex, lon: tokenB?.lon ?? null, lat: tokenB?.lat ?? null },
      });
      window.setTimeout(
        () => document.getElementById("trajectory-map")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        60,
      );
    },
    [result],
  );

  /**
   * First-screen value: as soon as a pair's quick picks arrive, open a real
   * ground-truth example instead of leaving two empty pickers. This runs at most
   * once per pair/seed, and an explicit "Clear selection" opts out for the rest of
   * that context.
   */
  useEffect(() => {
    if (!combo || !suggestions || autoLoadedRef.current) return;
    if (selectedA || selectedB || result) return;
    if (suggestions.combo_id !== combo.id) return;
    if (suggestions.seed && seed && suggestions.seed !== seed) return;
    const example =
      suggestions.matched_examples[0] ??
      suggestions.unmatched_examples[0] ??
      suggestions.random_examples[0];
    if (!example) return;
    autoLoadedRef.current = true;
    void applySuggestion(example);
  }, [combo, suggestions, seed, selectedA, selectedB, result, applySuggestion]);

  /**
   * Spatio-temporal co-occurrence points: a check-in of A and a check-in of B that fall
   * in the same time bucket and within 2 km of each other. This is the paper's
   * definition, and it is computed here so that both maps can label the same pair with
   * the same `C{n}` number and the table can list them.
   */
  const { coPairs, timeUnitLabel } = useMemo(() => {
    if (!detailA || !detailB || !detailA.preview.length || !detailB.preview.length) {
      return { coPairs: [] as CoOccurrencePair[], timeUnitLabel: "time slot" };
    }
    const maxSlot = Math.max(
      ...detailA.preview.map((step) => step.timestamp),
      ...detailB.preview.map((step) => step.timestamp),
    );
    // Unix seconds for the XSiteTraj platforms, hour slots for ISP/Weibo.
    const looksLikeSeconds = maxSlot > 1e8;
    const tolerance = looksLikeSeconds ? 3600 : 0;
    const unit = looksLikeSeconds ? "hour" : "hour slot";

    const metres = (lon1: number, lat1: number, lon2: number, lat2: number) => {
      const meanLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
      const dx = (lon2 - lon1) * 111.32 * Math.cos(meanLat);
      const dy = (lat2 - lat1) * 110.57;
      return Math.sqrt(dx * dx + dy * dy) * 1000;
    };

    const found: CoOccurrencePair[] = [];
    for (const a of detailA.preview) {
      for (const b of detailB.preview) {
        if (Math.abs(a.timestamp - b.timestamp) > tolerance) continue;
        if (a.lon === null || a.lat === null || b.lon === null || b.lat === null) continue;
        const distanceM = metres(a.lon, a.lat, b.lon, b.lat);
        if (distanceM > 2000) continue;
        found.push({
          index: found.length,
          slot: a.timestamp,
          distanceM,
          a: { step: a.step, locId: a.loc_id, slot: a.timestamp, lon: a.lon, lat: a.lat },
          b: { step: b.step, locId: b.loc_id, slot: b.timestamp, lon: b.lon, lat: b.lat },
        });
      }
    }
    found.sort((left, right) => left.slot - right.slot || left.distanceM - right.distanceM);
    found.forEach((pair, index) => {
      pair.index = index;
    });
    return { coPairs: found, timeUnitLabel: unit };
  }, [detailA, detailB]);

  const displayResult = whatIfResult ?? result;

  const exportCase = () => {
    const payload = {
      schema: "mtlink-demo-case/v1",
      exported_at: new Date().toISOString(),
      combo: combo
        ? { id: combo.id, label: combo.label, seed }
        : null,
      users: {
        a: detailA
          ? { platform: detailA.platform, user_id: detailA.user_id, trajectory_length: detailA.trajectory_length }
          : null,
        b: detailB
          ? { platform: detailB.platform, user_id: detailB.user_id, trajectory_length: detailB.trajectory_length }
          : null,
      },
      baseline: result
        ? {
            score: result.prediction.score,
            is_match: result.prediction.is_match,
            threshold: result.prediction.decision_threshold,
            seed: result.model.seed,
          }
        : null,
      intervention: {
        mask_ratio: whatIfResult?.mask.mask_ratio_setting ?? null,
        removed_token_counts: removedEvidence
          ? { a: removedEvidence.a.length, b: removedEvidence.b.length }
          : null,
        evidence_removal_after: evidenceResult
          ? {
              score: evidenceResult.prediction.score,
              mask_count_a: evidenceResult.mask.a_count,
              mask_count_b: evidenceResult.mask.b_count,
            }
          : null,
      },
      cooccurrence_summary: {
        count: coPairs.length,
        selected: focusedPair !== null ? coPairs[focusedPair] ?? null : null,
      },
      mask_summary: displayResult
        ? {
            ratio: displayResult.mask.mask_ratio_setting,
            a_count: displayResult.mask.a_count,
            b_count: displayResult.mask.b_count,
          }
        : null,
      provenance: {
        dataset: "released MT-Link trajectories",
        ground_truth_used_by_model: false,
        score_semantics: result?.prediction.score_semantics ?? null,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MT-Link_${combo?.id ?? "case"}_${detailA?.user_id ?? "a"}_${detailB?.user_id ?? "b"}_seed${seed || "default"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const canRun = Boolean(combo?.available && selectedA && selectedB && !running);
  const readyPairs = pairs.filter((pair) => pair.available).length;

  /* ---------------------------------------------------------------- render */
  if (bootError) {
    return (
      <main className="mx-auto max-w-[900px] px-6 pb-20 pt-12">
        <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-6">
          <h1 className="text-lg font-bold text-rose-700">The backend is not reachable</h1>
          <p className="mt-2 text-sm leading-6 text-rose-900">{bootError}</p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-white/80 p-4 text-xs text-slate-700">
{`cd /Users/xiaokang/时空数据挖掘/2025AAAI-Mt-Link-main
./.venv310/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend_v2`}
          </pre>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1500px] px-5 pb-8 pt-8 xl:pb-2">
      <section className="pt-4">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-600">Live Matching</p>
        <h1 className="mt-2 text-3xl font-bold text-[#0F3B82]">Match any two real users</h1>
      </section>

      {health && readyPairs < pairs.length && (
        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50/70 px-5 py-4 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {readyPairs} of {pairs.length} platform pairs are available on device {health.device}.
            Unavailable pairs are reported with their exact reason instead of a placeholder score.
          </span>
        </div>
      )}

      <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* ------------------------------------------------------ left rail */}
        <div className="flex flex-col gap-4">
          <section className="h-fit rounded-2xl border border-blue-100 bg-white p-5 shadow-soft">
            <h2 className="text-base font-bold text-blue-900">Platform pair</h2>

            <label className="mt-4 block text-xs font-semibold text-slate-500" htmlFor="combo">
              Platform pair
            </label>
            <select
              id="combo"
              value={comboId}
              onChange={(event) => setComboId(event.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-blue-100 bg-blue-50/50 px-3 text-sm text-slate-700 outline-none"
            >
              {allCombos.map((pair) => (
                <option key={pair.id} value={pair.id} disabled={!pair.available}>
                  {pair.label}
                  {pair.available ? "" : " — unavailable"}
                </option>
              ))}
            </select>

            {seedOptions.length > 1 && (
              <>
                <label className="mt-3 block text-xs font-semibold text-slate-500" htmlFor="seed">
                  Checkpoint seed
                </label>
                <select
                  id="seed"
                  value={seed}
                  onChange={(event) => setSeed(event.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-blue-100 bg-emerald-50/40 px-3 text-sm text-slate-700 outline-none"
                >
                  {seedOptions.map((option) => (
                    <option key={option.seed} value={option.seed} disabled={!option.available}>
                      seed {option.seed}
                      {option.is_default ? " (default)" : ""}
                      {option.available ? "" : " — unavailable"}
                    </option>
                  ))}
                </select>
              </>
            )}

            {combo ? (
              <div className="mt-4 space-y-1 rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-3 text-[11px] leading-4 text-slate-600">
                <p className="text-sm font-bold text-blue-900">{combo.label}</p>
                {activeSeedInfo && !activeSeedInfo.loaded && activeSeedInfo.is_default === false && (
                  <p className="text-slate-400">
                    This seed&apos;s weights are loaded on the first request and then kept resident.
                  </p>
                )}
                {combo.usable_seeds && combo.usable_seeds.length < combo.available_seeds.length && (
                  <p className="text-amber-700">
                    {combo.available_seeds.length - combo.usable_seeds.length} registered seed(s) could
                    not be loaded and are disabled in the list above.
                  </p>
                )}
                {!combo.available && (
                  <p className="mt-1 rounded-lg bg-rose-50 px-2 py-1 text-rose-700">{combo.error}</p>
                )}
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-[11px] text-slate-500">
                No trained model links these two platforms. Choose another combination.
              </p>
            )}

            <button
              type="button"
              onClick={() => void runMatch()}
              disabled={!canRun}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? <LoaderCircle size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
              {running ? "Running forward pass…" : "Start matching"}
            </button>

            {(selectedA || selectedB) && (
              <button
                type="button"
                onClick={clearSelection}
                className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-blue-50 text-sm font-semibold text-blue-600 hover:bg-blue-100"
              >
                <RotateCcw size={14} /> Clear selection
              </button>
            )}

            {error && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-600">{error}</p>
            )}

            {displayResult && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700">
                {whatIfResult ? "Mask override" : "Last run"}: score {formatScore(displayResult.prediction.score)} · seed{" "}
                {displayResult.model.seed} · forward pass {formatMs(displayResult.timing_ms.model_forward)}
                {displayResult.timing_ms.model_load && displayResult.timing_ms.model_load > 1
                  ? ` (+${formatMs(displayResult.timing_ms.model_load)} one-time weight load)`
                  : ""}{" "}
                · total {formatMs(displayResult.timing_ms.total)}
              </p>
            )}
          </section>

          <div className="space-y-3">
            <UserPicker
              comboId={combo?.id ?? ""}
              side="a"
              platformName={combo?.platform_a ?? denseOptions.find(([key]) => key === platformA)?.[1] ?? "Platform A"}
              accent="blue"
              selected={selectedA}
              counterpartUserId={selectedB?.user_id ?? null}
              seed={seed || undefined}
              disabled={!combo?.available}
              onSelect={(user) => selectUser("a", user)}
            />
            <UserPicker
              comboId={combo?.id ?? ""}
              side="b"
              platformName={combo?.platform_b ?? "Platform B"}
              accent="violet"
              selected={selectedB}
              counterpartUserId={selectedA?.user_id ?? null}
              seed={seed || undefined}
              disabled={!combo?.available}
              onSelect={(user) => selectUser("b", user)}
            />
          </div>

          {suggestions && (
            <section className="flex-1 rounded-2xl border border-blue-100 bg-white p-5 shadow-soft">
              <header className="flex items-center gap-2">
                <Sparkles size={15} className="text-blue-600" />
                <h3 className="text-sm font-bold text-blue-900">Quick picks</h3>
              </header>
              <div className="mt-3 space-y-2">
                {[
                  { label: "Ground-truth match", list: suggestions.matched_examples },
                  { label: "Different ids", list: suggestions.unmatched_examples },
                ].map((group) => (
                  <div key={group.label}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {group.label}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {group.list.slice(0, 4).map((pair) => (
                        <button
                          key={`${group.label}-${pair.user_a}-${pair.user_b}`}
                          type="button"
                          onClick={() => void applySuggestion(pair)}
                          className={`rounded-lg border px-2 py-1 text-[11px] tabular-nums transition ${
                            selectedA?.user_id === pair.user_a && selectedB?.user_id === pair.user_b
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100"
                          }`}
                        >
                          {pair.user_a} ↔ {pair.user_b}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <PipelineStages pipeline={displayResult?.pipeline ?? null} running={running} />

        </div>

        {/* --------------------------------------------------- main column */}
        <div className="min-w-0">
          {detailA && detailB ? (
            <MapWorkspace
              detailA={detailA}
              detailB={detailB}
              coPairs={coPairs}
              highlightedPair={highlightedPair}
              focusedPair={focusedPair}
              onHighlight={setHighlightedPair}
              onSelectPair={(index) => {
                setFocusedPair(index);
                setHighlightedPair(index);
              }}
              onExplain={openInspector}
              maskedStepsA={whatIfMask?.a}
              maskedStepsB={whatIfMask?.b}
              removedStepsA={removedEvidence?.a}
              removedStepsB={removedEvidence?.b}
              focusTokens={attentionFocus}
            />
          ) : (
            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-soft">
              <h3 className="text-sm font-bold text-blue-900">Trajectory map</h3>
              <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-6 text-center text-sm text-slate-500">
                Select a user on each side, or pick a real example from Quick picks, to open the map.
              </p>
            </section>
          )}

          <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <UserSummaryCard
              label="Platform A"
              platformName={combo?.platform_a ?? "—"}
              accent="blue"
              user={selectedA}
              sameIdAsCounterpart={Boolean(selectedA && selectedB && selectedA.user_id === selectedB.user_id)}
            />
            <UserSummaryCard
              label="Platform B"
              platformName={combo?.platform_b ?? "—"}
              accent="violet"
              user={selectedB}
              sameIdAsCounterpart={Boolean(selectedA && selectedB && selectedA.user_id === selectedB.user_id)}
            />
          </div>

          <div className="space-y-4">
              {detailA && detailB && (
                <MaskWhatIf
                  comboId={combo?.id ?? null}
                  userA={detailA.user_id}
                  userB={detailB.user_id}
                  seed={seed}
                  baseline={result}
                  onMaskChange={setWhatIfMask}
                  onResultChange={setWhatIfResult}
                />
              )}

              {detailA && detailB && (
                <EvidenceLab
                  comboId={combo?.id ?? null}
                  seed={seed}
                  seeds={(combo?.seeds ?? []).filter((item) => item.available).map((item) => item.seed)}
                  detailA={detailA}
                  detailB={detailB}
                  coPairs={coPairs}
                  selectedPair={focusedPair}
                  baseline={result}
                  onRemoveChange={setRemovedEvidence}
                  onResultChange={setEvidenceResult}
                />
              )}
          </div>

          </div>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <section
            id="match-panel"
            className="scroll-mt-20 rounded-2xl border border-blue-100 bg-white p-5 shadow-soft"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2 overflow-x-auto">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      activeTab === tab.key ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-blue-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                {displayResult && (
                  <button
                    type="button"
                    onClick={exportCase}
                    className="ml-1 flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                  >
                    <Download size={13} /> Export JSON
                  </button>
                )}
              </div>
              {displayResult && (
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  <ArrowLeftRight size={13} />
                  {displayResult.platform_a.name} {displayResult.platform_a.user.user_id} ↔{" "}
                  {displayResult.platform_b.name} {displayResult.platform_b.user.user_id}
                </span>
              )}
            </div>

            {whatIfResult && result && (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-2 text-[11px] leading-5 text-violet-800">
                <span className="rounded-full bg-white px-2 py-0.5 font-bold text-violet-700">
                  mask {Math.round(whatIfResult.mask.mask_ratio_setting * 100)}%
                </span>
                <span>
                  Score, mask counts and masking sequences below come from this live pass; checkpoint
                  baseline is {Math.round(result.mask.mask_ratio_setting * 100)}%. Attention still uses
                  the baseline pass.
                </span>
              </div>
            )}

            <div ref={resultRef} className="mt-5 min-h-[420px] scroll-mt-20">
              {activeTab === "trajectories" && (
                <div className="fade-in space-y-4">
                  {!selectedA && !selectedB && (
                    <p className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-6 text-center text-sm text-slate-500">
                      Select a user on each side to preview their check-in sequences.
                    </p>
                  )}
                  {(detailA || detailB) && (
                    <div className="grid gap-5 xl:grid-cols-2">
                      {detailA && <StepTable title={`${detailA.platform.toUpperCase()} check-ins`} steps={detailA.preview} />}
                      {detailB && <StepTable title={`${detailB.platform.toUpperCase()} check-ins`} steps={detailB.preview} />}
                    </div>
                  )}
                  {detailA && detailB && (
                    <CoOccurrenceTable
                      pairs={coPairs}
                      platformAName={detailA.platform.toUpperCase()}
                      platformBName={detailB.platform.toUpperCase()}
                      timeUnitLabel={timeUnitLabel}
                      highlightedPair={highlightedPair}
                      focusedPair={focusedPair}
                      onHighlight={setHighlightedPair}
                      onExplain={openInspector}
                      onSelect={(index) => {
                        setFocusedPair(index);
                        setHighlightedPair(index);
                        // The table sits below the map; bring the focused pair into view.
                        window.setTimeout(
                          () =>
                            document
                              .getElementById("trajectory-map")
                              ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                          80,
                        );
                      }}
                    />
                  )}
                </div>
              )}

              {activeTab === "attention" &&
                (result?.attention ? (
                  <AttentionHeatmap
                    attention={result.attention}
                    platformAName={result.platform_a.name}
                    platformBName={result.platform_b.name}
                    onFocusTokens={focusAttentionTokens}
                  />
                ) : (
                  <EmptyState message="Attention is captured during a real forward pass. Select two users and start matching." />
                ))}

              {activeTab === "masking" &&
                (displayResult ? (
                  <div className="fade-in space-y-4">
                    <div className="grid gap-5 xl:grid-cols-2">
                      <MaskSequence
                        title="Platform A masking"
                        platformName={displayResult.platform_a.name}
                        userId={displayResult.platform_a.user.user_id}
                        tokens={detailA?.preview.map((step) => step.loc_id) ?? []}
                        mask={displayResult.mask.a}
                        maskCount={displayResult.mask.a_count}
                        maskRatio={displayResult.mask.a_ratio}
                        maskRatioSetting={displayResult.mask.mask_ratio_setting}
                        color="blue"
                      />
                      <MaskSequence
                        title="Platform B masking"
                        platformName={displayResult.platform_b.name}
                        userId={displayResult.platform_b.user.user_id}
                        tokens={detailB?.preview.map((step) => step.loc_id) ?? []}
                        mask={displayResult.mask.b}
                        maskCount={displayResult.mask.b_count}
                        maskRatio={displayResult.mask.b_ratio}
                        maskRatioSetting={displayResult.mask.mask_ratio_setting}
                        color="violet"
                      />
                    </div>
                  </div>
                ) : (
                  <EmptyState message="Masking indices are produced by the attention-guided mask strategy during inference." />
                ))}

              {activeTab === "result" &&
                (displayResult ? (
                  <div className="fade-in space-y-5">
                    <MatchResultPanel result={displayResult} />
                    <GroundTruthPanel result={displayResult} />
                  </div>
                ) : (
                  <EmptyState message="Run a match to see the model output, the decision, the dataset-level context and the measured timings." />
                ))}
            </div>
          </section>

        </div>

      </div>

      <MatchInspector
        open={inspectorOpen}
        pairIndex={inspectorPair}
        detailA={detailA}
        detailB={detailB}
        coPairs={coPairs}
        result={result}
        onClose={() => setInspectorOpen(false)}
        onPin={(index) => {
          setFocusedPair(index);
          setHighlightedPair(index);
        }}
      />
    </main>
  );
}

function StepTable({ title, steps }: { title: string; steps: TrajectoryStep[] }) {
  return (
    <section className="min-w-0 max-w-full rounded-2xl border border-blue-100 bg-white p-4 shadow-soft">
      <h3 className="text-sm font-bold text-blue-900">{title}</h3>
      <div className="scroll-thin mt-3 max-h-[220px] overflow-x-auto overflow-y-auto rounded-xl border border-blue-100">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="sticky top-0 bg-blue-50 text-blue-900">
            <tr>
              <th className="px-3 py-2 font-semibold">Step</th>
              <th className="px-3 py-2 font-semibold">Location id</th>
              <th className="px-3 py-2 font-semibold">Time id</th>
              <th className="px-3 py-2 font-semibold">Timestamp</th>
              <th className="px-3 py-2 font-semibold">Longitude</th>
              <th className="px-3 py-2 font-semibold">Latitude</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-50">
            {steps.map((step) => (
              <tr key={step.step}>
                <td className="px-3 py-1.5 tabular-nums text-slate-500">{step.step}</td>
                <td className="px-3 py-1.5 tabular-nums text-slate-600">{step.loc_id}</td>
                <td className="px-3 py-1.5 tabular-nums text-slate-600">{step.time_id}</td>
                <td className="px-3 py-1.5 tabular-nums text-slate-500">{step.timestamp}</td>
                <td className="px-3 py-1.5 tabular-nums text-slate-500">
                  {step.lon === null ? "--" : step.lon.toFixed(5)}
                </td>
                <td className="px-3 py-1.5 tabular-nums text-slate-500">
                  {step.lat === null ? "--" : step.lat.toFixed(5)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="grid min-h-[300px] place-items-center rounded-xl border border-blue-100 bg-blue-50/50 px-6 text-center text-sm text-slate-500">
      {message}
    </p>
  );
}
