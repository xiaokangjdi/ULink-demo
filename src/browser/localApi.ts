/**
 * Local, no-backend implementation of the API functions used by the demo.
 *
 * It reads public/browser-data shards and runs public/browser-models ONNX files
 * in a Web Worker. Response objects intentionally mirror the FastAPI payloads so
 * the existing UI components do not need a second data model.
 */
import type {
  AttentionPayload,
  ComboMetadata,
  ConfigResponse,
  ExperimentPayload,
  GroundTruthPayload,
  HealthResponse,
  MaskPayload,
  MatchResponse,
  PipelineStage,
  PlatformInfo,
  SeedInfo,
  SuggestedPairs,
  TimingBreakdown,
  TokenLocation,
  TrajectoryStep,
  UserDetail,
  UserPage,
  UserSummary,
} from "../types";
import {
  dataManifest,
  loadUser,
  modelManifest,
  modelUrl,
  searchUsers,
  toPreview,
  toSummary,
  userMetadata,
  type LocalUserRecord,
  type ModelPair,
} from "./data";

const BASE = import.meta.env.BASE_URL;
const WASM_BASE = `${BASE}ort/`;

interface WorkerResult {
  type: "result";
  id: number;
  score: number;
  attentionAB: { data: Float32Array; dims: number[] };
  attentionBA: { data: Float32Array; dims: number[] };
  maskA: number[];
  maskB: number[];
  timing: { loadMs: number; runMs: number };
}

interface WorkerError {
  type: "error";
  id: number;
  message: string;
}

type Pending = { resolve: (value: WorkerResult) => void; reject: (reason: Error) => void };

let worker: Worker | null = null;
const pending = new Map<number, Pending>();
let sequence = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./inference.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerResult | WorkerError>) => {
      const data = event.data;
      const request = pending.get(data.id);
      if (data.type === "result") {
        request?.resolve(data);
      } else {
        request?.reject(new Error(data.message));
      }
      pending.delete(data.id);
    };
    worker.onerror = (event) => {
      // eslint-disable-next-line no-console
      console.error("Browser inference worker failed", event.message);
    };
  }
  return worker;
}

function runWorker(payload: Record<string, unknown>): Promise<WorkerResult> {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...payload, id });
  });
}

async function pairFor(comboId: string): Promise<{ pair: ModelPair; manifest: Awaited<ReturnType<typeof modelManifest>> }> {
  const manifest = await modelManifest();
  const pair = manifest.pairs.find((item) => item.id === comboId);
  if (!pair) throw new Error(`Unknown browser pair ${comboId}`);
  return { pair, manifest };
}

function seedInfo(pair: ModelPair, seed: string): SeedInfo {
  const entry = pair.seeds[seed];
  return {
    seed,
    checkpoint: entry?.file ?? "",
    exists: Boolean(entry),
    available: Boolean(entry),
    error: entry ? null : "No exported browser model",
    loaded: false,
    is_default: seed === pair.default_seed,
    loc_size: entry?.loc_size ?? null,
    num_layers_mask: pair.model_config.num_layers_mask,
    num_layers_attn: pair.model_config.num_layers_attn,
    usable_users: { platform_a: 0, platform_b: 0 },
    possible_pairs: 0,
  };
}

async function metadataFor(pair: ModelPair) {
  const [a, b] = await Promise.all([userMetadata(pair.dense), userMetadata(pair.sparse)]);
  return { a, b };
}

function summaryFor(record: LocalUserRecord, locSize: number): UserSummary {
  return toSummary(record, locSize);
}

function tokenLocations(record: LocalUserRecord): TokenLocation[] {
  return Array.from({ length: record.n }, (_, index) => ({
    step: index + 1,
    index,
    loc_id: record.loc[index],
    time_id: record.time[index],
    timestamp: record.stamp[index],
    lon: record.lon[index],
    lat: record.lat[index],
  }));
}

function attentionMatrix(data: Float32Array, dims: number[]) {
  const [rows, columns] = dims;
  const values: number[][] = [];
  for (let row = 0; row < rows; row += 1) {
    const line = new Array<number>(columns);
    for (let column = 0; column < columns; column += 1) line[column] = data[row * columns + column];
    values.push(line);
  }
  return { shape: [rows, columns] as [number, number], downsampled: false, stride: 1, values };
}

function groundTruth(pair: ModelPair, a: LocalUserRecord, b: LocalUserRecord): GroundTruthPayload {
  const same = a.id === b.id;
  return {
    platform_a: pair.dense,
    platform_b: pair.sparse,
    user_a: a.id,
    user_b: b.id,
    combo_id: pair.id,
    verdict: same ? "match" : "non_match",
    has_label: true,
    label: same ? 1 : 0,
    label_human: same ? "same person" : "different ids",
    reason: same ? "shared user id across both platforms" : "different user ids",
    rule: "shared_user_id",
    rule_explanation: "A user id present on both platforms denotes the same person.",
    data_source: "static exported trajectories",
    same_user_id: same,
    present_on_platform_a: true,
    present_on_platform_b: true,
    available: true,
    used_by_model: false,
    note: "Ground truth is shown after inference and is never used as an input.",
  };
}

export async function getHealth(): Promise<HealthResponse> {
  const manifest = await modelManifest();
  return {
    status: "ok",
    device: "browser wasm",
    device_request: "wasm",
    loaded_pairs: manifest.pairs.length,
    configured_pairs: manifest.pairs.length,
    load_seconds: 0,
    config_path: "browser-models/manifest.json",
    pairs: Object.fromEntries(manifest.pairs.map((pair) => [pair.id, { status: "ready", error: null, seed: pair.default_seed }])),
  };
}

export async function getConfig(): Promise<ConfigResponse> {
  return {
    version: "browser-1",
    decision: {
      threshold: 0.5,
      threshold_source: "checkpoint decision threshold",
      score_semantics: "sigmoid output, not a calibrated probability",
      positive_label: "same person",
    },
    indexing: { time_segment: "day", period: "all", dense_filter: 400, sparse_filter: 200, max_attention_cells: 1_500_000 },
    device: "browser wasm",
    device_request: "wasm",
    config_path: "browser-models/manifest.json",
    paths: {},
    training_performed_by_this_service: false,
  };
}

export async function getPlatforms(): Promise<PlatformInfo[]> {
  const manifest = await modelManifest();
  const names = new Map<string, string>();
  for (const pair of manifest.pairs) {
    names.set(pair.dense, pair.platform_a);
    names.set(pair.sparse, pair.platform_b);
  }
  return [...names].map(([key, name]) => ({
    key,
    name,
    subtitle: "static browser data",
    csv: "",
    configured_rows: 0,
    roles: [],
    pairs: [],
    users: null,
    usable_users: null,
  }));
}

export async function getPairs(): Promise<ComboMetadata[]> {
  const manifest = await modelManifest();
  const result: ComboMetadata[] = [];
  for (const pair of manifest.pairs) {
    const { a, b } = await metadataFor(pair);
    const localSizes = Object.values(pair.seeds).map((entry) => entry.loc_size);
    const maxLoc = Math.max(...localSizes);
    const usersA = a.filter((item) => item.max_loc <= maxLoc).length;
    const usersB = b.filter((item) => item.max_loc <= maxLoc).length;
    const seeds = Object.keys(pair.seeds).sort((left, right) => Number(left) - Number(right));
    result.push({
      id: pair.id,
      label: pair.label,
      dense_platform: pair.dense,
      sparse_platform: pair.sparse,
      platform_a: pair.platform_a,
      platform_b: pair.platform_b,
      model_family: pair.model_family,
      model_note: "Exported browser ONNX model; original checkpoint weights.",
      status: "ready",
      available: true,
      error: null,
      seed: pair.default_seed,
      available_seeds: seeds,
      usable_seeds: seeds,
      seeds: seeds.map((seed) => seedInfo(pair, seed)),
      loaded_seeds: seeds,
      index_loc_size: maxLoc,
      default_seed_counts: {
        seed: pair.default_seed,
        platform_a_users: usersA,
        platform_b_users: usersB,
        possible_pairs: usersA * usersB,
      },
      timings: {},
      index_from_cache: {},
      possible_pairs: usersA * usersB,
      possible_pairs_any_seed: usersA * usersB,
    } as ComboMetadata);
  }
  return result;
}

export async function getPair(comboId: string): Promise<ComboMetadata> {
  const pairs = await getPairs();
  const pair = pairs.find((item) => item.id === comboId);
  if (!pair) throw new Error(`Unknown pair ${comboId}`);
  return pair;
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
  const { pair } = await pairFor(params.comboId);
  const seed = params.seed || pair.default_seed;
  const locSize = pair.seeds[seed]?.loc_size;
  if (!locSize) throw new Error(`No browser model for seed ${seed}`);
  const platform = params.side === "a" ? pair.dense : pair.sparse;
  const query = params.query ?? "";
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 40;
  let users = (await searchUsers(platform, query, 0, Number.MAX_SAFE_INTEGER, locSize)).users;
  const sort = params.sort ?? "user_id";
  if (sort === "length") users = [...users].sort((left, right) => left.trajectory_length - right.trajectory_length);
  if (sort === "length_desc") users = [...users].sort((left, right) => right.trajectory_length - left.trajectory_length);
  if (sort === "max_loc_desc") users = [...users].sort((left, right) => right.max_loc_id - left.max_loc_id);
  return {
    combo_id: params.comboId,
    side: params.side,
    role: params.side === "a" ? "dense" : "sparse",
    platform,
    seed,
    loc_size: locSize,
    query,
    total: users.length,
    offset,
    limit,
    users: users.slice(offset, offset + limit),
  };
}

export async function getUserDetail(params: {
  comboId: string;
  side: "a" | "b";
  userId: number;
  preview?: number;
  previewStrategy?: "head" | "spread";
  seed?: string;
}): Promise<UserDetail> {
  const { pair } = await pairFor(params.comboId);
  const seed = params.seed || pair.default_seed;
  const locSize = pair.seeds[seed]?.loc_size;
  if (!locSize) throw new Error(`No browser model for seed ${seed}`);
  const platform = params.side === "a" ? pair.dense : pair.sparse;
  const record = await loadUser(platform, params.userId);
  if (record.max_loc > locSize) {
    throw new Error(`User ${record.id} contains location id ${record.max_loc}, outside this checkpoint's vocabulary 0..${locSize}.`);
  }
  return {
    ...summaryFor(record, locSize),
    combo_id: params.comboId,
    side: params.side,
    seed,
    loc_size: locSize,
    preview: toPreview(record, params.preview && params.preview > 300 ? 300 : params.preview ?? 24),
  };
}

export async function getSuggestedPairs(comboId: string, limit = 4, seed?: string): Promise<SuggestedPairs> {
  const { pair } = await pairFor(comboId);
  const resolvedSeed = seed || pair.default_seed;
  const locSize = pair.seeds[resolvedSeed]?.loc_size;
  if (!locSize) throw new Error(`No browser model for seed ${resolvedSeed}`);
  const { a, b } = await metadataFor(pair);
  const aIds = new Set(a.filter((item) => item.max_loc <= locSize).map((item) => item.id));
  const bIds = new Set(b.filter((item) => item.max_loc <= locSize).map((item) => item.id));
  const shared = [...aIds].filter((id) => bIds.has(id)).sort((left, right) => left - right).slice(0, limit);
  const aOnly = [...aIds].slice(0, limit);
  const bOnly = [...bIds].slice(0, limit);
  return {
    combo_id: comboId,
    platform_a: pair.dense,
    platform_b: pair.sparse,
    seed: resolvedSeed,
    loc_size: locSize,
    shared_user_id_count: [...aIds].filter((id) => bIds.has(id)).length,
    selection_rule: { matched_examples: "same numeric id on both platforms" },
    note: "Examples are read directly from the static exported trajectories.",
    matched_examples: shared.map((id) => ({ user_a: id, user_b: id })),
    unmatched_examples: aOnly.map((id, index) => ({ user_a: id, user_b: bOnly[index] ?? bOnly[0] ?? id })),
    random_examples: aOnly.slice(0, limit).map((id) => ({ user_a: id, user_b: bOnly[0] ?? id })),
  };
}

function dropTokens<T>(values: T[], drop: number[]): T[] {
  const skipped = new Set(drop.map((value) => Math.trunc(value)));
  return values.filter((_, index) => !skipped.has(index));
}

export async function matchPair(request: {
  comboId: string;
  userA: number;
  userB: number;
  includeAttention?: boolean;
  seed?: string;
  maskRatio?: number;
  includeTokens?: boolean;
  dropA?: number[];
  dropB?: number[];
}): Promise<MatchResponse> {
  const { pair } = await pairFor(request.comboId);
  const seed = request.seed || pair.default_seed;
  const locSize = pair.seeds[seed]?.loc_size;
  if (!locSize) throw new Error(`No browser model for seed ${seed}`);
  const denseRecord = await loadUser(pair.dense, request.userA);
  const sparseRecord = await loadUser(pair.sparse, request.userB);
  if (denseRecord.max_loc > locSize) {
    throw new Error(`Platform A user ${denseRecord.id} contains location id ${denseRecord.max_loc}, outside this checkpoint's vocabulary 0..${locSize}.`);
  }
  if (sparseRecord.max_loc > locSize) {
    throw new Error(`Platform B user ${sparseRecord.id} contains location id ${sparseRecord.max_loc}, outside this checkpoint's vocabulary 0..${locSize}.`);
  }
  const maskRatio = request.maskRatio ?? pair.model_config.threshold ?? 0.2;
  const dropA = request.dropA ?? [];
  const dropB = request.dropB ?? [];
  const locA = dropTokens(denseRecord.loc, dropA);
  const timeA = dropTokens(denseRecord.time, dropA);
  const stampA = dropTokens(denseRecord.stamp, dropA);
  const locB = dropTokens(sparseRecord.loc, dropB);
  const timeB = dropTokens(sparseRecord.time, dropB);
  const stampB = dropTokens(sparseRecord.stamp, dropB);
  const timings: TimingBreakdown = { user_lookup: 0, feature_build: 0, model_forward: 0, postprocess: 0, total: 0 };
  const started = performance.now();
  const result = await runWorker({
    type: "run",
    modelUrl: modelUrl(pair, seed),
    wasmBase: WASM_BASE,
    locA,
    timeA,
    stampA,
    locB,
    timeB,
    stampB,
    maskRatio,
  });
  const finished = performance.now();
  const maskAIndices = result.maskA.map((value, index) => (value >= 0.5 ? index : -1)).filter((value) => value >= 0);
  const maskBIndices = result.maskB.map((value, index) => (value >= 0.5 ? index : -1)).filter((value) => value >= 0);
  const mask: MaskPayload = {
    a: result.maskA,
    b: result.maskB,
    a_indices: maskAIndices,
    b_indices: maskBIndices,
    a_count: maskAIndices.length,
    b_count: maskBIndices.length,
    a_ratio: result.maskA.filter(Boolean).length / Math.max(1, result.maskA.length),
    b_ratio: result.maskB.filter(Boolean).length / Math.max(1, result.maskB.length),
    mask_ratio_setting: maskRatio,
  };
  const attention: AttentionPayload = {
    a_to_b: attentionMatrix(result.attentionAB.data, result.attentionAB.dims),
    b_to_a: attentionMatrix(result.attentionBA.data, result.attentionBA.dims),
    labels: {
      a_to_b: `${pair.platform_a} → ${pair.platform_b}`,
      b_to_a: `${pair.platform_b} → ${pair.platform_a}`,
      a_axis: "platform A token",
      b_axis: "platform B token",
    },
  };
  const config = pair.model_config;
  const stages: PipelineStage[] = [
    { stage: "embedding", name: "Spatial-Temporal Embedding", status: "complete", a_shape: [1, locA.length, config.embed_size], b_shape: [1, locB.length, config.embed_size] },
    { stage: "tte", name: "Temporal Transformer Encoder", status: "complete", a_shape: [1, locA.length, config.embed_size], b_shape: [1, locB.length, config.embed_size] },
    { stage: "cab", name: "Correlation Attention Block", status: "complete", attention_shapes: { a_to_b: [locA.length, locB.length], b_to_a: [locB.length, locA.length] } },
    { stage: "masking", name: "Attention-guided Masking", status: "complete", a_mask_count: mask.a_count, b_mask_count: mask.b_count },
    { stage: "mte", name: "Masked Transformer Encoder", status: "complete", a_shape: [1, locA.length, config.embed_size], b_shape: [1, locB.length, config.embed_size] },
    { stage: "classifier", name: "Binary Classifier", status: "complete", output_shape: [1, 1] },
  ];
  timings.model_forward = result.timing.runMs;
  timings.total = finished - started;
  const threshold = 0.5;
  return {
    combo_id: pair.id,
    combo_label: pair.label,
    platform_a: { key: pair.dense, name: pair.platform_a, role: "dense", user: summaryFor(denseRecord, locSize) },
    platform_b: { key: pair.sparse, name: pair.platform_b, role: "sparse", user: summaryFor(sparseRecord, locSize) },
    prediction: {
      score: result.score,
      predicted_label: result.score >= threshold ? 1 : 0,
      is_match: result.score >= threshold,
      decision_threshold: threshold,
      score_semantics: pair.decision.score_semantics,
      positive_label: pair.decision.positive_label,
      threshold_source: pair.decision.threshold_source,
    },
    model: {
      combo_id: pair.id,
      runtime_warnings: [],
      family: pair.model_family,
      family_label: "CAMTNet (browser ONNX)",
      checkpoint: pair.seeds[seed].file,
      seed,
      default_seed: pair.default_seed,
      is_default_seed: seed === pair.default_seed,
      loaded_seeds: [seed],
      source_file: "browser-models",
      config: {
        family: pair.model_family,
        seed,
        embed_size: config.embed_size,
        hidden_size: config.hidden_size,
        num_layers: config.num_layers,
        num_layers_mask: config.num_layers_mask,
        num_layers_attn: config.num_layers_attn,
        loc_size: locSize,
        num_heads: config.num_heads,
        threshold: config.threshold,
        p_drop: config.p_drop,
        prob: config.prob,
        classifier_type: config.classifier_type,
        mask_strategy: config.mask_strategy,
      },
    },
    attention,
    tokens: {
      a: request.includeTokens === false ? [] : tokenLocations(denseRecord),
      b: request.includeTokens === false ? [] : tokenLocations(sparseRecord),
    },
    intervention: dropA.length || dropB.length ? { drop_a: dropA, drop_b: dropB } : null,
    mask,
    representations: {},
    pipeline: stages,
    timing_ms: timings,
    device: "browser wasm",
    evidence: {
      pair_looked_up_in_stored_sample_list: "unknown",
      index_scope: "all users in the static CSV export",
      platform_a_users_in_index: 0,
      platform_b_users_in_index: 0,
      note: "Computed locally in the browser; no server request.",
    },
    dataset_hint: {
      same_numeric_user_id: denseRecord.id === sparseRecord.id,
      how_positive_pairs_were_built: "shared user id across platforms",
      used_by_the_model: false,
      stored_label: null,
      explanation: "Label is displayed for evaluation only.",
    },
    ground_truth: groundTruth(pair, denseRecord, sparseRecord),
  };
}

export async function getExperiments(): Promise<ExperimentPayload[]> {
  const response = await fetch(`${BASE}browser-data/experiments.json`);
  if (!response.ok) return [];
  return (await response.json()) as ExperimentPayload[];
}

export async function getExperiment(comboId: string): Promise<ExperimentPayload> {
  const all = await getExperiments();
  const found = all.find((item) => item.combo_id === comboId);
  if (!found) throw new Error(`No static experiment for ${comboId}`);
  return found;
}
