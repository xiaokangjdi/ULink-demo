/**
 * HTTP client for the v2 backend.
 *
 * `baseURL: "/api"` is served by the Vite dev proxy (see vite.config.ts), which
 * forwards to the FastAPI service on 127.0.0.1:8000.
 *
 * FastAPI reports errors as `{"detail": "..."}`, so `describeError` unwraps that
 * into something readable. The messages come from the backend and are always
 * specific (which platform, which user, which file), which is what the UI shows.
 */
import axios, { AxiosError } from "axios";

import type {
  ComboMetadata,
  ConfigResponse,
  ExperimentPayload,
  HealthResponse,
  MaskSweepHarness,
  MaskSweepResult,
  MaskSweepStatus,
  MatchResponse,
  PlatformInfo,
  SuggestedPairs,
  UserDetail,
  UserPage,
} from "../types";

const api = axios.create({
  baseURL: "/api",
  timeout: 120000,
});

export function describeError(reason: unknown): string {
  if (axios.isAxiosError(reason)) {
    const error = reason as AxiosError<{ detail?: unknown }>;
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (detail) return JSON.stringify(detail);
    if (error.code === "ECONNABORTED") return "The request timed out.";
    if (!error.response) {
      return "Cannot reach the backend. Start it with: uvicorn app.main:app --app-dir backend_v2 --port 8000";
    }
    return `${error.response.status} ${error.response.statusText}`;
  }
  if (reason instanceof Error) return reason.message;
  return String(reason);
}

export async function getHealth(): Promise<HealthResponse> {
  return (await api.get<HealthResponse>("/health")).data;
}

export async function getConfig(): Promise<ConfigResponse> {
  return (await api.get<ConfigResponse>("/config")).data;
}

export async function getPlatforms(): Promise<PlatformInfo[]> {
  return (await api.get<PlatformInfo[]>("/platforms")).data;
}

export async function getPairs(): Promise<ComboMetadata[]> {
  return (await api.get<ComboMetadata[]>("/pairs")).data;
}

export async function getPair(comboId: string): Promise<ComboMetadata> {
  return (await api.get<ComboMetadata>(`/pairs/${comboId}`)).data;
}

export async function getUsers(params: {
  comboId: string;
  side: "a" | "b";
  query?: string;
  limit?: number;
  offset?: number;
  onlyUsable?: boolean;
  sort?: "user_id" | "length" | "length_desc" | "max_loc_desc";
  seed?: string;
}): Promise<UserPage> {
  return (
    await api.get<UserPage>(`/pairs/${params.comboId}/users`, {
      params: {
        side: params.side,
        q: params.query ?? "",
        limit: params.limit ?? 40,
        offset: params.offset ?? 0,
        only_usable: params.onlyUsable ?? true,
        sort: params.sort ?? "user_id",
        seed: params.seed,
      },
    })
  ).data;
}

export async function getUserDetail(params: {
  comboId: string;
  side: "a" | "b";
  userId: number;
  preview?: number;
  /**
   * How the preview slice is sampled. "spread" takes points evenly across the whole
   * trajectory (used by the co-occurrence view so the two platforms' previews can
   * overlap in time); "head" is the original behaviour and stays the server default.
   * Display only -- the model always sees the full trajectory.
   */
  previewStrategy?: "head" | "spread";
  seed?: string;
}): Promise<UserDetail> {
  return (
    await api.get<UserDetail>(`/pairs/${params.comboId}/users/${params.side}/${params.userId}`, {
      params: {
        preview: params.preview ?? 24,
        seed: params.seed,
        preview_strategy: params.previewStrategy ?? "head",
      },
    })
  ).data;
}

export async function getSuggestedPairs(
  comboId: string,
  limit = 4,
  seed?: string,
): Promise<SuggestedPairs> {
  return (
    await api.get<SuggestedPairs>(`/pairs/${comboId}/suggested-pairs`, { params: { limit, seed } })
  ).data;
}

export async function matchPair(request: {
  comboId: string;
  userA: number;
  userB: number;
  includeAttention?: boolean;
  seed?: string;
  /** Optional what-if override for the attention-guided mask ratio (0–1). */
  maskRatio?: number;
  includeTokens?: boolean;
  dropA?: number[];
  dropB?: number[];
}): Promise<MatchResponse> {
  return (
    await api.post<MatchResponse>("/match", {
      combo_id: request.comboId,
      user_a: request.userA,
      user_b: request.userB,
      include_attention: request.includeAttention ?? true,
      include_tokens: request.includeTokens ?? true,
      seed: request.seed,
      mask_ratio: request.maskRatio,
      drop_a: request.dropA,
      drop_b: request.dropB,
    })
  ).data;
}

export async function getExperiments(): Promise<ExperimentPayload[]> {
  return (await api.get<ExperimentPayload[]>("/experiments")).data;
}

export async function getExperiment(comboId: string): Promise<ExperimentPayload> {
  return (await api.get<ExperimentPayload>(`/experiments/${comboId}`)).data;
}

/* ------------------------------------------- mask-ratio sensitivity experiment */

export async function getMaskSweepStatus(): Promise<MaskSweepStatus> {
  return (await api.get<MaskSweepStatus>("/mask-sweep")).data;
}

export async function getMaskSweepHarness(comboId: string): Promise<MaskSweepHarness> {
  return (await api.get<MaskSweepHarness>(`/mask-sweep/${comboId}`)).data;
}

/**
 * Run the frozen-weight mask-ratio sweep.
 *
 * Every ratio triggers a fresh forward pass over the same fixed test set, so this
 * is a long request (minutes); the axios timeout is raised accordingly.
 */
export async function runMaskSweep(
  comboId: string,
  maskRatios: number[],
  seed?: string,
): Promise<MaskSweepResult> {
  return (
    await api.post<MaskSweepResult>(
      `/mask-sweep/${comboId}/run`,
      { mask_ratios: maskRatios, seed },
      { timeout: 1800000 },
    )
  ).data;
}
