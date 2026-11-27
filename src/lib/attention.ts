import type { AttentionPayload, TokenLocation, TrajectoryStep } from "../types";

export type AttentionDirection = "a_to_b" | "b_to_a" | "both";

export interface AttentionLink {
  weight: number;
  aStep: number;
  bStep: number;
  aLoc: number | null;
  bLoc: number | null;
  aToken: number;
  bToken: number;
  aTimestamp: number | null;
  bTimestamp: number | null;
  aLon: number | null;
  aLat: number | null;
  bLon: number | null;
  bLat: number | null;
  /** Which half of the symmetric model produced this cell. */
  direction: "a_to_b" | "b_to_a";
}

/**
 * The strongest cells of the learned correlation attention.
 *
 * Each cell is one (A check-in, B check-in) pair, so the top cells are directly
 * comparable with the hand-built co-occurrence pairs. `direction="both"` keeps the
 * stronger of A -> B and B -> A, which matches the symmetric model.
 *
 * When the backend reduced a very large matrix, token numbers refer to the start
 * of a reduced block.
 */
export function topAttentionLinks(
  attention: AttentionPayload | null | undefined,
  tokensA: TokenLocation[] | undefined,
  tokensB: TokenLocation[] | undefined,
  fallbackA: TrajectoryStep[] | undefined,
  fallbackB: TrajectoryStep[] | undefined,
  limit = 6,
  distinct = false,
  direction: AttentionDirection = "a_to_b",
): AttentionLink[] {
  if (!attention) return [];

  const byStepA = new Map((tokensA ?? fallbackA ?? []).map((step) => [step.step, step]));
  const byStepB = new Map((tokensB ?? fallbackB ?? []).map((step) => [step.step, step]));
  const byPair = new Map<string, AttentionLink>();

  const add = (
    weight: number,
    aStep: number,
    bStep: number,
    aToken: number,
    bToken: number,
    source: "a_to_b" | "b_to_a",
  ) => {
    if (!Number.isFinite(weight)) return;
    const key = `${aStep}:${bStep}`;
    const previous = byPair.get(key);
    if (!previous || weight > previous.weight) {
      const a = byStepA.get(aStep);
      const b = byStepB.get(bStep);
      byPair.set(key, {
        weight,
        aStep,
        bStep,
        aLoc: a?.loc_id ?? null,
        bLoc: b?.loc_id ?? null,
        aToken,
        bToken,
        aTimestamp: a?.timestamp ?? null,
        bTimestamp: b?.timestamp ?? null,
        aLon: a?.lon ?? null,
        aLat: a?.lat ?? null,
        bLon: b?.lon ?? null,
        bLat: b?.lat ?? null,
        direction: source,
      });
    }
  };

  if (direction !== "b_to_a") {
    const matrix = attention.a_to_b;
    if (matrix?.values.length) {
      const stride = matrix.downsampled ? Math.max(1, matrix.stride || 1) : 1;
      matrix.values.forEach((row, rowIndex) => {
        row.forEach((value, columnIndex) => {
          add(
            value,
            rowIndex * stride + 1,
            columnIndex * stride + 1,
            rowIndex * stride,
            columnIndex * stride,
            "a_to_b",
          );
        });
      });
    }
  }

  if (direction !== "a_to_b") {
    const matrix = attention.b_to_a;
    if (matrix?.values.length) {
      const stride = matrix.downsampled ? Math.max(1, matrix.stride || 1) : 1;
      matrix.values.forEach((rowIndexB, rowIndex) => {
        rowIndexB.forEach((value, columnIndexA) => {
          add(
            value,
            columnIndexA * stride + 1,
            rowIndex * stride + 1,
            columnIndexA * stride,
            rowIndex * stride,
            "b_to_a",
          );
        });
      });
    }
  }

  const sorted = [...byPair.values()].sort((left, right) => right.weight - left.weight);
  if (!distinct || limit <= 0) return sorted.slice(0, Math.max(0, limit));

  // One strongest link per A check-in and per B check-in, so the M list is a set
  // of distinct points rather than several cells that all share the same token.
  const picked: AttentionLink[] = [];
  const seenA = new Set<number>();
  const seenB = new Set<number>();
  for (const link of sorted) {
    if (seenA.has(link.aStep) || seenB.has(link.bStep)) continue;
    picked.push(link);
    seenA.add(link.aStep);
    seenB.add(link.bStep);
    if (picked.length >= limit) break;
  }
  // Short trajectories can run out of distinct A/B pairs before reaching the
  // requested count (for example a 6-check-in Weibo trajectory asks for 5 M
  // points). Fill from the remaining top cells so M1..Mn always match the target.
  if (picked.length < limit) {
    const chosen = new Set(picked.map((link) => `${link.aStep}:${link.bStep}`));
    for (const link of sorted) {
      if (picked.length >= limit) break;
      const key = `${link.aStep}:${link.bStep}`;
      if (chosen.has(key)) continue;
      chosen.add(key);
      picked.push(link);
    }
  }
  return picked;
}
