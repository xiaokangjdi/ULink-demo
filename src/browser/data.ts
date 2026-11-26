/**
 * Static browser data access for the no-backend build.
 *
 * Data is exported by browser_onnx/export_static_data.py:
 *   public/browser-data/users/{platform}.json
 *   public/browser-data/shards/{platform}/{0..127}.bin
 *
 * Shard format is documented in that exporter and mirrored in parseShard().
 */
import type { TrajectoryStep, UserSummary } from "../types";

export interface LocalManifest {
  schema: string;
  max_len: number;
  shards: number;
  platforms: { platform: string; users: number; tokens: number }[];
}

export interface LocalUserMeta {
  id: number;
  n: number;
  max_loc: number;
  tmin: number;
  tmax: number;
  coords: number;
  shard: number;
}

export interface LocalUserRecord extends LocalUserMeta {
  platform: string;
  loc: number[];
  time: number[];
  stamp: number[];
  lon: (number | null)[];
  lat: (number | null)[];
}

export interface ModelSeed {
  file: string;
  loc_size: number;
  bytes: number;
}

export interface ModelConfig {
  embed_size: number;
  hidden_size: number;
  num_layers: number;
  num_layers_mask: number;
  num_layers_attn: number;
  p_drop: number;
  num_heads: number;
  prob: number;
  threshold: number;
  mask_strategy: string;
  classifier_type: string;
}

export interface DecisionConfig {
  threshold: number;
  threshold_source: string;
  score_semantics: string | null;
  positive_label: string | null;
}

export interface ModelPair {
  id: string;
  label: string;
  dense: string;
  sparse: string;
  platform_a: string;
  platform_b: string;
  default_seed: string;
  model_family: string;
  model_config: ModelConfig;
  decision: DecisionConfig;
  seeds: Record<string, ModelSeed>;
}

export interface ModelManifest {
  schema: string;
  pairs: ModelPair[];
}

const BASE = import.meta.env.BASE_URL;
const DATA_ROOT = `${BASE}browser-data/`;
const MODEL_ROOT = `${BASE}browser-models/`;

const jsonCache = new Map<string, Promise<unknown>>();
const shardCache = new Map<string, Promise<ArrayBuffer>>();
const userMetaCache = new Map<string, Promise<LocalUserMeta[]>>();

function loadJson<T>(url: string): Promise<T> {
  let pending = jsonCache.get(url) as Promise<T> | undefined;
  if (!pending) {
    pending = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${url} (${response.status})`);
      return response.json() as Promise<T>;
    });
    jsonCache.set(url, pending);
  }
  return pending;
}

export function dataManifest(): Promise<LocalManifest> {
  return loadJson<LocalManifest>(`${DATA_ROOT}manifest.json`);
}

export function modelManifest(): Promise<ModelManifest> {
  return loadJson<ModelManifest>(`${MODEL_ROOT}manifest.json`);
}

export function modelUrl(pair: ModelPair, seed: string): string {
  const entry = pair.seeds[seed];
  if (!entry) throw new Error(`No browser model for ${pair.id} seed ${seed}`);
  return `${MODEL_ROOT}${entry.file}`;
}

export function userMetadata(platform: string): Promise<LocalUserMeta[]> {
  let pending = userMetaCache.get(platform);
  if (!pending) {
    pending = loadJson<LocalUserMeta[]>(`${DATA_ROOT}users/${platform}.json`);
    userMetaCache.set(platform, pending);
  }
  return pending;
}

function shard(platform: string, index: number): Promise<ArrayBuffer> {
  const key = `${platform}/${index}`;
  let pending = shardCache.get(key);
  if (!pending) {
    pending = fetch(`${DATA_ROOT}shards/${platform}/${index}.bin`).then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${platform} shard ${index}`);
      return response.arrayBuffer();
    });
    shardCache.set(key, pending);
  }
  return pending;
}

/** Parse the ULK1 binary format and return just the requested user. */
async function readUserFromShard(platform: string, meta: LocalUserMeta): Promise<LocalUserRecord> {
  const buffer = await shard(platform, meta.shard);
  const view = new DataView(buffer);
  const magic = new TextDecoder().decode(new Uint8Array(buffer, 0, 4));
  if (magic !== "ULK1") throw new Error(`Bad shard magic for ${platform}/${meta.shard}`);
  const count = view.getUint32(4, true);
  let offset = 0;
  let length = 0;
  for (let index = 0; index < count; index += 1) {
    const position = 8 + index * 16;
    if (view.getUint32(position, true) === meta.id) {
      offset = view.getUint32(position + 4, true);
      length = view.getUint16(position + 8, true);
      break;
    }
  }
  if (!length) throw new Error(`User ${meta.id} is missing from ${platform} shard ${meta.shard}`);
  const tokenBase = 8 + count * 16;
  const loc: number[] = new Array(length);
  const time: number[] = new Array(length);
  const stamp: number[] = new Array(length);
  const lon: (number | null)[] = new Array(length);
  const lat: (number | null)[] = new Array(length);
  for (let index = 0; index < length; index += 1) {
    const position = tokenBase + (offset + index) * 15;
    loc[index] = view.getUint16(position, true);
    time[index] = view.getUint8(position + 2);
    stamp[index] = view.getUint32(position + 3, true);
    const rawLon = view.getFloat32(position + 7, true);
    const rawLat = view.getFloat32(position + 11, true);
    lon[index] = Number.isFinite(rawLon) ? rawLon : null;
    lat[index] = Number.isFinite(rawLat) ? rawLat : null;
  }
  return { ...meta, platform, loc, time, stamp, lon, lat };
}

export async function loadUser(platform: string, userId: number): Promise<LocalUserRecord> {
  const all = await userMetadata(platform);
  const meta = all.find((item) => item.id === userId);
  if (!meta) throw new Error(`User ${userId} does not exist on ${platform}`);
  return readUserFromShard(platform, meta);
}

export function toSummary(record: LocalUserRecord, locSize: number): UserSummary {
  return {
    platform: record.platform,
    user_id: record.id,
    trajectory_length: record.n,
    source_rows: 1,
    max_loc_id: record.max_loc,
    time_id_range: [record.tmin, record.tmax],
    usable: record.max_loc <= locSize,
    unusable_reason:
      record.max_loc <= locSize
        ? null
        : `location id ${record.max_loc} is outside this checkpoint's vocabulary 0..${locSize}`,
    coordinate_count: record.coords,
    coordinate_source: record.coords ? "static shard" : null,
  };
}

/** Same spread sample the backend uses for the map preview (display only). */
export function toPreview(record: LocalUserRecord, limit = 300): TrajectoryStep[] {
  if (!record.n) return [];
  if (record.n <= limit) {
    return Array.from({ length: record.n }, (_, index) => ({
      step: index + 1,
      loc_id: record.loc[index],
      time_id: record.time[index],
      timestamp: record.stamp[index],
      lon: record.lon[index],
      lat: record.lat[index],
    }));
  }
  const indices: number[] = [];
  for (let index = 0; index < limit; index += 1) {
    indices.push(Math.round((index * (record.n - 1)) / (limit - 1)));
  }
  return indices.map((index) => ({
    step: index + 1,
    loc_id: record.loc[index],
    time_id: record.time[index],
    timestamp: record.stamp[index],
    lon: record.lon[index],
    lat: record.lat[index],
  }));
}

export async function searchUsers(
  platform: string,
  query: string,
  offset: number,
  limit: number,
  locSize: number,
): Promise<{ total: number; users: UserSummary[] }> {
  const all = await userMetadata(platform);
  const text = query.trim();
  const filtered = all.filter((item) => {
    if (item.max_loc > locSize) return false;
    return !text || String(item.id).includes(text);
  });
  const page = filtered.slice(offset, offset + limit);
  return {
    total: filtered.length,
    users: page.map((item) => ({
      platform,
      user_id: item.id,
      trajectory_length: item.n,
      source_rows: 1,
      max_loc_id: item.max_loc,
      time_id_range: [item.tmin, item.tmax],
      usable: true,
      unusable_reason: null,
      coordinate_count: item.coords,
      coordinate_source: item.coords ? "static shard" : null,
    })),
  };
}
